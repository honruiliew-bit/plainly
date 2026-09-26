"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Item } from "@/lib/types";
import Rich from "./Rich";
import PersonalImpact from "./PersonalImpact";

const DOT: Record<string, string> = { good: "bg-good", bad: "bg-bad", mixed: "bg-mixed", unclear: "bg-mute" };
const LABEL: Record<string, string> = { good: "Helps", bad: "Hurts", mixed: "Mixed", unclear: "Unclear" };

type QA = { q: string; a: string };

export default function DeepDive({ item }: { item: Item }) {
  const e = item.explanation;
  const sections = e.sections ?? [];
  if (sections.length === 0) return null;

  return (
    <div className="mt-6 border-t border-line pt-6">
      {e.takeaways && e.takeaways.length > 0 && (
        <div className="bg-paper border border-line rounded-2xl p-4 sm:p-5">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-vermilion mb-2">If you remember three things</p>
          <ol className="space-y-2">
            {e.takeaways.map((t, k) => (
              <li key={k} className="flex gap-3 text-[15px] leading-relaxed">
                <span className="font-display text-vermilion">{k + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <PersonalImpact id={item.id} />

      <div className="mt-8 space-y-9">
        {sections.map((s, k) => (
          <section key={k}>
            <h4 className="font-display text-[22px] leading-snug tracking-tight mb-3">{s.heading}</h4>
            <Rich text={s.body} />
            {s.example && (
              <div className="mt-4 border-l-4 border-marker bg-marker/15 rounded-r-xl px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-mute mb-1">Example</p>
                <p className="text-[15px] leading-relaxed">{s.example}</p>
              </div>
            )}
          </section>
        ))}
      </div>

      <section className="mt-9">
        <h4 className="font-display text-[22px] leading-snug tracking-tight mb-3">What it means for you</h4>
        <ul className="space-y-3">
          {e.impact.map((m, k) => (
            <li key={k} className="flex gap-3">
              <span className={`mt-[9px] h-2 w-2 rounded-full shrink-0 ${DOT[m.direction]}`} />
              <p className="text-[15.5px] leading-relaxed">
                <strong className="font-semibold">{m.who}.</strong> {m.effect}{" "}
                <span className="text-xs text-mute">({LABEL[m.direction]})</span>
              </p>
            </li>
          ))}
        </ul>
      </section>

      {e.jargon.length > 0 && (
        <details className="mt-8 group">
          <summary className="press cursor-pointer text-sm font-medium select-none list-none flex items-center gap-2">
            <span className="inline-block transition-transform duration-200 ease-out group-open:rotate-90">▸</span>
            Jargon, decoded
          </summary>
          <dl className="mt-3 space-y-2 pl-5">
            {e.jargon.map((j, k) => (
              <div key={k} className="text-sm leading-relaxed">
                <dt className="inline font-semibold">{j.term}: </dt>
                <dd className="inline text-mute">{j.meaning}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      {e.unknowns && (
        <p className="mt-6 text-sm text-mute border-l-2 border-line pl-3 leading-relaxed">
          <span className="font-medium text-ink">Not in the story: </span>
          {e.unknowns}
        </p>
      )}

      <FollowUp item={item} />

    </div>
  );
}

function FollowUp({ item }: { item: Item }) {
  const [thread, setThread] = useState<QA[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chips = (item.explanation.follow_ups ?? []).filter((c) => !thread.some((t) => t.q === c));

  async function ask(question: string) {
    const text = question.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { answer } = await apiFetch<{ answer: string }>("/ask", {
        method: "POST",
        body: JSON.stringify({ id: item.id, question: text, history: thread.slice(-3).map((t) => ({ q: t.q, a: t.a })) }),
      });
      setThread((t) => [...t, { q: text, a: answer }]);
      setQ("");
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      setError(m.match(/"detail":"([^"]+)"/)?.[1] || "Could not answer that. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-9 bg-paper border border-line rounded-2xl p-4 sm:p-5">
      <h4 className="font-display text-xl tracking-tight">Still unclear? Ask.</h4>

      {thread.length > 0 && (
        <div className="mt-4 space-y-4" aria-live="polite">
          {thread.map((t, k) => (
            <div key={k}>
              <p className="text-sm font-semibold">{t.q}</p>
              <div className="mt-1">
                <Rich text={t.a} />
              </div>
            </div>
          ))}
        </div>
      )}

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c}
              onClick={() => ask(c)}
              disabled={loading}
              className="press text-left text-sm border border-line bg-card rounded-full px-3.5 py-1.5 hover:border-ink disabled:opacity-40"
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          ask(q);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          maxLength={600}
          placeholder="Ask your own question"
          aria-label="Ask a follow-up question"
          className="flex-1 min-w-0 bg-card border border-line rounded-full px-4 py-2 text-[15px] placeholder:text-mute/70 focus:outline-none focus:border-ink transition-colors"
        />
        <button
          type="submit"
          disabled={!q.trim() || loading}
          className="press bg-ink text-paper rounded-full px-5 py-2 text-sm font-medium hover:bg-black disabled:opacity-40"
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
    </section>
  );
}
