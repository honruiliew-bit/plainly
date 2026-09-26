"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/lib/profileContext";
import type { Profile } from "@/lib/types";

const HOUSING: [Profile["housing"], string][] = [
  ["rent", "Renting"],
  ["own_mortgage", "Own with a mortgage"],
  ["own_outright", "Own outright"],
  ["family", "Living with family"],
  ["other", "Other"],
];
const DEBTS: [Profile["debts"][number], string][] = [
  ["student", "Student loans"],
  ["car", "Car loan"],
  ["credit_card", "Credit card balance"],
  ["personal", "Personal loan"],
  ["none", "No debt"],
];
const SAVINGS: [Profile["savings"], string][] = [
  ["none", "None yet"],
  ["small", "A small cushion"],
  ["months", "Several months of expenses"],
  ["substantial", "Substantial savings or investments"],
];
const WORK: [Profile["work"], string][] = [
  ["student", "Student"],
  ["employed", "Employed"],
  ["self_employed", "Self-employed"],
  ["retired", "Retired"],
  ["between_jobs", "Between jobs"],
];

type Interests = { topics: { topic: string; count: number }[]; total: number };

export default function ProfileView() {
  const { profile, setProfile } = useProfile();
  const [housing, setHousing] = useState<Profile["housing"] | null>(profile?.housing ?? null);
  const [debts, setDebts] = useState<Profile["debts"]>(profile?.debts ?? []);
  const [savings, setSavings] = useState<Profile["savings"] | null>(profile?.savings ?? null);
  const [work, setWork] = useState<Profile["work"] | null>(profile?.work ?? null);
  const [location, setLocation] = useState(profile?.location ?? "");
  const [notes, setNotes] = useState(profile?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [interests, setInterests] = useState<Interests | null>(null);

  useEffect(() => {
    apiFetch<Interests>("/interests").then(setInterests).catch(() => {});
  }, []);

  // Fill the form once the saved profile arrives.
  useEffect(() => {
    if (!profile) return;
    setHousing(profile.housing);
    setDebts(profile.debts);
    setSavings(profile.savings);
    setWork(profile.work);
    setLocation(profile.location);
    setNotes(profile.notes);
  }, [profile]);

  function toggleDebt(d: Profile["debts"][number]) {
    setDone(false);
    setDebts((cur) => {
      if (d === "none") return cur.includes("none") ? [] : ["none"];
      const without = cur.filter((x) => x !== "none");
      return without.includes(d) ? without.filter((x) => x !== d) : [...without, d];
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!housing || !savings || !work) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await apiFetch<{ profile: Profile }>("/profile", {
        method: "POST",
        body: JSON.stringify({ housing, debts, savings, work, location: location.trim(), notes: notes.trim() }),
      });
      setProfile(res.profile);
      setDone(true);
    } catch {
      setErr("Could not save that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const ready = housing && savings && work;
  const max = Math.max(1, ...(interests?.topics.map((t) => t.count) ?? [1]));

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display text-2xl tracking-tight">Your interests</h2>
        <p className="text-mute mt-1 text-[15px] leading-relaxed">Built from the articles you save. It shapes your For you feed.</p>
        {interests && interests.total === 0 && (
          <p className="mt-4 text-sm text-mute">Nothing yet. Save a few deep dives and your interests appear here.</p>
        )}
        {interests && interests.total > 0 && (
          <ul className="mt-4 space-y-2.5">
            {interests.topics.map((t) => (
              <li key={t.topic} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs uppercase tracking-[0.1em] font-medium text-mute">{t.topic}</span>
                <span className="flex-1 h-2.5 rounded-full bg-line overflow-hidden">
                  <span className="block h-full rounded-full bg-vermilion" style={{ width: `${(t.count / max) * 100}%` }} />
                </span>
                <span className="w-6 text-right text-sm tabular-nums">{t.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={save} className="bg-card border border-line rounded-2xl p-5 sm:p-6">
        <h2 className="font-display text-2xl tracking-tight">Your situation</h2>
        <p className="text-mute mt-1 text-[15px] leading-relaxed">
          A few taps so each story can show how it could touch you. It stays private and is used only to tailor your
          explanations.
        </p>

        <Group label="Where you live">
          {HOUSING.map(([v, l]) => (
            <Chip key={v} on={housing === v} onClick={() => { setHousing(v); setDone(false); }}>{l}</Chip>
          ))}
        </Group>
        <Group label="Debts (pick any)">
          {DEBTS.map(([v, l]) => (
            <Chip key={v} on={debts.includes(v)} onClick={() => toggleDebt(v)}>{l}</Chip>
          ))}
        </Group>
        <Group label="Savings">
          {SAVINGS.map(([v, l]) => (
            <Chip key={v} on={savings === v} onClick={() => { setSavings(v); setDone(false); }}>{l}</Chip>
          ))}
        </Group>
        <Group label="Work">
          {WORK.map(([v, l]) => (
            <Chip key={v} on={work === v} onClick={() => { setWork(v); setDone(false); }}>{l}</Chip>
          ))}
        </Group>

        <label className="block mt-6">
          <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-mute">Where (optional)</span>
          <input
            value={location}
            onChange={(e) => { setLocation(e.target.value); setDone(false); }}
            maxLength={80}
            placeholder="City and country"
            className="mt-2 w-full bg-paper border border-line rounded-xl px-4 py-2.5 text-[15px] placeholder:text-mute/70 focus:outline-none focus:border-ink transition-colors"
          />
        </label>
        <label className="block mt-4">
          <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-mute">Anything else that affects your money (optional)</span>
          <input
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setDone(false); }}
            maxLength={200}
            placeholder="e.g. Saving for a first home, paid in a foreign currency"
            className="mt-2 w-full bg-paper border border-line rounded-xl px-4 py-2.5 text-[15px] placeholder:text-mute/70 focus:outline-none focus:border-ink transition-colors"
          />
        </label>

        <div className="mt-6 flex items-center gap-4">
          <button
            type="submit"
            disabled={!ready || saving}
            className="press bg-vermilion text-white rounded-full px-6 py-2.5 text-sm font-medium hover:brightness-95 disabled:opacity-40"
          >
            {saving ? "Saving..." : profile ? "Update" : "Save"}
          </button>
          {done && <span className="text-sm text-good" aria-live="polite">Saved. New deep dives will use this.</span>}
          {err && <span role="alert" className="text-sm text-bad">{err}</span>}
        </div>
      </form>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-mute mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`press text-sm rounded-full px-3.5 py-1.5 border ${
        on ? "bg-ink text-paper border-ink" : "border-line bg-paper text-ink hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}
