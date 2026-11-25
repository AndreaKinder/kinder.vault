import Link from "next/link";
import { redirect } from "next/navigation";
import { VaultWorkspace } from "@/components/vault/VaultWorkspace";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { NoteRecord } from "@/lib/vault/types";

export default async function HomePage() {
  const { isConfigured } = getSupabaseConfig();

  if (!isConfigured) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
          Local setup required
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          KinderVault
        </h1>
        <p className="text-sm text-zinc-400">
          Copy <code>.env.example</code> to <code>.env.local</code>, add your
          Supabase credentials, and run <code>supabase/schema.sql</code> in the
          SQL Editor to activate the vault.
        </p>
        <Link
          href="/login"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Go to /login
        </Link>
      </main>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: notes, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <VaultWorkspace
      initialNotes={(notes ?? []) as NoteRecord[]}
      initialError={
        error ? `Failed to load notes: ${error.message}` : null
      }
      userEmail={user.email ?? "user"}
    />
  );
}
