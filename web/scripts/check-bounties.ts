import { getOnChainBounties } from "../src/data/bounties-chain";

async function main() {
  console.log("Checking Arc Mainnet...");
  const bounties = await getOnChainBounties();

  console.log("Number of active on-chain bounties:", bounties.length);
  console.log(JSON.stringify(bounties, null, 2));
}

main().catch((error) => {
  console.error("Arc Mainnet read failed:");
  console.error(error);
  process.exitCode = 1;
});
