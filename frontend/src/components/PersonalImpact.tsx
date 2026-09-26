"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/lib/profileContext";
import type { PersonalImpactData } from "@/lib/types";

const DOT: Record<string, string> = { good: "bg-good", bad: "bg-bad", mixed: "bg-mixed", unclear: "bg-mute" };

export default function PersonalImpact({ id }: { id: string }) {
  const { profile, loaded, openProfile } = useProfile();
  const [data, setData] = useState<PersonalImpactData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sig = JSON.stringify(profile);

  useEffect(() => {
    if (!profile) return;
    let dead = false;
    setLoading(true);
    setErr(null);
    apiFetch<{ personal: PersonalImpactData }>("/personal", { method: "POST", body: JSON.stringify({ id }) })
      .then((d) => !dead && setData(d.personal))
      .catch((e) => {
        if (dead) return;
        const m = e instanceof Error ? e.message : "";
        setErr(m.match(/"detail":"([^"]+)"/)?.[1] || "Could not tailor this just now.");
      })
      .finally(() => !dead && setLoading(false));
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sig]);

  if (!loaded) return null;

  if (!profile)
    return (
      <div className="mt-6 border border-dashed border-line rounded-2xl p-4 sm:p-5">
        <p className="text-[15px] leading-relaxed">
          Want this explained for your own life? Tell Plainly your situation and it will show how this story could touch you.
        </p>
        <button
          onClick={openProfile}
          className="press mt-3 bg-ink text-paper rounded-full px-4 py-2 text-sm font-medium hover:bg-black"
        >
          Add your situation
        </button>
      </div>
    );

  return (
    <div className="mt-6 bg-marker/15 border border-marker/60 rounded-2xl p-4 sm:p-5">
      <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-mute mb-2">How this could affect you</p>
      {loading && !data && (
        <div className="space-y-2" aria-hidden>
          <div className="skeleton h-5 w-4/5" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-2/3" />
        </div>
      )}
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      {data && (
        <div className="rise">
          <p className="font-display text-xl leading-snug tracking-tight">{data.headline}</p>
          <p className="mt-2 text-[15px] leading-relaxed">{data.summary}</p>
          <ul className="mt-3 space-y-2.5">
            {data.points.map((pt, k) => (
              <li key={k} className="flex gap-3">
                <span className={`mt-[9px] h-2 w-2 rounded-full shrink-0 ${DOT[pt.direction]}`} />
                <p className="text-[15px] leading-relaxed">
                  <strong className="font-semibold">{pt.label}.</strong> {pt.detail}
                </p>
              </li>
            ))}
          </ul>
          {data.depends_on && <p className="mt-3 text-sm text-mute leading-relaxed">{data.depends_on}</p>}
          <p className="mt-3 text-xs text-mute">Information based on what you told Plainly. Not financial advice.</p>
        </div>
      )}
    </div>
  );
}
