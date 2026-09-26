import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import Logo from "@/components/Logo";
import Workspace from "@/components/Workspace";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen">
      <header className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
        <Logo href="/dashboard" />
        <div className="flex items-center gap-4">
          <span className="hidden sm:block text-sm text-mute">{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <Workspace />
    </main>
  );
}
