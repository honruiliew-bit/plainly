"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { publicFetch } from "@/lib/publicApi";
import type { Item } from "@/lib/types";
import { timeAgo } from "@/lib/types";

function Widget() {
  const params = useSearchParams();
  const limit = Math.min(Math.max(Number(params.get("limit")) || 5, 1), 12);
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    publicFetch<{ items: Item[] }>(`/public/feed?limit_n=${limit}`)
      .then((d) => setItems(d.items))
      .catch(() => setErr(true));
  }, [limit]);

  // Tell the parent page how tall we are so the iframe can resize.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const send = () => window.parent?.postMessage({ plainly: "height", value: el.scrollHeight }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(el);
    send();
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={root} className="p-4">
      <div className="flex items-baseline justify-between mb-3">
        <a href="/" target="_blank" rel="noopener noreferrer" className="font-display text-xl leading-none">
          Plain<span className="text-vermilion">ly</span>
        </a>
        <span className="text-[11px] uppercase tracking-[0.12em] text-mute">News, decoded</span>
      </div>

      {err && <p className="text-sm text-mute">Could not load stories right now.</p>}
      {!items && !err && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-14" />
          ))}
        </div>
      )}
      <ul className="divide-y divide-line">
        {items?.map((it) => {
          const e = it.explanation;
          const isOpen = open === it.id;
          return (
            <li key={it.id} className="py-3">
              <button
                onClick={() => setOpen(isOpen ? null : it.id)}
                aria-expanded={isOpen}
                className="press text-left w-full"
              >
                <p className="text-[11px] uppercase tracking-[0.12em] text-mute">
                  {e.topic} · {timeAgo(it.published_at)}
                </p>
                <p className="font-display text-[17px] leading-snug mt-1">
                  <span className="hl">{e.plain_headline}</span>
                </p>
              </button>
              {isOpen && (
                <div className="mt-2 text-sm leading-relaxed">
                  <p>{e.tldr}</p>
                  <p className="mt-2 text-mute">{e.mechanism}</p>
                  {it.url && (
                    <a href={it.url} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 underline underline-offset-4 font-medium">
                      Read the original
                    </a>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-mute">
        Explanations are AI generated from headlines and summaries. Not financial advice.
      </p>
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={null}>
      <Widget />
    </Suspense>
  );
}
