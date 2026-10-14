"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createPublicClient,
  formatUnits,
  http,
} from "viem";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import {
  arcMainnet,
  ARC_BOUNTY_ADDRESS,
  arcBountyAbiConfig,
} from "../../../../lib/arcBounty";
import WalletButton from "../../../../components/WalletButton";

const abi = arcBountyAbiConfig as any;

const publicClient = createPublicClient({
  chain: arcMainnet,
  transport: http("https://rpc.mainnet.arc.io"),
});

type Props = {
  bountyId: string;
  submissionId: string;
  onchainSubmissionId: string;
  creatorAddress: string;
};

export default function ReviewSubmissionButtons({
  bountyId,
  submissionId,
  onchainSubmissionId,
  creatorAddress,
}: Props) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const [amounts, setAmounts] = useState<bigint[]>([]);
  const [paidTiers, setPaidTiers] = useState<boolean[]>([]);
  const [selectedTier, setSelectedTier] = useState("0");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isCreator =
    Boolean(address) &&
    /^0x[a-fA-F0-9]{40}$/.test(creatorAddress) &&
    address!.toLowerCase() === creatorAddress.toLowerCase();

  useEffect(() => {
    let cancelled = false;

    async function loadOnchainData() {
      setLoading(true);
      setError("");

      try {
        const id = BigInt(bountyId);

        const payoutAmounts: any = await publicClient.readContract({
          address: ARC_BOUNTY_ADDRESS,
          abi,
          functionName: "getPayoutAmounts",
          args: [id],
        });

        const tiers = await Promise.all(
          (payoutAmounts as bigint[]).map(async (_, index) => {
            try {
              return Boolean(
                await publicClient.readContract({
                  address: ARC_BOUNTY_ADDRESS,
                  abi,
                  functionName: "tierPaid",
                  args: [id, BigInt(index)],
                })
              );
            } catch {
              return false;
            }
          })
        );

        if (cancelled) return;

        setAmounts(payoutAmounts as bigint[]);
        setPaidTiers(tiers);

        const firstAvailable = tiers.findIndex((paid) => !paid);
        if (firstAvailable >= 0) {
          setSelectedTier(String(firstAvailable));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load payout information from Arc."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOnchainData();

    return () => {
      cancelled = true;
    };
  }, [bountyId]);



  async function review(action: "approve" | "reject") {
    setError("");
    setMessage("");

    if (!isConnected || !address) {
      setError("Connect the creator wallet first.");
      return;
    }

    if (!isCreator) {
      setError("Only the wallet that created this bounty can review submissions.");
      return;
    }

    if (!onchainSubmissionId || !/^\d+$/.test(onchainSubmissionId)) {
      setError("This submission is missing its on-chain submission ID.");
      return;
    }

    if (!/^\d+$/.test(bountyId)) {
      setError("Invalid on-chain bounty ID.");
      return;
    }

    if (action === "approve") {
      const tier = Number(selectedTier);

      if (
        !Number.isInteger(tier) ||
        tier < 0 ||
        tier >= amounts.length ||
        paidTiers[tier]
      ) {
        setError("Select an available payout tier.");
        return;
      }

      const confirmed = window.confirm(
        `Approve this submission and pay ${formatUnits(amounts[tier], 6)} USDC from the bounty escrow using payout tier ${tier + 1}?`
      );

      if (!confirmed) return;
    } else {
      if (
        !window.confirm(
          "Reject this submission on Arc Mainnet? This will not pay the contributor."
        )
      ) {
        return;
      }
    }

    setBusy(true);

    try {
      if (chainId !== arcMainnet.id) {
        await switchChainAsync({ chainId: arcMainnet.id });
      }

      if (!walletClient) {
        throw new Error("Wallet unavailable. Reconnect your wallet and try again.");
      }

      let transactionHash: `0x${string}`;

      if (action === "approve") {
        transactionHash = await walletClient.writeContract({
          address: ARC_BOUNTY_ADDRESS,
          abi,
          functionName: "approveSubmission",
          args: [
            BigInt(bountyId),
            BigInt(onchainSubmissionId),
            BigInt(selectedTier),
          ],
          chain: arcMainnet,
          account: address,
        } as any);
      } else {
        transactionHash = await walletClient.writeContract({
          address: ARC_BOUNTY_ADDRESS,
          abi,
          functionName: "rejectSubmission",
          args: [
            BigInt(bountyId),
            BigInt(onchainSubmissionId),
          ],
          chain: arcMainnet,
          account: address,
        } as any);
      }

      setMessage("Transaction submitted. Waiting for Arc Mainnet confirmation...");

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: transactionHash,
      });

      if (receipt.status !== "success") {
        throw new Error("The on-chain review transaction failed.");
      }

      const response = await fetch("/api/submissions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          bountyId,
          action,
          transactionHash,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "The transaction succeeded, but the marketplace record could not be updated."
        );
      }

      setMessage(
        action === "approve"
          ? "Submission approved and payout confirmed on Arc."
          : "Submission rejected on Arc."
      );

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Review failed. Check your wallet and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-slate-500">
        Loading payout tiers from Arc Mainnet...
      </p>
    );
  }

  return (
    <div className="w-full space-y-4">
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {isConnected && !isCreator && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Connect the wallet that created this bounty to review submissions.
        </p>
      )}

      {!isConnected && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Connect the bounty creator's wallet to review this submission.
          </p>
          <WalletButton />
        </div>
      )}

      {isConnected && isCreator && (
        <>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Payout tier
            </span>

            <select
              value={selectedTier}
              onChange={(event) => setSelectedTier(event.target.value)}
              disabled={busy || amounts.every((_, index) => paidTiers[index])}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
            >
              {amounts.map((amount, index) => (
                <option
                  key={index}
                  value={String(index)}
                  disabled={Boolean(paidTiers[index])}
                >
                  Tier {index + 1} — {formatUnits(amount, 6)} USDC
                  {paidTiers[index] ? " (already paid)" : ""}
                </option>
              ))}
            </select>
          </label>

          {amounts.length > 0 &&
            amounts.every((_, index) => paidTiers[index]) && (
              <p className="text-sm text-amber-700">
                All payout tiers have been used. No further payouts are available.
              </p>
            )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => review("reject")}
              className="rounded-xl border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {busy ? "Processing..." : "Reject"}
            </button>

            <button
              type="button"
              disabled={
                busy ||
                amounts.length === 0 ||
                paidTiers.every(Boolean)
              }
              onClick={() => review("approve")}
              className="rounded-xl bg-[#1747c8] px-5 py-3 text-sm font-semibold text-white hover:bg-[#123aa5] disabled:opacity-50"
            >
              {busy ? "Processing..." : "Approve & Pay"}
            </button>
          </div>
        </>
      )}

      {message && (
        <p className="break-words rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </p>
      )}

      {error && (
        <p className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
