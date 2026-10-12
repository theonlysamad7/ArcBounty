"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  createPublicClient,
  http,
  parseEventLogs,
  parseUnits,
  type Address,
} from "viem";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import WalletButton from "../../components/WalletButton";
import {
  arcMainnet,
  ARC_BOUNTY_ADDRESS,
  ARC_USDC_ADDRESS,
} from "../../lib/arcBounty";

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

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

const publicClient = createPublicClient({
  chain: arcMainnet,
  transport: http("https://rpc.mainnet.arc.io"),
});

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1747c8] focus:ring-2 focus:ring-blue-100";

function getOrdinal(index: number) {
  if (index === 0) return "1st place";
  if (index === 1) return "2nd place";
  if (index === 2) return "3rd place";
  return `${index + 1}th place`;
}

export default function CreateBountyPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const [winnerCount, setWinnerCount] = useState(1);
  const [distribution, setDistribution] = useState<"equal" | "custom">("equal");
  const [rewardAmount, setRewardAmount] = useState("");
  const [percentages, setPercentages] = useState<number[]>([100]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [createdBountyId, setCreatedBountyId] = useState<string | null>(null);

  const percentageTotal = percentages.reduce((sum, value) => sum + value, 0);
  const totalReward = Number(rewardAmount) || 0;

  function updateWinnerCount(value: number) {
    const count = Math.max(1, Math.min(100, value || 1));
    setWinnerCount(count);
    const base = Math.floor(100 / count);

    setPercentages(
      Array.from({ length: count }, (_, index) =>
        index === count - 1 ? 100 - base * (count - 1) : base
      )
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    setCreatedBountyId(null);

    if (!isConnected || !address) {
      setErrorMessage("Connect your wallet before creating a bounty.");
      return;
    }

    if (chainId !== 5042) {
      try {
        switchChain({ chainId: 5042 });
        setErrorMessage(
          "Switch to Arc Mainnet, then submit the form again."
        );
      } catch {
        setErrorMessage("Please switch your wallet to Arc Mainnet.");
      }
      return;
    }

    if (!walletClient) {
      setErrorMessage("Your wallet is not ready. Reconnect and try again.");
      return;
    }

    if (!title.trim() || !category || !description.trim()) {
      setErrorMessage("Complete the required bounty details.");
      return;
    }

    if (!Number.isFinite(Number(rewardAmount)) || totalReward < winnerCount) {
      setErrorMessage("Enter at least 1 USDC per winner.");
      return;
    }

    if (!/^\d+(\.\d{1,6})?$/.test(rewardAmount)) {
      setErrorMessage("Use a valid USDC amount with at most 6 decimal places.");
      return;
    }

    if (distribution === "custom" && percentageTotal !== 100) {
      setErrorMessage("Custom percentages must add up to exactly 100%.");
      return;
    }

    if (
      distribution === "custom" &&
      percentages.some((value) => !Number.isInteger(value) || value <= 0)
    ) {
      setErrorMessage("Every custom percentage must be a positive whole number.");
      return;
    }

    const deadlineSeconds = Math.floor(new Date(deadline).getTime() / 1000);

    if (
      !deadline ||
      !Number.isFinite(deadlineSeconds) ||
      deadlineSeconds <= Math.floor(Date.now() / 1000)
    ) {
      setErrorMessage("Choose a deadline in the future.");
      return;
    }

    const reward = parseUnits(rewardAmount, 6);

    const balance = await publicClient.readContract({
      address: ARC_USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address as Address],
    });

    if (balance < reward) {
      setErrorMessage(`Insufficient USDC balance. You need ${rewardAmount} USDC, but your wallet has ${Number(balance) / 1_000_000} USDC.`);
      return;
    }

    if (reward < BigInt(winnerCount)) {
      setErrorMessage("The reward must be at least 1 USDC per winner.");
      return;
    }

    const descriptionOnChain = [
      `Category: ${category}`,
      "",
      description.trim(),
      requirements.trim()
        ? `\n\nRequirements:\n${requirements.trim()}`
        : "",
    ].join("\n");

    const percentagesBps =
      distribution === "custom"
        ? percentages.map((value) => value * 100)
        : [];

    setBusy(true);
    try {
      setStatusMessage("Checking USDC allowance…");

      const allowance = await publicClient.readContract({
        address: ARC_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address as Address, ARC_BOUNTY_ADDRESS],
      });

      if (allowance < reward) {
        setStatusMessage("Approve USDC spending in your wallet…");

        const approvalHash = await walletClient.writeContract({
          account: address,
          chain: arcMainnet,
          address: ARC_USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [ARC_BOUNTY_ADDRESS, reward],
        });

        setStatusMessage("Waiting for USDC approval confirmation…");

        const approvalReceipt =
          await publicClient.waitForTransactionReceipt({
            hash: approvalHash,
          });

        if (approvalReceipt.status !== "success") {
          throw new Error("The USDC approval transaction failed.");
        }
      }

      setStatusMessage("Confirm bounty creation in your wallet…");

      const creationHash = await walletClient.writeContract({
        account: address,
        chain: arcMainnet,
        address: ARC_BOUNTY_ADDRESS,
        abi: bountyAbi,
        functionName: "createBounty",
        args: [
          reward,
          BigInt(deadlineSeconds),
          title.trim(),
          descriptionOnChain,
          BigInt(winnerCount),
          percentagesBps,
        ],
      });

      setStatusMessage("Waiting for Arc Mainnet confirmation…");

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: creationHash,
      });

      if (receipt.status !== "success") {
        throw new Error("The bounty creation transaction failed.");
      }

      const events = parseEventLogs({
        abi: bountyAbi,
        logs: receipt.logs,
        eventName: "BountyCreated",
        strict: false,
      });

      const createdEvent = events.find(
        (log) =>
          log.address.toLowerCase() === ARC_BOUNTY_ADDRESS.toLowerCase() &&
          log.args.creator?.toLowerCase() === address.toLowerCase()
      );

      if (!createdEvent || createdEvent.args.bountyId === undefined) {
        setStatusMessage(
          `Transaction confirmed. Check it on Arc Explorer: https://explorer.arc.io/tx/${creationHash}`
        );
        return;
      }

      const bountyId = createdEvent.args.bountyId.toString();

      setCreatedBountyId(bountyId);
      setStatusMessage(
        "Your bounty has been created and its USDC reward is escrowed."
      );
    } catch (error) {
      console.error("Bounty creation failed:", error);

      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

      if (/user rejected|user denied|rejected the request/i.test(message)) {
        setErrorMessage(
          "Transaction cancelled in your wallet. Your form details are still here."
        );
      } else {
        setErrorMessage(message.slice(0, 450));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
            Arc<span className="text-[#1747c8]">Bounty</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
            >
              ← Back to Bounties
            </Link>
            <WalletButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-7">
          <p className="text-sm font-semibold text-[#1747c8]">
            Creator dashboard
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Create a Bounty
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Publish a task and escrow its USDC reward on Arc Mainnet.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6">
              <h2 className="text-base font-bold">Bounty details</h2>
              <p className="mt-1 text-xs text-slate-500">
                Give contributors enough information to understand the task.
              </p>
            </div>

            <div>
              <label htmlFor="title" className="mb-2 block text-sm font-semibold">
                Bounty title
              </label>
              <input
                id="title"
                type="text"
                required
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Build an Arc wallet integration"
                className={inputClass}
              />
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="category" className="mb-2 block text-sm font-semibold">
                  Category
                </label>
                <select
                  id="category"
                  required
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className={inputClass}
                >
                  <option value="" disabled>Select category</option>
                  <option value="Development">Development</option>
                  <option value="Design">Design</option>
                  <option value="Writing">Writing</option>
                  <option value="Research">Research</option>
                  <option value="Bug Hunt">Bug Hunt</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="reward" className="mb-2 block text-sm font-semibold">
                  Reward (USDC)
                </label>
                <input
                  id="reward"
                  placeholder="Enter reward amount"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={rewardAmount}
                  onChange={(event) => setRewardAmount(event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="winnerCount" className="mb-2 block text-sm font-semibold">
                    Number of winners
                  </label>
                  <input
                    id="winnerCount"
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={winnerCount}
                    onChange={(event) => updateWinnerCount(Number(event.target.value))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="distribution" className="mb-2 block text-sm font-semibold">
                    Reward distribution
                  </label>
                  <select
                    id="distribution"
                    value={distribution}
                    onChange={(event) =>
                      setDistribution(event.target.value as "equal" | "custom")
                    }
                    className={inputClass}
                  >
                    <option value="equal">Equal split</option>
                    <option value="custom">Custom percentages</option>
                  </select>
                </div>
              </div>

              {distribution === "custom" && (
                <div className="mt-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Set each winner&apos;s percentage
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      All percentages must add up to 100%.
                    </p>
                  </div>

                  {percentages.map((percentage, index) => (
                    <div key={index} className="grid grid-cols-2 items-center gap-3">
                      <label
                        htmlFor={`percentage-${index}`}
                        className="text-sm text-slate-700"
                      >
                        {getOrdinal(index)}
                      </label>
                      <div className="relative">
                        <input
                          id={`percentage-${index}`}
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          required
                          value={percentage}
                          onChange={(event) => {
                            const next = [...percentages];
                            next[index] = Number(event.target.value);
                            setPercentages(next);
                          }}
                          className={`${inputClass} pr-8`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                          %
                        </span>
                      </div>
                    </div>
                  ))}

                  <p className={
                    percentageTotal === 100
                      ? "text-xs font-semibold text-emerald-700"
                      : "text-xs font-semibold text-red-600"
                  }>
                    Total: {percentageTotal}%{" "}
                    {percentageTotal === 100 ? "✓" : "— must equal 100%"}
                  </p>
                </div>
              )}

              <div className="mt-5 rounded-lg bg-white p-3">
                <h3 className="text-sm font-semibold text-slate-800">
                  Payout preview
                </h3>
                <div className="mt-2 space-y-2">
                  {Array.from({ length: winnerCount }, (_, index) => {
                    const share =
                      distribution === "equal"
                        ? totalReward / winnerCount
                        : totalReward * (percentages[index] || 0) / 100;

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="text-slate-600">
                          {getOrdinal(index)}
                          {distribution === "custom"
                            ? ` · ${percentages[index] || 0}%`
                            : ""}
                        </span>
                        <span className="font-semibold text-slate-900">
                          {share.toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })}{" "}
                          USDC
                        </span>
                      </div>
                    );
                  })}
                </div>
                {distribution === "equal" && totalReward % winnerCount !== 0 && (
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Any smallest-unit rounding remainder is handled by the smart contract.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6">
              <label htmlFor="deadline" className="mb-2 block text-sm font-semibold">
                Submission deadline
              </label>
              <input
                id="deadline"
                type="datetime-local"
                required
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                className={inputClass}
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Contributors must submit their work before this deadline.
              </p>
            </div>

            <div className="mt-5">
              <label htmlFor="description" className="mb-2 block text-sm font-semibold">
                Task description
              </label>
              <textarea
                id="description"
                required
                rows={5}
                maxLength={4000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Explain what needs to be done, what you expect, and how the work will be evaluated."
                className={inputClass}
              />
              <p className="mt-1 text-right text-xs text-slate-400">
                {description.length}/4000
              </p>
            </div>

            <div className="mt-5">
              <label htmlFor="requirements" className="mb-2 block text-sm font-semibold">
                Additional requirements
                <span className="ml-2 font-normal text-slate-400">Optional</span>
              </label>
              <textarea
                id="requirements"
                rows={3}
                maxLength={1500}
                value={requirements}
                onChange={(event) => setRequirements(event.target.value)}
                placeholder="Include submission instructions, links, or required formats."
                className={inputClass}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <h2 className="font-bold text-blue-950">USDC escrow on Arc Mainnet</h2>
            <p className="mt-2 text-sm leading-6 text-blue-900">
              Creating this bounty requires a wallet connected to Arc Mainnet,
              enough USDC to fund the full reward, and native gas funds.
              Your wallet will request USDC approval if needed, followed by
              the bounty creation transaction.
            </p>
            <p className="mt-2 text-xs leading-5 text-blue-800">
              Review the reward and distribution carefully before confirming
              transactions in your wallet.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="break-words rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
            >
              {errorMessage}
            </div>
          )}

          {statusMessage && (
            <div
              role="status"
              className="break-words rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700"
            >
              {statusMessage}
            </div>
          )}

          {createdBountyId && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-semibold text-emerald-800">
                Bounty created successfully!
              </p>
              <p className="mt-1 text-sm text-emerald-700">
                Bounty ID: {createdBountyId}
              </p>
              <Link
                href={`/bounties/${createdBountyId}`}
                className="mt-3 inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                View your bounty
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || Boolean(createdBountyId)}
            className="flex w-full items-center justify-center rounded-xl bg-[#1747c8] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy
              ? "Processing transaction…"
              : createdBountyId
                ? "Bounty Created"
                : "Create Bounty & Escrow USDC"}
          </button>

          <p className="text-center text-xs leading-5 text-slate-500">
            Transactions are submitted to Arc Mainnet and require wallet confirmation.
          </p>
        </form>
      </div>
    </main>
  );
}
