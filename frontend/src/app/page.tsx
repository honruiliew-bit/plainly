import Link from "next/link";
import Logo from "@/components/Logo";

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/login" className="press text-mute hover:text-ink">
            Sign in
          </Link>
          <Link href="/signup" className="press bg-ink text-paper rounded-full px-4 py-2 font-medium hover:bg-black">
            Get started
          </Link>
        </nav>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-12 sm:pt-20 pb-16 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
        <div>
          <h1 className="font-display text-5xl sm:text-6xl leading-[1.02] tracking-tight">
            The news assumes you already know the <span className="hl">basics</span>.
          </h1>
          <p className="mt-6 text-lg text-mute max-w-md leading-relaxed">
            Plainly turns rate decisions, bond moves and jobs reports into what happened, how it works, and what it
            does to your rent, loans and savings.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="press bg-vermilion text-white rounded-full px-6 py-3 font-medium hover:brightness-95">
              Explain a headline
            </Link>
            <a href="#how" className="press border border-ink/20 rounded-full px-6 py-3 font-medium hover:border-ink">
              How it works
            </a>
          </div>
        </div>

        <div className="relative">
          <div className="bg-card border border-line rounded-2xl p-6 rotate-[1.2deg] shadow-[0_24px_40px_-28px_rgba(22,19,14,0.5)]">
            <p className="text-xs uppercase tracking-[0.12em] text-mute mb-3">Before</p>
            <p className="text-sm text-mute line-through decoration-line">
              Fed holds benchmark rate steady, signals data-dependent path as 10-year yield curve steepens
            </p>
            <p className="text-xs uppercase tracking-[0.12em] text-mute mt-6 mb-3">Plainly</p>
            <p className="font-display text-2xl leading-snug">
              <span className="hl">Borrowing will not get cheaper yet.</span>
            </p>
            <ul className="mt-4 space-y-2 text-[15px] leading-relaxed">
              <li className="flex gap-3">
                <span className="mt-[7px] h-2 w-2 rounded-full bg-bad shrink-0" />
                <span><strong>Mortgage shoppers.</strong> Rates stay near today&apos;s level.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-[7px] h-2 w-2 rounded-full bg-good shrink-0" />
                <span><strong>Savers.</strong> High-yield accounts keep paying well.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-line">
        <div className="max-w-5xl mx-auto px-6 py-14 grid sm:grid-cols-3 gap-8">
          {[
            ["1", "A live feed", "Dozens of stories from major finance outlets, rewritten in plain words and refreshed every few minutes."],
            ["2", "Deep dives", "Open any story or paste your own. Get the ideas underneath it and how it reaches your wallet, then ask follow-ups."],
            ["3", "A daily brief", "Every morning, the day's biggest money stories in about three minutes."],
          ].map(([n, t, d]) => (
            <div key={n}>
              <p className="font-display text-3xl text-vermilion">{n}</p>
              <h2 className="mt-2 font-semibold">{t}</h2>
              <p className="mt-1 text-mute text-[15px] leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
