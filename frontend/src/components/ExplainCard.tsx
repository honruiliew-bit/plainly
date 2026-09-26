"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Item } from "@/lib/types";
import { timeAgo, readMinutes } from "@/lib/types";
import DeepDive from "./DeepDive";

const DOT: Record<string, string> = { good: "bg-good", bad: "bg-bad", mixed: "bg-mixed", unclear: "bg-mute" };

export default function ExplainCard({
  item,
  index = 0,
  defaultOpen = false,
  saved = false,
  onToggleSave,
}: {
  item: Item;
  index?: number;
  defaultOpen?: boolean;
  saved?: boolean;
  onToggleSave?: (item: Item, on: boolean) => void;
}) {
  const [it, setIt] = useState(item);
  const [open, setOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const e = it.explanation;
  const hasDive = (e.sections?.length ?? 0) > 0;

  async function start() {
    if (hasDive) {
      setOpen(true);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const full = await apiFetch<Item>("/deepdive", { method: "POST", body: JSON.stringify({ id: it.id }) });
      setIt(full);
      setOpen(true);
    } catch (error) {
      const m = error instanceof Error ? error.message : "";
      setErr(m.match(/"detail":"([^"]+)"/)?.[1] || "Could not write that just now. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="rise bg-card border border-line rounded-2xl p-5 sm:p-6" style={{ ["--i" as string]: index }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-xs text-mute min-w-0">
          <span className="uppercase tracking-[0.12em] font-medium">{e.topic}</span>
          {it.source && <span className="truncate">· {it.source}</span>}
          {it.published_at && <span className="shrink-0">· {timeAgo(it.published_at)}</span>}
          {it.match && (
            <span className="shrink-0 rounded-full bg-marker/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              Your interests
            </span>
          )}
        </div>
        {hasDive && onToggleSave && (
          <button
            onClick={() => onToggleSave(it, !saved)}
            aria-pressed={saved}
            className={`press shrink-0 text-xs font-medium rounded-full px-3 py-1 border ${
              saved ? "bg-ink text-paper border-ink" : "border-line text-mute hover:border-ink hover:text-ink"
            }`}
          >
            {saved ? "Saved" : "Save"}
          </button>
        )}
      </div>

      {it.kind === "feed" && (
        <p className="text-sm text-mute line-through decoration-line decoration-1 mb-1.5 line-clamp-2">{it.title}</p>
      )}
      <h3 className="font-display text-xl sm:text-2xl leading-snug tracking-tight">
        <span className="hl">{e.plain_headline}</span>
      </h3>
      <p className="mt-3 text-[15px] leading-relaxed">{e.tldr}</p>
      {it.url && (
        <a
          href={it.url}
          target="_blank"
          rel="noopener noreferrer"
          className="press mt-3 inline-flex items-center gap-1 text-sm text-mute hover:text-ink underline underline-offset-4 decoration-line hover:decoration-ink"
        >
          {it.source ? `Read the original on ${it.source}` : "Read the original"} <span aria-hidden>↗</span>
        </a>
      )}

      {!open && (
        <>
          {e.impact.length > 0 && (
            <ul className="mt-4 space-y-2">
              {e.impact.slice(0, 2).map((m, k) => (
                <li key={k} className="flex gap-3">
                  <span className={`mt-[8px] h-2 w-2 rounded-full shrink-0 ${DOT[m.direction]}`} />
                  <p className="text-sm leading-relaxed text-mute">
                    <strong className="font-semibold text-ink">{m.who}.</strong> {m.effect}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={start}
              disabled={loading}
              className="press bg-ink text-paper rounded-full px-5 py-2.5 text-sm font-medium hover:bg-black disabled:opacity-60"
            >
              {loading ? "Writing the deep dive..." : `Read the deep dive · ${readMinutes(e)} min`}
            </button>
            {loading && <span className="text-xs text-mute">About 15 seconds the first time</span>}
          </div>
          {err && <p role="alert" className="mt-3 text-sm text-bad">{err}</p>}
        </>
      )}

      {open && (
        <>
          <DeepDive item={it} />
          <button onClick={() => setOpen(false)} className="press mt-6 text-sm text-mute hover:text-ink">
            Close
          </button>
        </>
      )}
    </article>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-card border border-line rounded-2xl p-6 space-y-3" aria-hidden>
      <div className="skeleton h-3 w-24" />
      <div className="skeleton h-6 w-4/5" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-2/3" />
    </div>
  );
}
