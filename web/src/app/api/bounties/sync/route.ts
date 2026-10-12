import { NextResponse } from "next/server";
import {
  createPublicClient,
  decodeFunctionData,
  http,
  isAddress,
  isHex,
  parseEventLogs,
} from "viem";
import {
  arcMainnet,
  ARC_BOUNTY_ADDRESS,
  arcBountyAbiConfig,
} from "../../../../lib/arcBounty";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

const publicClient = createPublicClient({
  chain: arcMainnet,
  transport: http("https://rpc.mainnet.arc.io"),
});

const bountyAbi = [
  {
    type: "function",
    name: "createBounty",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reward", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "title", type: "string" },
      { name: "description", type: "string" },
      { name: "_winnerCount", type: "uint256" },
      { name: "percentagesBps", type: "uint16[]" },
    ],
    outputs: [{ name: "bountyId", type: "uint256" }],
  },
  {
    type: "event",
    name: "BountyCreated",
    anonymous: false,
    inputs: [
      { name: "bountyId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "reward", type: "uint256", indexed: false },
      { name: "deadline", type: "uint256", indexed: false },
      { name: "title", type: "string", indexed: false },
    ],
  },
] as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const creationHash = String(body.creationHash ?? "");
    const bountyId = String(body.bountyId ?? "").trim();
    const creator = String(body.creator ?? "");
    const title = String(body.title ?? "").trim();
    const category = String(body.category ?? "").trim();
    const rewardAmount = String(body.rewardAmount ?? "").trim();
    const deadline = String(body.deadline ?? "").trim();
    const deadlineSeconds = Number(body.deadlineSeconds);
    const description = String(body.description ?? "").trim();
    const descriptionOnChain = String(body.descriptionOnChain ?? "");
    const requirements = String(body.requirements ?? "").trim();
    const winnerCount = Number(body.winnerCount);
    const distribution = String(body.distribution ?? "equal");
    const percentages: number[] = Array.isArray(body.percentages)
      ? body.percentages.map(Number)
      : [];

    if (
      !isHex(creationHash) ||
      !/^0x[a-fA-F0-9]{64}$/.test(creationHash) ||
      !/^\d+$/.test(bountyId) ||
      !isAddress(creator) ||
      !title ||
      !category ||
      !description ||
      !rewardAmount ||
      !deadline ||
      !Number.isSafeInteger(deadlineSeconds) ||
      deadlineSeconds <= 0 ||
      !Number.isInteger(winnerCount) ||
      winnerCount < 1 ||
      winnerCount > 100 ||
      !["equal", "custom"].includes(distribution)
    ) {
      return NextResponse.json(
        { error: "Invalid bounty details." },
        { status: 400 }
      );
    }

    if (
      distribution === "custom" &&
      (
        percentages.length !== winnerCount ||
        percentages.some(
          (value) =>
            !Number.isInteger(value) || value < 1 || value > 100
        ) ||
        percentages.reduce((sum, value) => sum + value, 0) !== 100
      )
    ) {
      return NextResponse.json(
        { error: "Invalid reward distribution." },
        { status: 400 }
      );
    }

    const rewardNumber = Number(rewardAmount);

    if (
      !Number.isFinite(rewardNumber) ||
      rewardNumber <= 0 ||
      !/^\d+(\.\d{1,6})?$/.test(rewardAmount)
    ) {
      return NextResponse.json(
        { error: "Invalid USDC reward." },
        { status: 400 }
      );
    }

    const reward = BigInt(
      rewardAmount.includes(".")
        ? rewardAmount.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
            .split(".")[0] +
            (rewardAmount.replace(/^\d+\.?/, "").padEnd(6, "0").slice(0, 6))
        : rewardAmount + "000000"
    );

    const transaction = await publicClient.getTransaction({
      hash: creationHash as `0x${string}`,
    });

    if (
      !transaction.to ||
      transaction.to.toLowerCase() !== ARC_BOUNTY_ADDRESS.toLowerCase() ||
      transaction.from.toLowerCase() !== creator.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Transaction sender or contract does not match." },
        { status: 400 }
      );
    }

    const receipt = await publicClient.getTransactionReceipt({
      hash: creationHash as `0x${string}`,
    });

    if (receipt.status !== "success") {
      return NextResponse.json(
        { error: "The bounty transaction did not succeed." },
        { status: 400 }
      );
    }

    const decoded = decodeFunctionData({
      abi: bountyAbi,
      data: transaction.input,
    });

    if (decoded.functionName !== "createBounty") {
      return NextResponse.json(
        { error: "Transaction is not a bounty creation." },
        { status: 400 }
      );
    }

    const [
      onChainReward,
      onChainDeadline,
      onChainTitle,
      onChainDescription,
      onChainWinnerCount,
      onChainPercentages,
    ] = decoded.args;

    const expectedPercentages =
      distribution === "custom"
        ? percentages.map((value) => value * 100)
        : [];

    if (
      onChainReward !== reward ||
      onChainDeadline !== BigInt(deadlineSeconds) ||
      onChainTitle !== title ||
      onChainDescription !== descriptionOnChain ||
      onChainWinnerCount !== BigInt(winnerCount) ||
      onChainPercentages.length !== expectedPercentages.length ||
      onChainPercentages.some(
        (value, index) => value !== expectedPercentages[index]
      )
    ) {
      return NextResponse.json(
        { error: "Submitted details do not match the on-chain transaction." },
        { status: 400 }
      );
    }

    const events = parseEventLogs({
      abi: bountyAbi,
      logs: receipt.logs,
      eventName: "BountyCreated",
      strict: false,
    });

    const createdEvent = events.find(
      (event) =>
        event.address.toLowerCase() === ARC_BOUNTY_ADDRESS.toLowerCase() &&
        event.args.creator?.toLowerCase() === creator.toLowerCase() &&
        event.args.bountyId?.toString() === bountyId
    );

    if (
      !createdEvent ||
      createdEvent.args.reward !== reward ||
      createdEvent.args.deadline !== BigInt(deadlineSeconds) ||
      createdEvent.args.title !== title
    ) {
      return NextResponse.json(
        { error: "Could not verify the bounty creation event." },
        { status: 400 }
      );
    }

    const bounty = {
      id: bountyId,
      category,
      tag: "Open",
      title,
      description,
      reward: `${rewardAmount} USDC`,
      winners: winnerCount,
      distribution,
      percentages: distribution === "custom" ? percentages : [],
      time_label: deadline,
      deadline,
      submissions: "0 submissions",
      creator,
      requirements,
      status: "Open",
    };

    const { error } = await supabaseAdmin
      .from("bounties")
      .upsert(bounty, { onConflict: "id" });

    if (error) {
      console.error("Supabase bounty sync failed:", error.message);

      return NextResponse.json(
        {
          error:
            "The transaction is confirmed, but the bounty could not be saved to the marketplace.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      bountyId,
    });
  } catch (error) {
    console.error("Bounty verification and sync failed:", error);

    return NextResponse.json(
      {
        error:
          "Unable to verify or save the bounty. Check the transaction on Arc Explorer.",
      },
      { status: 500 }
    );
  }
}
