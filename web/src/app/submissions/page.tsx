"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

type Submission = {
  id: string;
  bounty_id: string;
  bounty_title: string;
  title: string;
  description: string;
  proof: string;
  reward: string | null;
  status: string;
  submitted_at: string;
  submission_tx_hash: string | null;
};

export default function SubmissionsPage() {
  const { address, isConnected } = useAccount();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!address) {
      setSubmissions([]);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;

    async function loadSubmissions() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/submissions?wallet=${encodeURIComponent(address!)}`,
          { cache: "no-store" }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to load submissions.");
        }

        if (!cancelled) {
          setSubmissions(result.submissions ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your submissions. Please try again."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSubmissions();

    return () => {
      cancelled = true;
    };
  }, [address]);

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

          {isConnected && address && (
            <p className="mt-4 break-all text-xs text-slate-500">
              Connected wallet: {address}
            </p>
          )}
        </div>

        {!isConnected ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <h2 className="font-semibold">Connect your wallet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Connect the wallet you used to submit work to view your submissions.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Return to ArcBounty
            </Link>
          </div>
        ) : loading ? (
          <div className="mt-10 rounded-2xl border border-slate-200 p-10 text-center">
            <p className="text-sm text-slate-500">
              Loading your submissions…
            </p>
          </div>
        ) : error ? (
          <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6">
            <h2 className="font-semibold text-red-800">
              Could not load submissions
            </h2>
            <p className="mt-2 break-words text-sm text-red-700">{error}</p>
            <button
              onClick={() => {
                if (address) {
                  setError("");
                  setLoading(true);
                  fetch(
                    `/api/submissions?wallet=${encodeURIComponent(address)}`,
                    { cache: "no-store" }
                  )
                    .then(async (response) => {
                      const result = await response.json();
                      if (!response.ok) {
                        throw new Error(
                          result.error || "Unable to load submissions."
                        );
                      }
                      setSubmissions(result.submissions ?? []);
                    })
                    .catch((err) => {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Unable to load submissions."
                      );
                    })
                    .finally(() => setLoading(false));
                }
              }}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        ) : submissions.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <h2 className="font-semibold">No submissions yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Your confirmed ArcBounty submissions will appear here.
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
                      {submission.bounty_title}
                    </p>
                    <h2 className="mt-1 text-lg font-bold">
                      {submission.title}
                    </h2>
                    <p className="mt-2 text-xs text-slate-400">
                      Submitted{" "}
                      {submission.submitted_at
                        ? new Date(submission.submitted_at).toLocaleString()
                        : "date unavailable"}
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
                    {submission.status}
                  </span>
                </div>

                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                  {submission.description}
                </p>

                <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Potential reward</p>
                    <p className="font-semibold">
                      {submission.reward || "See bounty details"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <a
                      href={submission.proof}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-slate-900 underline underline-offset-4"
                    >
                      View Proof →
                    </a>

                    {submission.submission_tx_hash && (
                      <a
                        href={`https://explorer.arc.io/tx/${submission.submission_tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-slate-900 underline underline-offset-4"
                      >
                        View Transaction ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
