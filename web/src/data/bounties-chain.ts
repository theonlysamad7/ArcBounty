import "server-only";
import {
  createPublicClient,
  formatUnits,
  http,
  type Address,
} from "viem";
import { arcMainnet, ARC_BOUNTY_ADDRESS, arcBountyAbiConfig } from "../lib/arcBounty";

const client = createPublicClient({
  chain: arcMainnet,
  transport: http("https://rpc.mainnet.arc.io"),
});

type ChainBounty = readonly [
  bigint,
  Address,
  bigint,
  bigint,
  number,
  string,
  string,
];

export type OnChainBounty = {
  id: string;
  category: string;
  tag: string;
  title: string;
  description: string;
  reward: string;
  time: string;
  deadline: string;
  submissions: string;
  creator: string;
  creatorAddress: string;
  winners: number;
  status: "Active" | "Completed" | "Cancelled";
  remainingReward: string;
  distribution: "equal" | "custom";
};

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function inferCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();

  if (/bug|security|vulnerability|audit/.test(text)) return "Bug Hunt";
  if (/design|ui\/ux|interface|figma/.test(text)) return "Design";
  if (/write|article|documentation|content/.test(text)) return "Writing";
  if (/community|social|discord|ambassador/.test(text)) return "Community";
  if (/research|analysis|report|investigate/.test(text)) return "Research";
  return "Development";
}

export async function getOnChainBounties(): Promise<OnChainBounty[]> {
  const nextId = await client.readContract({
    address: ARC_BOUNTY_ADDRESS,
    abi: arcBountyAbiConfig,
    functionName: "nextBountyId",
  });

  const count = Number(nextId);

  if (!Number.isSafeInteger(count) || count <= 0) {
    return [];
  }

  const ids = Array.from({ length: count }, (_, index) => BigInt(index));

  const results = await Promise.all(
    ids.map(async (id) => {
      const raw = (await client.readContract({
        address: ARC_BOUNTY_ADDRESS,
        abi: arcBountyAbiConfig,
        functionName: "bounties",
        args: [id],
      })) as unknown as ChainBounty;

      const [
        bountyId,
        creator,
        reward,
        deadline,
        statusNumber,
        title,
        description,
      ] = raw;

      // An empty creator means this ID does not contain a valid bounty.
      if (creator === "0x0000000000000000000000000000000000000000") {
        return null;
      }

      const status = (["Active", "Completed", "Cancelled"] as const)[
        Number(statusNumber)
      ] ?? "Cancelled";

      if (status !== "Active") {
        return null;
      }

      const remainingRewardRaw = await client.readContract({
        address: ARC_BOUNTY_ADDRESS,
        abi: arcBountyAbiConfig,
        functionName: "remainingReward",
        args: [bountyId],
      });

      const winnersRaw = await client.readContract({
        address: ARC_BOUNTY_ADDRESS,
        abi: arcBountyAbiConfig,
        functionName: "winnerCount",
        args: [bountyId],
      });

      const submissionsRaw = await client.readContract({
        address: ARC_BOUNTY_ADDRESS,
        abi: arcBountyAbiConfig,
        functionName: "getSubmissions",
        args: [bountyId],
      });

      const remainingReward = remainingRewardRaw as bigint;
      const winners = winnersRaw as bigint;
      const submissions = submissionsRaw as readonly unknown[];

      const deadlineDate = new Date(Number(deadline) * 1000);
      const deadlineIso = deadlineDate.toISOString();
      const expired = deadlineDate.getTime() <= Date.now();

      return {
        id: bountyId.toString(),
        category: inferCategory(title, description),
        tag: expired ? "Deadline Passed" : "On-chain",
        title,
        description,
        reward: `${formatUnits(reward, 6)} USDC`,
        time: deadlineIso,
        deadline: deadlineIso,
        submissions: `${submissions.length} submissions`,
        creator: shortAddress(creator),
        creatorAddress: creator,
        winners: Number(winners),
        status,
        remainingReward: `${formatUnits(remainingReward, 6)} USDC`,
        distribution: "equal" as const,
      };
    }),
  );

  return results
    .filter((bounty): bounty is NonNullable<typeof bounty> => bounty !== null)
    .reverse();
}
