"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import {
  createPublicClient,
  formatUnits,
  http,
  parseAbiItem,
  type Address,
} from "viem";
import WalletButton from "../../components/WalletButton";
import {
  arcMainnet,
  ARC_BOUNTY_ADDRESS,
  arcBountyAbiConfig,
} from "../../lib/arcBounty";

type BountyItem = {
  id: string;
  title: string;
  description: string;
  creator: Address;
  reward: bigint;
  remainingReward: bigint;
  deadline: bigint;
  status: number;
  submissions: number;
};

type SubmissionItem = {
  id: string;
  bountyId: string;
  bountyTitle: string;
  proof: string;
  resolved: boolean;
  status: "Pending Review" | "Approved" | "Rejected" | "Resolved";
  reward: bigint;
};

const client = createPublicClient({
  chain: arcMainnet,
  transport: http("https://rpc.mainnet.arc.io"),
});

const bountyAddress = ARC_BOUNTY_ADDRESS as Address;

const winnerPaidEvent = parseAbiItem(
  "event WinnerPaid(uint256 indexed bountyId, uint256 indexed tier, uint256 indexed submissionId, address contributor, uint256 amount)"
);

const approvedEvent = parseAbiItem(
  "event SubmissionApproved(uint256 indexed bountyId, uint256 indexed submissionId, address indexed contributor, uint256 reward)"
);

const rejectedEvent = parseAbiItem(
  "event SubmissionRejected(uint256 indexed bountyId, uint256 indexed submissionId, address indexed contributor)"
);

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatUsdc(amount: bigint) {
  return Number(formatUnits(amount, 6)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusStyle(status: SubmissionItem["status"]) {
  if (status === "Approved") return "bg-emerald-50 text-emerald-700";
  if (status === "Rejected") return "bg-red-50 text-red-700";
  if (status === "Pending Review") return "bg-yellow-50 text-yellow-700";
  return "bg-slate-100 text-slate-600";
}

export default function ProfilePage() {
  const { address, isConnected, chainId } = useAccount();

  const [bounties, setBounties] = useState<BountyItem[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [totalRewards, setTotalRewards] = useState(BigInt(0));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadProfile = useCallback(async () => {
    if (!address || !isConnected) {
      setBounties([]);
      setSubmissions([]);
      setTotalRewards(BigInt(0));
      setError("");
      setLoading(false);
      return;
    }

    if (chainId !== 5042) {
      setBounties([]);
      setSubmissions([]);
      setTotalRewards(BigInt(0));
      setError("Switch your wallet to Arc Mainnet to view your profile.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const account = address.toLowerCase();

      const nextId = await client.readContract({
        address: bountyAddress,
        abi: arcBountyAbiConfig,
        functionName: "nextBountyId",
      }) as bigint;

      const myBounties: BountyItem[] = [];
      const mySubmissions: SubmissionItem[] = [];
      const approvedKeys = new Set<string>();
      const rejectedKeys = new Set<string>();

      const latestBlock = await client.getBlockNumber();
      const chunkSize = BigInt(1000);

      async function getLogsInChunks(event: typeof winnerPaidEvent | typeof approvedEvent | typeof rejectedEvent) {
        const logs = [];
        let fromBlock = BigInt(0);

        while (fromBlock <= latestBlock) {
          const toBlock =
            fromBlock + chunkSize - BigInt(1) > latestBlock
              ? latestBlock
              : fromBlock + chunkSize - BigInt(1);

          const chunkLogs = await client.getLogs({
            address: bountyAddress,
            event,
            fromBlock,
            toBlock,
          });

          logs.push(...chunkLogs);
          fromBlock = toBlock + BigInt(1);
        }

        return logs;
      }

      const [paidLogs, approvedLogs, rejectedLogs] = await Promise.all([
        getLogsInChunks(winnerPaidEvent),
        getLogsInChunks(approvedEvent),
        getLogsInChunks(rejectedEvent),
      ]);

      let earnings = BigInt(0);

      for (const log of paidLogs) {
        if (log.args.contributor?.toLowerCase() === account) {
          earnings += ("amount" in log.args ? log.args.amount : undefined) ?? BigInt(0);
        }
      }

      for (const log of approvedLogs) {
        if (log.args.bountyId !== undefined &&
            log.args.submissionId !== undefined) {
          approvedKeys.add(
            `${log.args.bountyId}:${log.args.submissionId}`
          );
        }
      }

      for (const log of rejectedLogs) {
        if (log.args.bountyId !== undefined &&
            log.args.submissionId !== undefined) {
          rejectedKeys.add(
            `${log.args.bountyId}:${log.args.submissionId}`
          );
        }
      }

      const bountyIds: bigint[] = [];
      for (let id = BigInt(0); id < nextId; id++) bountyIds.push(id);

      const bountyResults = await Promise.all(
        bountyIds.map(async (id) => {
          try {
            const bounty = await client.readContract({
              address: bountyAddress,
              abi: arcBountyAbiConfig,
              functionName: "bounties",
              args: [id],
            }) as readonly [
              bigint, Address, bigint, bigint, number, string, string
            ];

            const [
              storedId,
              creator,
              reward,
              deadline,
              status,
              title,
              description,
            ] = bounty;

            if (
              !creator ||
              creator === "0x0000000000000000000000000000000000000000"
            ) return null;

            const [remaining, allSubmissions] = await Promise.all([
              client.readContract({
                address: bountyAddress,
                abi: arcBountyAbiConfig,
                functionName: "remainingReward",
                args: [id],
              }) as Promise<bigint>,
              client.readContract({
                address: bountyAddress,
                abi: arcBountyAbiConfig,
                functionName: "getSubmissions",
                args: [id],
              }) as Promise<readonly {
                id: bigint;
                contributor: Address;
                proof: string;
                resolved: boolean;
              }[]>,
            ]);

            if (creator.toLowerCase() === account) {
              myBounties.push({
                id: storedId.toString(),
                title,
                description,
                creator,
                reward,
                remainingReward: remaining,
                deadline,
                status: Number(status),
                submissions: allSubmissions.length,
              });
            }

            for (const item of allSubmissions) {
              if (item.contributor.toLowerCase() !== account) continue;

              const key = `${storedId}:${item.id}`;
              let itemStatus: SubmissionItem["status"] = "Pending Review";

              if (approvedKeys.has(key)) itemStatus = "Approved";
              else if (rejectedKeys.has(key)) itemStatus = "Rejected";
              else if (item.resolved) itemStatus = "Resolved";

              let rewardAmount = BigInt(0);

              if (itemStatus === "Approved") {
                for (const log of paidLogs) {
                  if (
                    log.args.bountyId === storedId &&
                    log.args.submissionId === item.id &&
                    log.args.contributor?.toLowerCase() === account
                  ) {
                    rewardAmount += ("amount" in log.args ? log.args.amount : undefined) ?? BigInt(0);
                  }
                }
              }

              mySubmissions.push({
                id: item.id.toString(),
                bountyId: storedId.toString(),
                bountyTitle: title,
                proof: item.proof,
                resolved: item.resolved,
                status: itemStatus,
                reward: rewardAmount,
              });
            }

            return true;
          } catch {
            return null;
          }
        })
      );

      void bountyResults;

      myBounties.sort((a, b) => Number(b.id) - Number(a.id));
      mySubmissions.sort(
        (a, b) =>
          Number(b.bountyId) - Number(a.bountyId) ||
          Number(b.id) - Number(a.id)
      );

      setBounties(myBounties);
      setSubmissions(mySubmissions);
      setTotalRewards(earnings);
    } catch (err) {
      console.error("Failed to load ArcBounty profile:", err);
      setError(
        "We couldn't load your on-chain profile. Please refresh and try again."
      );
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, chainId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile, refreshKey]);

  const pendingCount = submissions.filter(
    (submission) => submission.status === "Pending Review"
  ).length;

  const statusLabels = ["Active", "Completed", "Cancelled"];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="Back to bounties"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"
              stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 6l-6 6 6 6" />
            </svg>
          </Link>

          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
            Arc<span className="text-[#1747c8]">Bounty</span>
          </Link>

          <button
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading || !isConnected}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-lg font-bold text-white">
              AB
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1747c8]">ArcBounty profile</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">My Profile</h1>
              <p className="mt-1 text-sm text-slate-500">
                Your activity and rewards on Arc Mainnet
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Wallet</h2>
              <p className="mt-1 text-sm text-slate-500">
                {isConnected && address
                  ? `Connected: ${shortAddress(address)}`
                  : "Connect your wallet to view your own bounties, submissions, and rewards."}
              </p>
              {isConnected && chainId !== 5042 && (
                <p className="mt-2 text-sm font-medium text-red-600">
                  Switch to Arc Mainnet to view your profile.
                </p>
              )}
            </div>
            <WalletButton />
          </div>
        </section>

        {!isConnected ? (
          <section className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <h2 className="text-lg font-bold">Connect your wallet</h2>
            <p className="mt-2 text-sm text-slate-500">
              Your profile statistics will appear here after you connect.
            </p>
          </section>
        ) : (
          <>
            <section className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: "Bounties created", value: bounties.length },
                { label: "My submissions", value: submissions.length },
                { label: "Pending review", value: pendingCount },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold">
                    {loading ? "…" : item.value}
                  </p>
                </div>
              ))}

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-medium text-slate-500">Rewards earned</p>
                <p className="mt-2 text-2xl font-bold">
                  {loading ? "…" : formatUsdc(totalRewards)}{" "}
                  <span className="text-sm font-semibold text-slate-500">USDC</span>
                </p>
              </div>
            </section>

            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading && (
              <p className="mt-5 text-sm text-slate-500">
                Loading your on-chain activity…
              </p>
            )}

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">My Bounties</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Bounties created by this wallet.
                    </p>
                  </div>
                  <Link href="/create" className="rounded-xl bg-[#1747c8] px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#123aa5]">
                    + Create
                  </Link>
                </div>

                {bounties.length === 0 && !loading ? (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center">
                    <p className="text-sm font-semibold">No bounties created by this wallet yet.</p>
                    <Link href="/create" className="mt-3 inline-block text-sm font-semibold text-[#1747c8]">
                      Create a bounty →
                    </Link>
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    {bounties.slice(0, 4).map((bounty) => (
                      <div key={bounty.id} className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-slate-50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{bounty.title}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Bounty #{bounty.id} · {bounty.submissions} submissions
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {statusLabels[bounty.status] ?? "Unknown status"}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-bold">
                            {formatUsdc(bounty.reward)} USDC
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Remaining escrow: {formatUsdc(bounty.remainingReward)} USDC
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                          <Link href={`/bounties/${bounty.id}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100">
                            View Bounty
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">My Submissions</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Work submitted by this wallet.
                    </p>
                  </div>
                  <Link href="/submissions" className="text-xs font-semibold text-[#1747c8]">
                    View all →
                  </Link>
                </div>

                {submissions.length === 0 && !loading ? (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center">
                    <p className="text-sm font-semibold">No submissions found for this wallet.</p>
                    <Link href="/" className="mt-3 inline-block text-sm font-semibold text-[#1747c8]">
                      Find a bounty →
                    </Link>
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    {submissions.slice(0, 4).map((submission) => (
                      <div key={`${submission.bountyId}-${submission.id}`} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{submission.bountyTitle}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Bounty #{submission.bountyId} · Submission #{submission.id}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle(submission.status)}`}>
                            {submission.status}
                          </span>
                        </div>
                        {submission.proof && (
                          <a href={submission.proof} target="_blank" rel="noreferrer"
                            className="mt-3 inline-block break-all text-xs font-semibold text-[#1747c8] hover:underline">
                            View submitted proof
                          </a>
                        )}
                        {submission.reward > BigInt(0) && (
                          <p className="mt-2 text-xs font-semibold text-emerald-700">
                            Paid: {formatUsdc(submission.reward)} USDC
                          </p>
                        )}
                        <div className="mt-3">
                          <Link href={`/bounties/${submission.bountyId}`} className="text-xs font-semibold text-[#1747c8]">
                            View bounty →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-lg font-bold">Recent Activity</h2>
              <p className="mt-1 text-sm text-slate-500">
                Your latest submissions recorded on Arc.
              </p>
              <div className="mt-6 space-y-4">
                {submissions.slice(0, 3).map((submission) => (
                  <div key={`activity-${submission.bountyId}-${submission.id}`} className="flex items-start gap-3">
                    <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#1747c8]" />
                    <div>
                      <p className="text-sm font-medium">
                        Submitted work for <span className="font-semibold">{submission.bountyTitle}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Submission #{submission.id} · {submission.status}
                      </p>
                    </div>
                  </div>
                ))}
                {submissions.length === 0 && !loading && (
                  <p className="text-sm text-slate-500">
                    Your submission activity will appear here.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
