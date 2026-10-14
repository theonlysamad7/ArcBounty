import Link from "next/link";
import DeadlineCountdown from "../../../components/DeadlineCountdown";
import { notFound } from "next/navigation";
import { getBountyById } from "../../../data/bounties-server";
import BountyActions from "../../../components/BountyActions";

export const dynamic = "force-dynamic";

export default async function BountyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    notFound();
  }

  const bounty = await getBountyById(id);

  if (!bounty) {
    notFound();
  }

  const creatorAddress =
    /^0x[a-fA-F0-9]{40}$/.test(bounty.creator)
      ? bounty.creator
      : "";

  const deadlineValue = bounty.deadline || bounty.time;
  const deadlineDate = new Date(deadlineValue);
  const deadlinePassed =
    !Number.isNaN(deadlineDate.getTime()) &&
    deadlineDate.getTime() <= Date.now();

  const deadlineIso = Number.isNaN(deadlineDate.getTime())
    ? ""
    : deadlineDate.toISOString();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-slate-900"
          >
            Arc<span className="text-[#1747c8]">Bounty</span>
          </Link>

          <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            Arc Mainnet
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <Link
          href="/#bounties"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          ← Back to bounties
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {bounty.category}
              </span>

              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Arc Mainnet bounty
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  deadlinePassed
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {deadlinePassed ? "Deadline passed" : bounty.status ?? "Open"}
              </span>
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              {bounty.title}
            </h1>

            <p className="mt-5 whitespace-pre-wrap text-base leading-7 text-slate-600">
              {bounty.description}
            </p>

            {bounty.requirements && (
              <div className="mt-6 rounded-xl bg-slate-50 p-4">
                <h2 className="font-bold">Requirements</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {bounty.requirements}
                </p>
              </div>
            )}

            <div className="mt-8 border-t border-slate-200 pt-7">
              <h2 className="text-lg font-bold">Contribute to this bounty</h2>
              {creatorAddress && deadlineIso ? (
                <BountyActions
                  bountyId={bounty.id}
                  creatorAddress={creatorAddress}
                  deadline={deadlineIso}
                />
              ) : (
                <p className="mt-3 text-sm text-amber-700">
                  Creator wallet or deadline information is missing from the
                  saved record. On-chain actions are unavailable for this
                  listing until the record is corrected.
                </p>
              )}
            </div>

            <div className="mt-8 border-t border-slate-200 pt-7">
              <h2 className="text-lg font-bold">Bounty creator</h2>

              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                  {creatorAddress
                    ? creatorAddress.slice(2, 4).toUpperCase()
                    : "AB"}
                </div>

                <div>
                  <p className="break-all text-sm font-semibold text-slate-900">
                    {creatorAddress || bounty.creator}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {creatorAddress
                      ? "Creator wallet on Arc"
                      : "Creator wallet not available"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Original reward
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                  {bounty.reward}
                </p>
              </div>

              <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                USDC
              </span>
            </div>

            <div className="mt-6 space-y-4 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Remaining escrow</span>
                <span className="text-right font-semibold">
                  Verify on Arc Mainnet
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Deadline</span>
                <span className="text-right font-semibold">
                  {deadlineIso ? (
                    <DeadlineCountdown
                      deadline={deadlineIso}
                      fallback={bounty.time}
                    />
                  ) : (
                    "Not available"
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Submissions</span>
                <span className="font-semibold">{bounty.submissions}</span>
              </div>

              <Link
                href={`/bounties/${bounty.id}/submissions`}
                className="flex w-full items-center justify-center rounded-xl bg-[#1747c8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#123aa5]"
              >
                View Submissions →
              </Link>

              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Winner slots</span>
                <span className="font-semibold">{bounty.winners}</span>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Network</span>
                <span className="font-semibold">Arc Mainnet</span>
              </div>
            </div>

            {creatorAddress && (
              <a
                href={`https://explorer.arc.io/address/${creatorAddress}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                View creator on Arc Explorer ↗
              </a>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
