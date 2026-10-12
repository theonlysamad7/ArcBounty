import Link from "next/link";
import BountyExplorer from "../components/BountyExplorer";
import { getOnChainBounties } from "../data/bounties-chain";

function ArrowRight() {
  return <span aria-hidden="true">→</span>;
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 20 6v5c0 5-3.3 8.6-8 10-4.7-1.4-8-5-8-10V6l8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ search?: string; category?: string }> }) {
  return (
    <main className="min-h-screen bg-[#f7f9fc] text-[#111827]">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1747c8] text-sm font-bold text-white">
              A
            </div>

            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight">
                ArcBounty
              </span>
              <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:inline">
                Built on Arc
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-7 text-sm font-medium lg:flex">
            <a className="text-[#1747c8]" href="#">
              Bounties
            </a>
            <a className="text-slate-600 transition hover:text-slate-950" href="#">
              How It Works
            </a>
            <Link href="/profile" className="flex items-center gap-2 text-slate-600 transition hover:text-slate-950">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              Profile
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Arc Mainnet
            </div>


            <Link href="/create" className="rounded-lg bg-[#1747c8] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#123aa5] sm:block">
              + Create Bounty
            </Link>

            <Link
              href="/profile"
              aria-label="Open profile"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#123aa5] text-white transition hover:bg-[#1747c8]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-100 bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.10),transparent_45%)]" />

        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-14 text-center sm:px-6 sm:pt-20 lg:px-8 lg:pb-20">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            Built on Arc Mainnet
            <span className="text-slate-400">·</span>
            USDC settlement layer
          </div>

          <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-7xl">
            Small tasks.{" "}
            <span className="text-[#1747c8]">Real USDC.</span>
            <br className="hidden sm:block" /> Instant settlement.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Launch small tasks, lock USDC in escrow, and pay contributors
            directly when their work is approved.
          </p>

          <div className="mt-8 flex justify-center">
            <a href="#bounties" className="flex items-center gap-2 rounded-xl bg-[#1747c8] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/10 transition hover:bg-[#123aa5]">
              Browse Bounties <ArrowRight />
            </a>
          </div>

          <div className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-500">
            <span>🔒 USDC escrow</span>
            <span>•</span>
            <span>On-chain settlement</span>
            <span>•</span>
            <span>Direct contributor payment</span>
          </div>

        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["01 / POST", "Escrow Funds", "Create a task and lock its USDC reward in the smart contract."],
            ["02 / COMPLETE", "Submit Proof", "Contributors complete the task and submit verifiable proof."],
            ["03 / APPROVE", "Review Work", "Creators review submissions and choose the successful contributor."],
            ["04 / PAID", "Instant Release", "The smart contract sends the reward directly to the contributor."],
          ].map(([number, title, description]) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-[10px] font-bold tracking-[0.18em] text-blue-600">
                {number}
              </p>
              <h2 className="mt-3 text-base font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="bounties" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              Live escrow registry
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Explore Open Bounties
            </h2>
          </div>
          <span className="text-sm text-slate-500">
            Browse tasks and earn USDC
          </span>
        </div>
        <BountyExplorer bounties={await getOnChainBounties()} search={(await searchParams).search ?? ""} category={(await searchParams).category ?? "All Tasks"} />
      </section>

      {/* Trust banner */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl bg-[#102b57] p-6 text-white sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-blue-200">
                <ShieldIcon />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                  Smart contract escrow
                </p>
                <h3 className="mt-1 text-lg font-bold">
                  Your reward stays locked until the work is approved.
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/75">
                  ArcBounty uses an on-chain escrow contract so creators can
                  lock USDC and contributors can receive payment directly
                  after approval.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-xs text-slate-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <strong className="text-slate-800">ArcBounty</strong>
            <span className="ml-2">Small tasks. Real USDC.</span>
          </div>

          <div className="flex flex-wrap gap-5">
            <a href="#" className="hover:text-slate-900">
              Documentation
            </a>
            <a href="#" className="hover:text-slate-900">
              Smart Contract
            </a>
            <a href="#" className="hover:text-slate-900">
              Terms
            </a>
            <a href="#" className="hover:text-slate-900">
              Privacy
            </a>
          </div>

          <span>Built on Arc Mainnet</span>
        </div>
      </footer>
    </main>
  );
}
