import { NextResponse } from "next/server";
import {
  createPublicClient,
  decodeEventLog,
  decodeFunctionData,
  http,
  isAddress,
} from "viem";
import {
  arcMainnet,
  ARC_BOUNTY_ADDRESS,
  arcBountyAbiConfig,
} from "../../../../lib/arcBounty";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

const abi = arcBountyAbiConfig as any;

const client = createPublicClient({
  chain: arcMainnet,
  transport: http("https://rpc.mainnet.arc.io"),
});

function sameAddress(a: unknown, b: unknown) {
  return (
    typeof a === "string" &&
    typeof b === "string" &&
    a.toLowerCase() === b.toLowerCase()
  );
}

function sameId(a: unknown, b: string) {
  try {
    return BigInt(a as string | number | bigint) === BigInt(b);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const submissionId = String(body.submissionId ?? "").trim();
    const bountyId = String(body.bountyId ?? "").trim();
    const action = String(body.action ?? "").trim().toLowerCase();
    const transactionHash = String(body.transactionHash ?? "").trim();

    if (
      !submissionId ||
      !/^\d+$/.test(bountyId) ||
      !["approve", "reject"].includes(action) ||
      !/^0x[a-fA-F0-9]{64}$/.test(transactionHash)
    ) {
      return NextResponse.json(
        { error: "Invalid review request." },
        { status: 400 }
      );
    }

    const { data: submission, error: lookupError } = await supabaseAdmin
      .from("submissions")
      .select(
        "id, bounty_id, status, onchain_submission_id, wallet_address, submission_tx_hash"
      )
      .eq("id", submissionId)
      .maybeSingle();

    if (lookupError) {
      console.error("Review lookup failed:", lookupError.message);
      return NextResponse.json(
        { error: "Unable to load submission." },
        { status: 500 }
      );
    }

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found." },
        { status: 404 }
      );
    }

    if (String(submission.bounty_id) !== bountyId) {
      return NextResponse.json(
        { error: "Submission does not belong to this bounty." },
        { status: 400 }
      );
    }

    if (submission.status !== "Pending Review") {
      return NextResponse.json(
        { error: "This submission has already been reviewed." },
        { status: 409 }
      );
    }

    if (
      submission.onchain_submission_id === null ||
      submission.onchain_submission_id === undefined ||
      !/^\d+$/.test(String(submission.onchain_submission_id))
    ) {
      return NextResponse.json(
        { error: "Submission is missing its on-chain ID." },
        { status: 409 }
      );
    }

    if (
      submission.submission_tx_hash &&
      String(submission.submission_tx_hash).toLowerCase() ===
        transactionHash.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "A submission transaction cannot be used as a review transaction." },
        { status: 400 }
      );
    }

    const hash = transactionHash as `0x${string}`;

    const [transaction, receipt, bounty] = await Promise.all([
      client.getTransaction({ hash }),
      client.getTransactionReceipt({ hash }),
      client.readContract({
        address: ARC_BOUNTY_ADDRESS,
        abi,
        functionName: "bounties",
        args: [BigInt(bountyId)],
      }) as Promise<any>,
    ]);

    if (receipt.status !== "success") {
      return NextResponse.json(
        { error: "Review transaction did not succeed." },
        { status: 400 }
      );
    }

    if (!sameAddress(transaction.to, ARC_BOUNTY_ADDRESS)) {
      return NextResponse.json(
        { error: "Transaction was not sent to the ArcBounty contract." },
        { status: 400 }
      );
    }

    const creator = String(bounty.creator ?? bounty[1]);

    if (!isAddress(creator) || !sameAddress(transaction.from, creator)) {
      return NextResponse.json(
        { error: "Only the bounty creator can review this submission." },
        { status: 403 }
      );
    }

    let decoded: any;

    try {
      decoded = decodeFunctionData({
        abi,
        data: transaction.input,
      } as any);
    } catch {
      return NextResponse.json(
        { error: "Unable to decode review transaction." },
        { status: 400 }
      );
    }

    const expectedFunction =
      action === "approve" ? "approveSubmission" : "rejectSubmission";

    if (decoded.functionName !== expectedFunction) {
      return NextResponse.json(
        { error: "Transaction function does not match the requested action." },
        { status: 400 }
      );
    }

    const args = decoded.args as readonly unknown[];

    if (
      !sameId(args[0] as any, bountyId) ||
      !sameId(args[1] as any, String(submission.onchain_submission_id))
    ) {
      return NextResponse.json(
        { error: "Transaction references a different bounty or submission." },
        { status: 400 }
      );
    }

    let matchedEvent = false;

    for (const log of receipt.logs) {
      if (!sameAddress(log.address, ARC_BOUNTY_ADDRESS)) continue;

      try {
        const decodedLog: any = decodeEventLog({
          abi,
          data: log.data,
          topics: log.topics,
          strict: false,
        } as any);

        const expectedEvent =
          action === "approve" ? "SubmissionApproved" : "SubmissionRejected";

        if (decodedLog.eventName !== expectedEvent) continue;

        const eventArgs = decodedLog.args;

        if (
          !sameId(eventArgs.bountyId, bountyId) ||
          !sameId(
            eventArgs.submissionId,
            String(submission.onchain_submission_id)
          )
        ) {
          continue;
        }

        if (
          submission.wallet_address &&
          eventArgs.contributor &&
          !sameAddress(eventArgs.contributor, submission.wallet_address)
        ) {
          continue;
        }

        if (action === "approve") {
          const tier = args[2] as bigint;
          const payoutAmounts: any = await client.readContract({
            address: ARC_BOUNTY_ADDRESS,
            abi,
            functionName: "getPayoutAmounts",
            args: [BigInt(bountyId)],
          });

          if (
            tier < BigInt(0) ||
            tier >= BigInt(payoutAmounts.length) ||
            BigInt(eventArgs.reward) !== BigInt(payoutAmounts[Number(tier)])
          ) {
            continue;
          }
        }

        matchedEvent = true;
        break;
      } catch {
        // Ignore logs that are not the matching review event.
      }
    }

    if (!matchedEvent) {
      return NextResponse.json(
        { error: "Matching review event was not found in the successful receipt." },
        { status: 400 }
      );
    }

    const newStatus = action === "approve" ? "Approved" : "Rejected";

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("submissions")
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .eq("bounty_id", bountyId)
      .eq("status", "Pending Review")
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error("Review database update failed:", updateError.message);

      return NextResponse.json(
        {
          error:
            "The Arc transaction succeeded, but saving the marketplace status failed. Contact support with transaction hash " +
            transactionHash,
          transactionHash,
        },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        {
          error:
            "The on-chain review succeeded, but this submission was already updated in the marketplace.",
          transactionHash,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      transactionHash,
    });
  } catch (error) {
    console.error("Submission review verification failed:", error);

    return NextResponse.json(
      {
        error:
          "Could not verify the review transaction. Check its status on Arc and try again if it has not been recorded.",
      },
      { status: 500 }
    );
  }
}
