import Link from "next/link";
import fs from "fs/promises";
import path from "path";
import { notFound } from "next/navigation";
import { getBountyById } from "../../../../data/bounties-server";

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
};

async function getSubmissions(): Promise<Submission[]> {
  const filePath = path.join(process.cwd(), "data", "submissions.json");

  try {
    const file = await fs.readFile(filePath, "utf8");
    return JSON.parse(file);
  } catch {
    return [];
  }
}

export default async function BountySubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const bounty = await getBountyById(id);

  if (!bounty) {
    notFound();
  }

  const submissions = (await getSubmissions()).filter(
    (submission) => submission.bountyId === bounty.id
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
                d="M19 12H5"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 6l-6 6 6 6"
              />
            </svg>
          </Link>

          <div className="text-xl font-bold tracking-tight text-slate-900">
            Arc<span className="text-[#1747c8]">Bounty</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6">

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#1747c8]">
                Creator review
              </p>

              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                {bounty.title}
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Review the work submitted for this bounty before releasing the
                reward.
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
        </div>

        {submissions.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6M7 4h7l3 3v13H7z"
                />
              </svg>
            </div>

            <h2 className="mt-4 text-lg font-bold">No submissions yet</h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              When contributors submit work for this bounty, their
              submissions will appear here for review.
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
                        {new Date(
                          submission.submittedAt
                        ).toLocaleString()}
                      </span>
                    </div>

                    <h2 className="mt-3 text-lg font-bold">
                      {submission.title}
                    </h2>
                  </div>

                  <div className="shrink-0 rounded-xl bg-slate-50 px-4 py-3 text-right">
                    <p className="text-xs text-slate-500">Reward</p>
                    <p className="mt-0.5 font-bold text-slate-900">
                      {submission.reward}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <p className="text-sm leading-6 text-slate-600">
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

                {submission.status === "Pending Review" && (
                  <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                    <form action="/api/submissions/review" method="POST">
                      <input
                        type="hidden"
                        name="submissionId"
                        value={submission.id}
                      />
                      <input
                        type="hidden"
                        name="action"
                        value="reject"
                      />

                      <button
                        type="submit"
                        className="w-full rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 sm:w-auto"
                      >
                        Reject
                      </button>
                    </form>

                    <form action="/api/submissions/review" method="POST">
                      <input
                        type="hidden"
                        name="submissionId"
                        value={submission.id}
                      />
                      <input
                        type="hidden"
                        name="action"
                        value="approve"
                      />

                      <button
                        type="submit"
                        className="w-full rounded-xl bg-[#1747c8] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#123aa5] sm:w-auto"
                      >
                        Approve Submission
                      </button>
                    </form>
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
