"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { formatUnits } from "viem";
import { arc } from "../lib/wagmi";
import {
  ARC_BOUNTY_ADDRESS,
  arcBountyAbiConfig,
} from "../lib/arcBounty";
import WalletButton from "./WalletButton";

type Props = {
  bountyId: string;
  creatorAddress: string;
  deadline: string;
};

export default function BountyActions({
  bountyId,
  creatorAddress,
  deadline,
}: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const expired = Date.now() >= new Date(deadline).getTime();
  const isCreator =
    Boolean(address) &&
    address!.toLowerCase() === creatorAddress.toLowerCase();

  const {
    data: unresolvedRaw,
    isLoading: unresolvedLoading,
    isError: unresolvedError,
    refetch: refetchUnresolved,
  } = useReadContract({
    address: ARC_BOUNTY_ADDRESS,
    abi: arcBountyAbiConfig,
    functionName: "unresolvedSubmissionCount",
    args: [BigInt(bountyId)],
    query: {
      enabled: expired && isConnected && isCreator,
      refetchOnWindowFocus: true,
    },
  });

  const {
    data: remainingRaw,
    isLoading: remainingLoading,
    isError: remainingError,
    refetch: refetchRemaining,
  } = useReadContract({
    address: ARC_BOUNTY_ADDRESS,
    abi: arcBountyAbiConfig,
    functionName: "remainingReward",
    args: [BigInt(bountyId)],
    query: {
      enabled: expired && isConnected && isCreator,
      refetchOnWindowFocus: true,
    },
  });

  const {
    isLoading: isConfirming,
    isSuccess: refundConfirmed,
  } = useWaitForTransactionReceipt({
    chainId: arc.id,
    hash: txHash,
  });

  const unresolved =
    typeof unresolvedRaw === "bigint" ? unresolvedRaw : undefined;

  const remaining =
    typeof remainingRaw === "bigint" ? remainingRaw : undefined;

  const refundDataLoading =
    unresolvedLoading || remainingLoading;

  const refundDataError =
    unresolvedError || remainingError;

  const refundEligible =
    expired &&
    isCreator &&
    unresolved === BigInt(0) &&
    remaining !== undefined &&
    remaining > BigInt(0);

  async function claimRefund() {
    setError("");

    if (!isConnected || !address) {
      setError("Connect the bounty creator's wallet first.");
      return;
    }

    if (!isCreator) {
      setError("Only the bounty creator can claim this refund.");
      return;
    }

    if (!expired) {
      setError("The bounty deadline has not passed.");
      return;
    }

    if (chainId !== arc.id) {
      try {
        await switchChain({ chainId: arc.id });
      } catch {
        setError("Switch your wallet to Arc Mainnet, then try again.");
      }
      return;
    }

    const [unresolvedResult, remainingResult] = await Promise.all([
      refetchUnresolved(),
      refetchRemaining(),
    ]);

    const currentUnresolved = unresolvedResult.data;
    const currentRemaining = remainingResult.data;

    if (
      typeof currentUnresolved !== "bigint" ||
      typeof currentRemaining !== "bigint"
    ) {
      setError("Unable to verify refund eligibility on Arc Mainnet. Please try again.");
      return;
    }

    if (currentUnresolved > BigInt(0)) {
      setError(
        `${currentUnresolved.toString()} submission(s) still need to be approved or rejected before you can claim the refund.`
      );
      return;
    }

    if (currentRemaining <= BigInt(0)) {
      setError("No remaining USDC is available to refund.");
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: ARC_BOUNTY_ADDRESS,
        abi: arcBountyAbiConfig,
        functionName: "claimRefund",
        args: [BigInt(bountyId)],
        chainId: arc.id,
      });

      setTxHash(hash);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "The refund transaction failed.";

      if (/UnresolvedSubmissions|unresolved submissions/i.test(message)) {
        setError(
          "Some submissions are still unresolved. Approve or reject every pending submission first."
        );
      } else if (/DeadlineNotPassed/i.test(message)) {
        setError("The bounty deadline has not passed yet.");
      } else if (/NotCreator/i.test(message)) {
        setError("Only the bounty creator can claim this refund.");
      } else if (/BountyNotActive/i.test(message)) {
        setError("This bounty is no longer active.");
      } else if (/reject|denied|user cancel/i.test(message)) {
        setError("The transaction was cancelled in your wallet.");
      } else {
        setError(message.slice(0, 240));
      }
    }
  }

  if (refundConfirmed) {
    return (
      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-800">
          Refund confirmed on Arc Mainnet.
        </p>
        {txHash && (
          <a
            href={`https://explorer.arc.io/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm font-semibold text-emerald-800 underline"
          >
            View refund transaction ↗
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="mt-5">
      {!expired ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
          <h3 className="text-base font-bold text-slate-900">
            Ready to contribute?
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Connect your wallet to submit your work on Arc Mainnet.
          </p>

          {!isConnected ? (
            <div className="mt-4">
              <WalletButton />
            </div>
          ) : isCreator ? (
            <p className="mt-4 text-sm font-medium text-slate-600">
              You created this bounty. Another wallet must submit the work.
            </p>
          ) : (
            <Link
              href={`/bounties/${bountyId}/submit`}
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#1747c8] px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              Submit Work
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Submission deadline has passed
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-800">
            New submissions are closed for this bounty.
          </p>
        </div>
      )}

      {expired && isConnected && isCreator && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-bold text-slate-900">
            Remaining escrow
          </h3>

          {refundDataLoading ? (
            <p className="mt-2 text-sm text-slate-600">
              Checking refund eligibility on Arc Mainnet…
            </p>
          ) : refundDataError ? (
            <p className="mt-2 text-sm leading-6 text-red-700">
              Unable to read the refund conditions. Refresh the page and try again.
            </p>
          ) : unresolved !== undefined && unresolved > BigInt(0) ? (
            <p className="mt-2 text-sm leading-6 text-amber-800">
              {unresolved.toString()} submission(s) still need to be resolved.
              Approve or reject each pending submission before claiming a refund.
            </p>
          ) : remaining !== undefined && remaining === BigInt(0) ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              There is no remaining USDC to refund.
            </p>
          ) : refundEligible && remaining !== undefined ? (
            <>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                All submissions are resolved. The remaining escrow available
                for refund is{" "}
                <strong>{formatUnits(remaining, 6)} USDC</strong>.
              </p>

              <button
                type="button"
                onClick={claimRefund}
                disabled={isSwitching || isWriting || isConfirming}
                className="mt-4 flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSwitching
                  ? "Switching network..."
                  : isWriting
                    ? "Confirm in wallet..."
                    : isConfirming
                      ? "Confirming refund..."
                      : "Claim Refund"}
              </button>
            </>
          ) : (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Refund eligibility could not be confirmed. Refresh the page and try again.
            </p>
          )}

          {chainId !== arc.id && (
            <p className="mt-2 text-xs text-slate-500">
              This transaction requires Arc Mainnet.
            </p>
          )}

          {error && (
            <p className="mt-3 break-words text-sm leading-5 text-red-700">
              {error}
            </p>
          )}

          {txHash && !refundConfirmed && (
            <a
              href={`https://explorer.arc.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm font-semibold text-blue-700 underline"
            >
              View pending transaction ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
