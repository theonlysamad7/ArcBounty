import fs from "fs/promises";
import path from "path";
import { bounties as demoBounties, type Bounty } from "./bounties";

const filePath = path.join(process.cwd(), "data", "bounties.json");

export type StoredBounty = Bounty & {
  requirements?: string;
  status?: string;
  createdAt?: string;
  deadline?: string;
};

export async function getBounties(): Promise<StoredBounty[]> {
  let storedBounties: StoredBounty[] = [];

  try {
    const existing = await fs.readFile(filePath, "utf8");
    storedBounties = JSON.parse(existing);
  } catch {
    storedBounties = [];
  }

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
