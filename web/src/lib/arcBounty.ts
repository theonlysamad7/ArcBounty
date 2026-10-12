import { defineChain } from "viem";
import arcBountyAbi from "./abi/arcBounty.json";

export const arcMainnet = defineChain({
  id: 5042,
  name: "Arc",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.mainnet.arc.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: "https://explorer.arc.io",
    },
  },
});

export const ARC_BOUNTY_ADDRESS =
  "0xDC43808ac57a863E014F2e21dAF31D38C00246E9" as const;

export const ARC_USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000" as const;

export const arcBountyAbiConfig = arcBountyAbi;
