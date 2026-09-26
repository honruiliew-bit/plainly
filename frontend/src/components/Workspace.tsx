"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Item, Profile } from "@/lib/types";
import { ProfileContext } from "@/lib/profileContext";
import ExplainCard, { CardSkeleton } from "./ExplainCard";
import BriefView from "./BriefView";
import ProfileView from "./ProfileView";

type Tab = "brief" | "feed" | "explain" | "saved" | "you";
const TABS: { id: Tab; label: string }[] = [
  { id: "brief", label: "Brief" },
  { id: "feed", label: "Feed" },
  { id: "explain", label: "Explain" },
  { id: "saved", label: "Saved" },
  { id: "you", label: "You" },
];
const TOPICS = ["all", "rates", "inflation", "jobs", "markets", "housing", "companies", "policy"];
const PAGE = 20;
const POLL_MS = 60_000;

export default function Workspace() {
  const [tab, setTab] = useState<Tab>("brief");
  const [saved, setSaved] = useState<Item[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    apiFetch<{ items: Item[] }>("/saved")
      .then((d) => setSaved(d.items))
      .catch(() => {});
    apiFetch<{ profile: Profile | null }>("/profile")
      .then((d) => setProfile(d.profile))
      .catch(() => {})
      .finally(() => setProfileLoaded(true));
  }, []);

  const savedIds = new Set(saved.map((s) => s.id));

  const toggleSave = useCallback(async (item: Item, on: boolean) => {
    setSaved((s) => (on ? [item, ...s.filter((x) => x.id !== item.id)] : s.filter((x) => x.id !== item.id)));
    try {
      await apiFetch(on ? "/save" : "/unsave", { method: "POST", body: JSON.stringify({ id: item.id }) });
    } catch {
      // put it back if the server refused
      setSaved((s) => (on ? s.filter((x) => x.id !== item.id) : [item, ...s]));
    }
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, loaded: profileLoaded, setProfile, openProfile: () => setTab("you") }}>
    <div className="max-w-3xl mx-auto px-6 pb-24">
      <div role="tablist" className="flex gap-1 border-b border-line mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`press px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              tab === t.id ? "border-ink text-ink" : "border-transparent text-mute hover:text-ink"
            }`}
          >
            {t.label}
            {t.id === "saved" && saved.length > 0 && <span className="ml-1.5 text-xs text-mute">{saved.length}</span>}
          </button>
        ))}
      </div>

      {tab === "brief" && <BriefView />}
      {tab === "feed" && <Feed savedIds={savedIds} onToggleSave={toggleSave} hasSaves={saved.length > 0} />}
      {tab === "explain" && (
        <Explain
          savedIds={savedIds}
          onToggleSave={toggleSave}
          onDone={(item) => setSaved((s) => [item, ...s.filter((x) => x.id !== item.id)])}
        />
      )}
      {tab === "saved" && (
        <Saved items={saved} savedIds={savedIds} onToggleSave={toggleSave} onExplain={() => setTab("explain")} />
      )}
      {tab === "you" && <ProfileView />}
    </div>
    </ProfileContext.Provider>
  );
}

type SaveProps = { savedIds: Set<string>; onToggleSave: (i: Item, on: boolean) => void };

function Feed({ savedIds, onToggleSave, hasSaves }: SaveProps & { hasSaves: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [topic, setTopic] = useState("all");
  const [err, setErr] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [updated, setUpdated] = useState<number | null>(null);
  const [, tick] = useState(0);
  const [sortPick, setSortPick] = useState<"auto" | "foryou" | "latest">("auto");
  const [interests, setInterests] = useState<{ topic: string; count: number }[]>([]);
  const sort = sortPick === "auto" ? (hasSaves ? "foryou" : "latest") : sortPick;

  useEffect(() => {
    apiFetch<{ topics: { topic: string; count: number }[] }>("/interests")
      .then((d) => setInterests(d.topics))
      .catch(() => {});
  }, [hasSaves]);

  const load = useCallback(
    (silent: boolean) => {
      if (!silent) {
        setItems(null);
        setErr(null);
      }
      apiFetch<{ items: Item[] }>(`/feed?limit_n=100&sort=${sort}${topic !== "all" ? `&topic=${topic}` : ""}`)
        .then((d) => {
          setItems(d.items);
          setUpdated(Date.now());
        })
        .catch((e) => {
          if (!silent) setErr(e.message);
        });
    },
    [topic, sort]
  );

  useEffect(() => {
    setShown(PAGE);
    load(false);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, POLL_MS);
    const clock = setInterval(() => tick((n) => n + 1), 30_000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  const mins = updated ? Math.floor((Date.now() - updated) / 60000) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 text-xs text-mute">
          <span className="h-2 w-2 rounded-full bg-good" />
          {updated ? (mins < 1 ? "Live, updated just now" : `Live, updated ${mins}m ago`) : "Loading"}
        </div>
        <div className="flex items-center gap-1 rounded-full border border-line p-0.5" role="group" aria-label="Sort feed">
          {(["foryou", "latest"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSortPick(k)}
              aria-pressed={sort === k}
              className={`press text-xs font-medium rounded-full px-3 py-1 ${sort === k ? "bg-ink text-paper" : "text-mute hover:text-ink"}`}
            >
              {k === "foryou" ? "For you" : "Latest"}
            </button>
          ))}
        </div>
      </div>
      {sort === "foryou" && (
        <p className="text-xs text-mute -mt-2 mb-4">
          {interests.length > 0
            ? `Ranked by your saves: ${interests.slice(0, 3).map((t) => `${t.topic} (${t.count})`).join(", ")}`
            : "Save a few deep dives and this feed learns what you care about."}
        </p>
      )}
      <div className="flex gap-2 flex-wrap mb-6">
        {TOPICS.map((t) => (
          <button
            key={t}
            onClick={() => setTopic(t)}
            className={`press text-xs uppercase tracking-[0.1em] font-medium rounded-full px-3 py-1.5 border ${
              topic === t ? "bg-ink text-paper border-ink" : "border-line text-mute hover:border-ink hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {err && <p className="text-bad text-sm">Could not load the feed. {err}</p>}
      {!items && !err && (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}
      {items && items.length === 0 && <p className="text-mute">Nothing here yet. New stories arrive every few minutes.</p>}
      <div className="space-y-4">
        {items?.slice(0, shown).map((it, i) => (
          <ExplainCard
            key={it.id}
            item={it}
            index={Math.min(i, 6)}
            saved={savedIds.has(it.id)}
            onToggleSave={onToggleSave}
          />
        ))}
      </div>
      {items && items.length > shown && (
        <button
          onClick={() => setShown((n) => n + PAGE)}
          className="press mt-6 w-full border border-line rounded-full py-3 text-sm font-medium hover:border-ink"
        >
          Show more ({items.length - shown} left)
        </button>
      )}
    </div>
  );
}

function Explain({ onDone, savedIds, onToggleSave }: SaveProps & { onDone: (i: Item) => void }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Item | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const v = input.trim();
    if (!v) return;
    setLoading(true);
    setErr(null);
    setResult(null);
    const isUrl = /^https?:\/\/\S+$/i.test(v);
    try {
      const item = await apiFetch<Item>("/explain", {
        method: "POST",
        body: JSON.stringify(isUrl ? { url: v } : { text: v }),
      });
      setResult(item);
      onDone(item);
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Something went wrong.";
      const detail = m.match(/"detail":"([^"]+)"/)?.[1];
      setErr(detail || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={run}>
        <label htmlFor="q" className="block font-display text-2xl tracking-tight mb-3">
          Paste a headline, an article, or a link.
        </label>
        <textarea
          id="q"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(e as unknown as React.FormEvent);
          }}
          rows={5}
          maxLength={20000}
          placeholder="e.g. Why is inflation still high even though rates went up?"
          className="w-full bg-card border border-line rounded-2xl p-4 text-[15px] leading-relaxed placeholder:text-mute/70 focus:outline-none focus:border-ink transition-colors resize-y"
        />
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-xs text-mute">Cmd or Ctrl + Enter to run. Saved automatically. 15 per hour.</p>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="press bg-vermilion text-white rounded-full px-6 py-2.5 text-sm font-medium hover:brightness-95 disabled:opacity-40"
          >
            {loading ? "Writing your deep dive..." : "Break it down"}
          </button>
        </div>
      </form>

      <div className="mt-8" aria-live="polite">
        {err && <p role="alert" className="text-bad text-sm">{err}</p>}
        {loading && <CardSkeleton />}
        {result && !loading && (
          <ExplainCard key={result.id} item={result} defaultOpen saved={savedIds.has(result.id)} onToggleSave={onToggleSave} />
        )}
      </div>
    </div>
  );
}

function Saved({ items, savedIds, onToggleSave, onExplain }: SaveProps & { items: Item[]; onExplain: () => void }) {
  if (items.length === 0)
    return (
      <div className="text-center py-16">
        <p className="font-display text-2xl">No saved articles yet.</p>
        <p className="text-mute mt-2 max-w-sm mx-auto leading-relaxed">
          Anything you write in Explain is saved here. You can also save a deep dive from the Feed.
        </p>
        <button onClick={onExplain} className="press mt-5 bg-ink text-paper rounded-full px-5 py-2.5 text-sm font-medium">
          Explain something
        </button>
      </div>
    );
  return (
    <div className="space-y-4">
      {items.map((it, i) => (
        <ExplainCard key={it.id} item={it} index={Math.min(i, 6)} saved={savedIds.has(it.id)} onToggleSave={onToggleSave} />
      ))}
    </div>
  );
}
