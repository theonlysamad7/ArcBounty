"use client";

import { useEffect, useState } from "react";

function getRemaining(deadline: string) {
  const difference = new Date(deadline).getTime() - Date.now();

  if (difference <= 0) {
    return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const totalSeconds = Math.floor(difference / 1000);

  return {
    expired: false,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function formatRemaining(remaining: ReturnType<typeof getRemaining>) {
  if (remaining.expired) return "Expired";

  if (remaining.days > 0) {
    return remaining.hours > 0
      ? `${remaining.days} day${remaining.days !== 1 ? "s" : ""} ${remaining.hours} hour${remaining.hours !== 1 ? "s" : ""} remaining`
      : `${remaining.days} day${remaining.days !== 1 ? "s" : ""} remaining`;
  }

  if (remaining.hours > 0) {
    return remaining.minutes > 0
      ? `${remaining.hours} hour${remaining.hours !== 1 ? "s" : ""} ${remaining.minutes} minute${remaining.minutes !== 1 ? "s" : ""} remaining`
      : `${remaining.hours} hour${remaining.hours !== 1 ? "s" : ""} remaining`;
  }

  if (remaining.minutes > 0) {
    return `${remaining.minutes} minute${remaining.minutes !== 1 ? "s" : ""} remaining`;
  }

  return `${remaining.seconds} second${remaining.seconds !== 1 ? "s" : ""} remaining`;
}

export default function DeadlineCountdown({
  deadline,
}: {
  deadline?: string;
  fallback?: string;
}) {
  const [remaining, setRemaining] = useState<
    ReturnType<typeof getRemaining> | null
  >(() => (deadline ? getRemaining(deadline) : null));

  useEffect(() => {
    if (!deadline) return;

    const update = () => {
      setRemaining(getRemaining(deadline));
    };

    update();

    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline || !remaining) {
    return (
      <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
        Time unavailable
      </span>
    );
  }

  return (
    <span
      suppressHydrationWarning
      className={
        remaining.expired
          ? "rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500"
          : "rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"
      }
    >
      {formatRemaining(remaining)}
    </span>
  );
}
