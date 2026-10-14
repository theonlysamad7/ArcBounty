import Link from "next/link";
import { notFound } from "next/navigation";
import { getBountyById } from "../../../../data/bounties-server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import ReviewSubmissionButtons from "./ReviewSubmissionButtons";

type Submission = {
  id: string;
  bountyId: string;
  bountyTitle: string;
  title: string;
  description: string;
  proof: string;
  reward: string;
  status: string;
  submittedAt: string;
  reviewedAt?: string;
  onchainSubmissionId?: string;
  walletAddress?: string;
  submissionTxHash?: string;
};

async function getSubmissions(): Promise<Submission[]> {
  const { data, error } = await supabaseAdmin
    .from("submissions")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Unable to load submissions:", error.message);
    throw new Error("Unable to load submissions.");
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    bountyId: String(row.bounty_id),
    bountyTitle: String(row.bounty_title),
    title: String(row.title),
    description: String(row.description),
    proof: String(row.proof),
    reward: String(row.reward ?? ""),
    status: String(row.status ?? "Pending Review"),
    submittedAt: String(row.submitted_at),
    reviewedAt: row.reviewed_at
      ? String(row.reviewed_at)
      : undefined,
    onchainSubmissionId:
      row.onchain_submission_id === null ||
      row.onchain_submission_id === undefined
        ? undefined
        : String(row.onchain_submission_id),
    walletAddress: row.wallet_address
      ? String(row.wallet_address)
      : undefined,
    submissionTxHash: row.submission_tx_hash
      ? String(row.submission_tx_hash)
      : undefined,
  }));
}

export default async function BountySubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bounty = await getBountyById(id);

  if (!bounty) notFound();

  const submissions = (await getSubmissions()).filter(
    (submission) => submission.bountyId === String(bounty.id)
  );

  const pending = submissions.filter(
    (submission) => submission.status === "Pending Review"
  ).length;

  const approved = submissions.filter(
    (submission) => submission.status === "Approved"
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/profile"
            aria-label="Back to profile"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 12H5m6-6-6 6 6 6"
              />
            </svg>
          </Link>

          <div className="text-xl font-bold tracking-tight">
            Arc<span className="text-[#1747c8]">Bounty</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#1747c8]">
              Creator review
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {bounty.title}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Review submitted work and manage rewards secured in the bounty
              escrow.
            </p>
          </div>

          <div className="flex gap-2">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
              <p className="text-lg font-bold">{submissions.length}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
              <p className="text-lg font-bold text-amber-700">{pending}</p>
              <p className="text-xs text-amber-700">Pending</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
              <p className="text-lg font-bold text-emerald-700">
                {approved}
              </p>
              <p className="text-xs text-emerald-700">Approved</p>
            </div>
          </div>
        </div>

        {submissions.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-bold">No submissions yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Contributor submissions for this bounty will appear here.
            </p>
          </section>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <article
                key={submission.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          submission.status === "Approved"
                            ? "bg-emerald-50 text-emerald-700"
                            : submission.status === "Rejected"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {submission.status}
                      </span>

                      <span className="text-xs text-slate-400">
                        {new Date(submission.submittedAt).toLocaleString()}
                      </span>
                    </div>

                    <h2 className="mt-3 text-lg font-bold">
                      {submission.title}
                    </h2>

                    {submission.walletAddress && (
                      <p className="mt-2 break-all text-xs text-slate-500">
                        Contributor: {submission.walletAddress}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 rounded-xl bg-slate-50 px-4 py-3 sm:text-right">
                    <p className="text-xs text-slate-500">Reward</p>
                    <p className="mt-0.5 font-bold text-slate-900">
                      {submission.reward || "See payout tiers"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                    {submission.description}
                  </p>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Proof of work
                  </p>

                  <a
                    href={submission.proof}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block break-all text-sm font-semibold text-[#1747c8] hover:underline"
                  >
                    {submission.proof}
                  </a>
                </div>

                {submission.submissionTxHash && (
                  <a
                    href={`https://explorer.arc.io/tx/${submission.submissionTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-xs font-semibold text-[#1747c8] hover:underline"
                  >
                    View submission transaction on Arc Explorer
                  </a>
                )}

                {submission.status === "Pending Review" && (
                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <ReviewSubmissionButtons
                      bountyId={submission.bountyId}
                      submissionId={submission.id}
                      onchainSubmissionId={
                        submission.onchainSubmissionId ?? ""
                      }
                      creatorAddress={bounty.creator}
                    />
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
