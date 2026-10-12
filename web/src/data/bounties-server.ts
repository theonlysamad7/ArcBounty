import "server-only";
import { bounties as demoBounties, type Bounty } from "./bounties";
import { supabaseAdmin } from "../lib/supabase-admin";

export type StoredBounty = Bounty & {
  requirements?: string;
  status?: string;
  createdAt?: string;
  deadline?: string;
};

function mapDatabaseBounty(row: Record<string, unknown>): StoredBounty {
  return {
    id: String(row.id),
    category: String(row.category ?? "Other"),
    tag: String(row.tag ?? "Open"),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    reward: String(row.reward ?? "0 USDC"),
    time: String(row.time_label ?? row.deadline ?? ""),
    submissions: String(row.submissions ?? "0 submissions"),
    creator: String(row.creator ?? "ArcBounty"),
    winners: Number(row.winners ?? 1),
    distribution:
      row.distribution === "custom" ? "custom" : "equal",
    percentages: Array.isArray(row.percentages)
      ? row.percentages.map(Number)
      : [],
    requirements:
      row.requirements == null ? undefined : String(row.requirements),
    status: String(row.status ?? "Open"),
    createdAt:
      row.created_at == null ? undefined : String(row.created_at),
    deadline:
      row.deadline == null ? undefined : String(row.deadline),
  };
}

export async function getBounties(): Promise<StoredBounty[]> {
  const { data, error } = await supabaseAdmin
    .from("bounties")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load bounties from Supabase:", error.message);
    throw new Error("Unable to load bounties.");
  }

  const storedBounties = (data ?? []).map((row) =>
    mapDatabaseBounty(row as Record<string, unknown>)
  );

  const storedIds = new Set(storedBounties.map((bounty) => bounty.id));
  const missingDemoBounties = demoBounties.filter(
    (bounty) => !storedIds.has(bounty.id)
  );

  return [...storedBounties, ...missingDemoBounties];
}

export async function getBountyById(
  id: string
): Promise<StoredBounty | undefined> {
  const allBounties = await getBounties();
  return allBounties.find((bounty) => bounty.id === id);
}
