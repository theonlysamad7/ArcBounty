import Link from "next/link";
import fs from "fs/promises";
import path from "path";

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

export default async function SubmissionsPage() {
  const submissions = await getSubmissions();

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            ArcBounty
          </Link>

          <Link
            href="/"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Browse Bounties
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Contributor dashboard
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            My Submissions
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Track the bounties you have submitted and see their review status.
          </p>
        </div>

        {submissions.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <h2 className="font-semibold">No submissions yet</h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Find a bounty, complete the task, and submit your work to see it
              here.
            </p>

            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Explore Bounties
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {submissions.map((submission) => (
              <div
                key={submission.id}
                className="rounded-2xl border border-slate-200 p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      {submission.bountyTitle}
                    </p>

                    <h2 className="mt-1 text-lg font-bold">
                      {submission.title}
                    </h2>
                  </div>

                  <span className="w-fit rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
                    {submission.status}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-600">
                  {submission.description}
                </p>

                <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Potential reward</p>
                    <p className="font-semibold">{submission.reward}</p>
                  </div>

                  <a
                    href={submission.proof}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-slate-900 underline underline-offset-4"
                  >
                    View Proof →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
