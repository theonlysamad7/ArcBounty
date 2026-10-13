"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createPublicClient,
  formatUnits,
  parseUnits,
  http,
  type Address,
} from "viem";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import {
  arc,
} from "../../../../lib/wagmi";
import {
  ARC_BOUNTY_ADDRESS,
  arcBountyAbiConfig,
} from "../../../../lib/arcBounty";
import WalletButton from "../../../../components/WalletButton";

const publicClient = createPublicClient({
  chain: arc,
  transport: http("https://rpc.mainnet.arc.io"),
});

type BountyInfo = {
  creator: Address;
  reward: bigint;
  deadline: bigint;
  status: number;
  title: string;
  description: string;
};

type PageState = "loading" | "ready" | "error";

export default function SubmitBountyPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const [bounty, setBounty] = useState<BountyInfo | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [pageError, setPageError] = useState("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [proof, setProof] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [txHash, setTxHash] = useState("");

  const bountyId =
    /^\d+$/.test(id || "") ? BigInt(id) : null;

  const isCreator =
    !!address &&
    !!bounty &&
    address.toLowerCase() === bounty.creator.toLowerCase();

  const loadBounty = useCallback(async () => {
    if (bountyId === null) {
      setPageError("This bounty ID is invalid.");
      setPageState("error");
      return;
    }

    try {
      setPageState("loading");
      setPageError("");

      const result = await publicClient.readContract({
        address: ARC_BOUNTY_ADDRESS,
        abi: arcBountyAbiConfig,
        functionName: "bounties",
        args: [bountyId],
      });

      const [
        returnedId,
        creator,
        reward,
        deadline,
        status,
        bountyTitle,
        bountyDescription,
      ] = result as [
        bigint,
        Address,
        bigint,
        bigint,
        number,
        string,
        string,
      ];

      if (
        returnedId === BigInt(0) ||
        creator.toLowerCase() ===
          "0x0000000000000000000000000000000000000000"
      ) {
        throw new Error("This bounty could not be found on Arc Mainnet.");
      }

      setBounty({
        creator,
        reward,
        deadline,
        status: Number(status),
        title: bountyTitle,
        description: bountyDescription,
      });

      setPageState("ready");
    } catch (rpcError) {
      try {
        const response = await fetch(
          `/api/bounties/${encodeURIComponent(String(bountyId))}`,
          { cache: "no-store" }
        );
        const payload = await response.json();

        if (!response.ok || !payload?.bounty) {
          throw new Error("Saved bounty details are unavailable.");
        }

        const saved = payload.bounty;
        const creator = String(saved.creator ?? "");
        const title = String(saved.title ?? "").trim();
        const description = String(saved.description ?? "");
        const rewardText = String(saved.reward ?? "")
          .replace(/\s*USDC\s*$/i, "")
          .trim();
        const deadlineMs = new Date(String(saved.deadline ?? "")).getTime();

        if (
          !/^0x[a-fA-F0-9]{40}$/.test(creator) ||
          !title ||
          !/^\d+(\.\d{1,6})?$/.test(rewardText) ||
          !Number.isFinite(deadlineMs)
        ) {
          throw new Error("Saved bounty details are invalid.");
        }

        setBounty({
          creator: creator as Address,
          reward: parseUnits(rewardText, 6),
          deadline: BigInt(Math.floor(deadlineMs / 1000)),
          status: String(saved.status).toLowerCase() === "open" ? 0 : 1,
          title,
          description,
        });
        setPageError("");
        setPageState("ready");
      } catch (fallbackError) {
        setPageError(
          fallbackError instanceof Error
            ? fallbackError.message
            : rpcError instanceof Error
              ? rpcError.message
              : "Unable to load this bounty."
        );
        setPageState("error");
      }
    }
  }, [bountyId]);

  useEffect(() => {
    void loadBounty();
  }, [loadBounty]);

  useEffect(() => {
    let cancelled = false;

    async function checkSubmission() {
      setAlreadySubmitted(false);

      if (!address || bountyId === null) return;

      try {
        const submitted = await publicClient.readContract({
          address: ARC_BOUNTY_ADDRESS,
          abi: arcBountyAbiConfig,
          functionName: "hasSubmitted",
          args: [bountyId, address],
        });

        if (!cancelled) {
          setAlreadySubmitted(Boolean(submitted));
        }
      } catch {
        if (!cancelled) {
          setAlreadySubmitted(false);
        }
      }
    }

    void checkSubmission();

    return () => {
      cancelled = true;
    };
  }, [address, bountyId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setTxHash("");

    if (!isConnected || !address || !walletClient) {
      setMessage("Connect your wallet before submitting work.");
      return;
    }

    if (!bounty || bountyId === null) {
      setMessage("Bounty details are not available yet.");
      return;
    }

    if (chainId !== 5042) {
      try {
        await switchChainAsync({ chainId: 5042 });
      } catch {
        setMessage("Please switch your wallet to Arc Mainnet to continue.");
        return;
      }
    }

    if (isCreator) {
      setMessage("You created this bounty and cannot submit work to it.");
      return;
    }

    if (alreadySubmitted) {
      setMessage("This wallet has already submitted work to this bounty.");
      return;
    }

    if (bounty.status !== 0) {
      setMessage("This bounty is no longer open for submissions.");
      return;
    }

    if (BigInt(Math.floor(Date.now() / 1000)) >= bounty.deadline) {
      setMessage("The submission deadline has passed.");
      return;
    }

    let proofUrl: URL;

    try {
      proofUrl = new URL(proof.trim());

      if (!["http:", "https:"].includes(proofUrl.protocol)) {
        throw new Error("Invalid URL");
      }
    } catch {
      setMessage("Enter a valid proof link starting with https:// or http://.");
      return;
    }

    const combinedProof = [
      `Title: ${title.trim()}`,
      "",
      `Description: ${description.trim()}`,
      "",
      `Proof: ${proofUrl.toString()}`,
    ].join("\n");

    if (!title.trim() || !description.trim() || !proof.trim()) {
      setMessage("Complete all fields before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("Please confirm the submission transaction in your wallet.");

      const activeWalletClient =
        chainId === 5042
          ? walletClient
          : await (async () => {
              const refreshed = await publicClient.getChainId();
              if (refreshed !== 5042) {
                throw new Error("Arc Mainnet connection could not be verified.");
              }
              return walletClient;
            })();

      const hash = await activeWalletClient.writeContract({
        address: ARC_BOUNTY_ADDRESS,
        abi: arcBountyAbiConfig,
        functionName: "submitWork",
        args: [bountyId, combinedProof],
        account: address,
        chain: arc,
      });

      setTxHash(hash);
      setMessage("Transaction sent. Waiting for Arc Mainnet confirmation…");

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status !== "success") {
        throw new Error("The transaction reverted on Arc Mainnet.");
      }

      setAlreadySubmitted(true);
      setMessage("Transaction confirmed. Saving your submission to the marketplace…");

      let syncResponse;
      let syncData: { error?: string } = {};

      try {
        syncResponse = await fetch("/api/submissions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bountyId: bountyId.toString(),
            walletAddress: address,
            transactionHash: hash,
            title: title.trim(),
            description: description.trim(),
            proof: proofUrl.toString(),
          }),
        });

        syncData = await syncResponse.json().catch(() => ({}));
      } catch {
        setMessage(
          "Your work is confirmed on Arc Mainnet, but marketplace syncing failed. Your on-chain submission remains recorded. Transaction: " + hash
        );
        setTitle("");
        setDescription("");
        setProof("");
        return;
      }

      if (!syncResponse.ok) {
        setMessage(
          "Your work is confirmed on Arc Mainnet, but marketplace syncing failed: " +
          (syncData.error || "Please contact the bounty creator with your transaction hash.") +
          " Transaction: " + hash
        );
        setTitle("");
        setDescription("");
        setProof("");
        return;
      }

      setMessage("Your work has been submitted on Arc Mainnet and saved to the marketplace.");
      setTitle("");
      setDescription("");
      setProof("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The submission transaction failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const deadlinePassed =
    !!bounty &&
    BigInt(Math.floor(Date.now() / 1000)) >= bounty.deadline;

  const canSubmit =
    !!bounty &&
    bounty.status === 0 &&
    !deadlinePassed &&
    !isCreator &&
    !alreadySubmitted;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-slate-900"
          >
            Arc<span className="text-[#1747c8]">Bounty</span>
          </Link>

          <div className="flex items-center gap-2">
            <WalletButton />
            <Link
              href={`/bounties/${id}`}
              className="hidden rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
            >
              ← Back to Bounty
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {pageState === "loading" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-600">
              Loading bounty details from Arc Mainnet…
            </p>
          </div>
        )}

        {pageState === "error" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <h1 className="font-bold text-red-900">
              Unable to load bounty
            </h1>
            <p className="mt-2 break-words text-sm text-red-800">
              {pageError}
            </p>
            <button
              type="button"
              onClick={() => void loadBounty()}
              className="mt-4 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        )}

        {pageState === "ready" && bounty && (
          <>
            <div className="mb-7">
              <p className="text-sm font-semibold text-[#1747c8]">
                Submit your work
              </p>

              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                {bounty.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {formatUnits(bounty.reward, 6)} USDC reward
                </span>

                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Arc Mainnet
                </span>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  On-chain bounty #{id}
                </span>
              </div>

              {bounty.description && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="text-sm font-bold">Bounty description</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {bounty.description}
                  </p>
                </div>
              )}
            </div>

            {isCreator && (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h2 className="font-bold text-amber-900">
                  You created this bounty
                </h2>
                <p className="mt-2 text-sm leading-6 text-amber-800">
                  The creator cannot submit work to their own bounty. You can
                  review submissions from other contributors instead.
                </p>
              </div>
            )}

            {!isCreator && alreadySubmitted && (
              <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <h2 className="font-bold text-blue-900">
                  Submission already recorded
                </h2>
                <p className="mt-2 text-sm leading-6 text-blue-800">
                  This wallet has already submitted work to this bounty.
                  The contract permits one submission per wallet per bounty.
                </p>
              </div>
            )}

            {bounty.status !== 0 && (
              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-100 p-5">
                <h2 className="font-bold">Bounty is not open</h2>
                <p className="mt-2 text-sm text-slate-600">
                  This bounty is no longer accepting submissions.
                </p>
              </div>
            )}

            {!isCreator && deadlinePassed && bounty.status === 0 && (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h2 className="font-bold text-amber-900">
                  Submission deadline passed
                </h2>
                <p className="mt-2 text-sm text-amber-800">
                  This bounty is no longer accepting submissions.
                </p>
              </div>
            )}

            {canSubmit && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                  <h2 className="text-sm font-bold text-slate-900">
                    Submission requirements
                  </h2>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">
                    Describe what you completed and provide a working link so
                    the bounty creator can review your work.
                  </p>
                </div>

                {!isConnected && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Connect your wallet before submitting work.
                  </div>
                )}

                {isConnected && chainId !== 5042 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Your wallet must be connected to Arc Mainnet. You will be
                    asked to switch networks when you submit.
                  </div>
                )}

                <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                  <div>
                    <label
                      htmlFor="title"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Submission title
                    </label>
                    <input
                      id="title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      required
                      maxLength={120}
                      placeholder="Give your submission a clear title"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1747c8] focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="description"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Describe your work
                    </label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={7}
                      required
                      maxLength={5000}
                      placeholder="Explain what you completed and anything the reviewer should know..."
                      className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-[#1747c8] focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="proof"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Proof / link
                    </label>
                    <input
                      id="proof"
                      type="url"
                      value={proof}
                      onChange={(event) => setProof(event.target.value)}
                      required
                      placeholder="https://github.com/... or https://..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1747c8] focus:ring-2 focus:ring-blue-100"
                    />
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Add a repository, document, demo, or another link that
                      demonstrates your work.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    Before submitting
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    Check that your submission is complete and your proof link
                    works. Submitting requires a wallet transaction and Arc
                    Mainnet gas funds.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !isConnected}
                  className="w-full rounded-xl bg-[#1747c8] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#123aa5] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? "Submitting on Arc Mainnet…"
                    : "Submit Work On-chain →"}
                </button>
              </form>
            )}

            {message && (
              <div
                aria-live="polite"
                className="mt-5 break-words rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700"
              >
                {message}

                {txHash && (
                  <p className="mt-3">
                    <a
                      href={`https://explorer.arc.io/tx/${txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[#1747c8] underline"
                    >
                      View transaction on Arc Explorer
                    </a>
                  </p>
                )}
              </div>
            )}

            <p className="mt-5 text-center text-xs leading-5 text-slate-500">
              Submissions are recorded on Arc Mainnet. Rewards are released
              only after the creator reviews and approves eligible work.
            </p>
          </>
        )}

        <div className="mt-6 sm:hidden">
          <Link
            href={`/bounties/${id}`}
            className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
          >
            ← Back to Bounty
          </Link>
        </div>
      </div>
    </main>
  );
}
