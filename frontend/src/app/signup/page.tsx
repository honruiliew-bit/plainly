"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

export default function Page() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  const field =
    "w-full bg-paper border border-line rounded-xl px-4 py-3 text-[15px] placeholder:text-mute/70 focus:outline-none focus:border-ink transition-colors";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-sm bg-card border border-line rounded-2xl p-8">
        <h1 className="font-display text-3xl tracking-tight mb-6">Make an account</h1>
        <form onSubmit={handleSignup} className="space-y-3">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={field} />
          <input type="password" placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" className={field} />
          {error && <p role="alert" className="text-bad text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="press w-full bg-ink text-paper rounded-xl py-3 text-[15px] font-medium hover:bg-black disabled:opacity-50">
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>
        <p className="mt-5 text-sm text-mute text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-ink font-medium underline underline-offset-4">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
