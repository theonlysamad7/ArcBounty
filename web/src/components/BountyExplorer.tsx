import Link from "next/link";
import DeadlineCountdown from "./DeadlineCountdown";

type Bounty = {
  id: string;
  category: string;
  tag: string;
  title: string;
  description: string;
  reward: string;
  time: string;
  deadline?: string;
  submissions: string;
  creator: string;
  winners?: number;
};

const categories = [
  "All Tasks",
  "Research",
  "Development",
  "Writing",
  "Design",
  "Community",
  "Bug Hunt",
];

function displayCreator(creator: string) {
  if (/^0x[a-fA-F0-9]{40}$/.test(creator)) {
    return `${creator.slice(0, 6)}...${creator.slice(-4)}`;
  }
  return creator;
}

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

export default function BountyExplorer({
  bounties,
  search = "",
  category = "All Tasks",
}: {
  bounties: Bounty[];
  search?: string;
  category?: string;
}) {
  const searchValue = search.trim().toLowerCase();

  const filtered = bounties.filter((bounty) => {
    const categoryMatches =
      category === "All Tasks" ||
      bounty.category.toLowerCase() === category.toLowerCase();

    const searchMatches =
      searchValue === "" ||
      [
        bounty.id,
        bounty.category,
        bounty.tag,
        bounty.title,
        bounty.description,
        bounty.reward,
        bounty.creator,
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchValue);

    return categoryMatches && searchMatches;
  });

  const buildHref = (nextCategory: string) => {
    const params = new URLSearchParams();

    if (search.trim()) {
      params.set("search", search.trim());
    }

    if (nextCategory !== "All Tasks") {
      params.set("category", nextCategory);
    }

    const query = params.toString();
    return query ? `/?${query}#bounties` : "/#bounties";
  };

  return (
    <>
      <form
        action="/"
        method="GET"
        className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
          <SearchIcon />

          <input
            name="search"
            defaultValue={search}
            placeholder="Search bounties by keyword, skill, or hash..."
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />

          {category !== "All Tasks" && (
            <input type="hidden" name="category" value={category} />
          )}

          <button
            type="submit"
            className="rounded-lg bg-[#1747c8] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#123aa5]"
          >
            Search
          </button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((item) => (
            <Link
              key={item}
              href={buildHref(item)}
              className={
                category === item
                  ? "whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700"
                  : "whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              }
            >
              {item}
            </Link>
          ))}
        </div>
      </form>

      <div className="mb-3 mt-3 text-xs text-slate-400">
        Active: {category} · Showing: {filtered.length}
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((bounty) => (
            <article
              key={bounty.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    {bounty.category}
                  </span>

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {bounty.tag}
                  </span>
                  {bounty.winners && bounty.winners > 0 && (
                    <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      {bounty.winners} {bounty.winners === 1 ? "winner" : "winners"}
                    </span>
                  )}
                </div>

                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  Open
                </span>
              </div>

              <h3 className="mt-4 text-lg font-bold tracking-tight text-slate-950">
                {bounty.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {bounty.description}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 border-y border-slate-100 py-4 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Reward
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {bounty.reward}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Time
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {bounty.deadline ? <DeadlineCountdown deadline={bounty.deadline} fallback={bounty.time} /> : <DeadlineCountdown fallback={bounty.time} />}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Work
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {bounty.submissions}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Creator
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {displayCreator(bounty.creator)}
                  </p>
                </div>
              </div>

              <Link
                href={`/bounties/${bounty.id}`}
                className="mt-4 flex items-center justify-between rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                View Bounty
                <ArrowRight />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No bounties found
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Try another keyword or category.
          </p>
        </div>
      )}

      <div className="mt-7 text-center">
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm"
        >
          Load More Bounties ↓
        </button>
      </div>
    </>
  );
}
