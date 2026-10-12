import { NextResponse } from "next/server";
import {
  createPublicClient,
  decodeFunctionData,
  http,
  isAddress,
  isHex,
  parseEventLogs,
  type Address,
  type Hash,
} from "viem";
import {
  arcMainnet,
  ARC_BOUNTY_ADDRESS,
  arcBountyAbiConfig,
} from "../../../lib/arcBounty";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";

const publicClient = createPublicClient({
  chain: arcMainnet,
  transport: http("https://rpc.mainnet.arc.io"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const bountyId = String(body.bountyId ?? "").trim();
    const walletAddress = String(body.walletAddress ?? "").trim();
    const transactionHash = String(body.transactionHash ?? "").trim();
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const proof = String(body.proof ?? "").trim();

    if (
      !/^\d+$/.test(bountyId) ||
      !isAddress(walletAddress) ||
      !isHex(transactionHash, { strict: true }) ||
      transactionHash.length !== 66 ||
      !title ||
      !description ||
      !proof
    ) {
      return NextResponse.json(
        { error: "Missing or invalid submission details." },
        { status: 400 }
      );
    }

    let proofUrl: string;

    try {
      const parsedUrl = new URL(proof);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol");
      }

      proofUrl = parsedUrl.toString();
    } catch {
      return NextResponse.json(
        { error: "Please provide a valid HTTP or HTTPS proof URL." },
        { status: 400 }
      );
    }

    const normalizedWallet = walletAddress.toLowerCase();
    const hash = transactionHash as Hash;
    const numericBountyId = BigInt(bountyId);

    // Make retries safe: return success if this transaction was already saved.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("submissions")
      .select("id, onchain_submission_id")
      .eq("submission_tx_hash", hash)
      .maybeSingle();

    if (existingError) {
      console.error("Submission lookup failed:", existingError.message);

      return NextResponse.json(
        { error: "Unable to check existing submissions." },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        submissionId: existing.id,
        onchainSubmissionId: existing.onchain_submission_id,
      });
    }

    // Verify the transaction exists and was sent to ArcBounty.
    const [transaction, receipt] = await Promise.all([
      publicClient.getTransaction({ hash }),
      publicClient.getTransactionReceipt({ hash }),
    ]);

    if (receipt.status !== "success") {
      return NextResponse.json(
        { error: "The Arc transaction did not succeed." },
        { status: 400 }
      );
    }

    if (
      !transaction.to ||
      transaction.to.toLowerCase() !== ARC_BOUNTY_ADDRESS.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "The transaction was not sent to the ArcBounty contract." },
        { status: 400 }
      );
    }

    if (transaction.from.toLowerCase() !== normalizedWallet) {
      return NextResponse.json(
        { error: "The transaction sender does not match the contributor wallet." },
        { status: 400 }
      );
    }

    // Confirm the transaction called submitWork with the expected bounty and proof.
    const decoded = decodeFunctionData({
      abi: arcBountyAbiConfig,
      data: transaction.input,
    });

    if (decoded.functionName !== "submitWork") {
      return NextResponse.json(
        { error: "This transaction is not a work submission." },
        { status: 400 }
      );
    }

    const [submittedBountyId, submittedProof] = decoded.args as readonly [
      bigint,
      string
    ];

    const expectedProof = [
      `Title: ${title}`,
      "",
      `Description: ${description}`,
      "",
      `Proof: ${proofUrl}`,
    ].join("\n");

    if (
      submittedBountyId !== numericBountyId ||
      submittedProof !== expectedProof
    ) {
      return NextResponse.json(
        { error: "The submitted details do not match the confirmed transaction." },
        { status: 400 }
      );
    }

    // Require the corresponding on-chain WorkSubmitted event.
    const workSubmittedLogs = parseEventLogs({
      abi: arcBountyAbiConfig,
      logs: receipt.logs,
      eventName: "WorkSubmitted",
      strict: false,
    });

    const matchingLog = workSubmittedLogs.find((log) => {
      const args = (log as unknown as {
        args?: {
          bountyId?: bigint;
          contributor?: string;
          submissionId?: bigint;
        };
      }).args;

      return (
        args?.bountyId === numericBountyId &&
        args?.contributor?.toLowerCase() === normalizedWallet
      );
    });

    const matchingArgs = (matchingLog as unknown as {
      args?: { submissionId?: bigint };
    } | undefined)?.args;

    if (matchingArgs?.submissionId === undefined) {
      return NextResponse.json(
        { error: "The confirmed transaction has no matching WorkSubmitted event." },
        { status: 400 }
      );
    }

    const onchainSubmissionId = matchingArgs.submissionId.toString();

    // Use the database's canonical bounty title and reward.
    const { data: bounty, error: bountyError } = await supabaseAdmin
      .from("bounties")
      .select("id, title, reward")
      .eq("id", bountyId)
      .maybeSingle();

    if (bountyError) {
      console.error("Bounty lookup failed:", bountyError.message);

      return NextResponse.json(
        { error: "Unable to look up the bounty in the marketplace." },
        { status: 500 }
      );
    }

    if (!bounty) {
      return NextResponse.json(
        {
          error:
            "The work is confirmed on Arc, but this bounty is not yet synchronized with the marketplace.",
        },
        { status: 404 }
      );
    }

    const submission = {
      id: `submission-${crypto.randomUUID()}`,
      bounty_id: bounty.id,
      bounty_title: bounty.title,
      title,
      description,
      proof: proofUrl,
      reward: bounty.reward,
      status: "Pending Review",
      wallet_address: walletAddress,
      submission_tx_hash: hash,
      onchain_submission_id: onchainSubmissionId,
    };

    const { data: saved, error: insertError } = await supabaseAdmin
      .from("submissions")
      .insert(submission)
      .select("id")
      .single();

    if (insertError) {
      console.error("Submission insert failed:", insertError.message);

      // A concurrent retry may have saved this transaction after our first lookup.
      const { data: concurrent } = await supabaseAdmin
        .from("submissions")
        .select("id, onchain_submission_id")
        .eq("submission_tx_hash", hash)
        .maybeSingle();

      if (concurrent) {
        return NextResponse.json({
          ok: true,
          duplicate: true,
          submissionId: concurrent.id,
          onchainSubmissionId: concurrent.onchain_submission_id,
        });
      }

      return NextResponse.json(
        { error: "The Arc transaction is confirmed, but saving it to the marketplace failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      submissionId: saved.id,
      onchainSubmissionId,
    });
  } catch (error) {
    console.error("Submission verification failed:", error);

    return NextResponse.json(
      {
        error:
          "Unable to verify or save this submission. Check the transaction and try syncing again.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = (searchParams.get("wallet") ?? "").trim();

    if (!isAddress(wallet)) {
      return NextResponse.json(
        { error: "A valid wallet address is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("submissions")
      .select(
        "id, bounty_id, bounty_title, title, description, proof, reward, status, submitted_at, wallet_address, submission_tx_hash"
      )
      .ilike("wallet_address", wallet)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch submissions:", error.message);

      return NextResponse.json(
        { error: "Unable to load your submissions." },
        { status: 500 }
      );
    }

    return NextResponse.json({ submissions: data ?? [] });
  } catch (error) {
    console.error("Submissions retrieval failed:", error);

    return NextResponse.json(
      { error: "Unable to retrieve submissions." },
      { status: 500 }
    );
  }
}
