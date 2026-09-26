export type Impact = { who: string; effect: string; direction: "good" | "bad" | "mixed" | "unclear" };

export type Section = { heading: string; body: string; example: string };

export type Explanation = {
  is_financial: boolean;
  plain_headline: string;
  tldr: string;
  mechanism: string;
  sections?: Section[];
  takeaways?: string[];
  follow_ups?: string[];
  impact: Impact[];
  jargon: { term: string; meaning: string }[];
  unknowns: string;
  topic: string;
};

export type Item = {
  id: string;
  kind: "feed" | "custom";
  title: string;
  source: string | null;
  url: string | null;
  published_at: string | null;
  created_at: string | null;
  explanation: Explanation;
  match?: boolean;
};

export type BriefItem = {
  headline: string;
  what: string;
  why: string;
  topic: string;
  links?: { source: string; url: string }[];
};
export type BriefPayload = { headline: string; big_picture: string; items: BriefItem[]; watch_next: string };
export type BriefRow = {
  id: string;
  title: string;
  published_at: string | null;
  explanation: BriefPayload;
};

export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function readMinutes(e: Explanation): number {
  if (!e.sections?.length) return 5;
  const words = (e.sections ?? []).reduce((n, s) => n + s.body.split(/\s+/).length + s.example.split(/\s+/).length, 0);
  return Math.max(2, Math.round(words / 200));
}

export type Profile = {
  housing: "rent" | "own_mortgage" | "own_outright" | "family" | "other";
  debts: ("student" | "car" | "credit_card" | "personal" | "none")[];
  savings: "none" | "small" | "months" | "substantial";
  work: "student" | "employed" | "self_employed" | "retired" | "between_jobs";
  location: string;
  notes: string;
};

export type PersonalImpactData = {
  headline: string;
  summary: string;
  points: { label: string; detail: string; direction: "good" | "bad" | "mixed" | "unclear" }[];
  depends_on: string;
};
