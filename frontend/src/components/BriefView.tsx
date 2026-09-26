"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { BriefRow } from "@/lib/types";
import { CardSkeleton } from "./ExplainCard";

export default function BriefView() {
  const [brief, setBrief] = useState<BriefRow | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ brief: BriefRow | null }>("/brief")
      .then((d) => setBrief(d.brief))
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="text-bad text-sm">Could not load the brief. {err}</p>;
  if (brief === undefined) return <CardSkeleton />;
  if (brief === null)
    return (
      <div className="text-center py-16">
        <p className="font-display text-2xl">No brief yet.</p>
        <p className="text-mute mt-2 max-w-sm mx-auto leading-relaxed">
          Each day&apos;s brief is written after 7am New York time, once enough stories are in.
        </p>
      </div>
    );

  const b = brief.explanation;
  const date = brief.published_at
    ? new Date(brief.published_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : "";

  return (
    <article className="rise bg-card border border-line rounded-2xl p-5 sm:p-7">
      <p className="text-xs uppercase tracking-[0.14em] font-semibold text-vermilion">Daily brief · {date}</p>
      <h2 className="font-display text-3xl leading-tight tracking-tight mt-2">
        <span className="hl">{b.headline}</span>
      </h2>
      <p className="mt-4 text-[16px] leading-[1.7]">{b.big_picture}</p>

      <ol className="mt-8 space-y-7">
        {b.items.map((it, k) => (
          <li key={k} className="flex gap-4">
            <span className="font-display text-2xl text-vermilion leading-none mt-0.5 w-5 shrink-0">{k + 1}</span>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-mute">{it.topic}</p>
              <h3 className="font-display text-xl leading-snug tracking-tight mt-0.5">{it.headline}</h3>
              <p className="mt-2 text-[15px] leading-relaxed">{it.what}</p>
              <p className="mt-2 text-[15px] leading-relaxed">
                <span className="font-semibold">Why it matters to you: </span>
                {it.why}
              </p>
              {it.links && it.links.length > 0 && (
                <p className="mt-2 text-sm text-mute">
                  Read the original:{" "}
                  {it.links.map((l, j) => (
                    <span key={l.url}>
                      {j > 0 && ", "}
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-4 decoration-line hover:decoration-ink hover:text-ink"
                      >
                        {l.source} ↗
                      </a>
                    </span>
                  ))}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {b.watch_next && (
        <p className="mt-8 text-sm text-mute border-l-2 border-line pl-3 leading-relaxed">
          <span className="font-medium text-ink">Watch next: </span>
          {b.watch_next}
        </p>
      )}
    </article>
  );
}
