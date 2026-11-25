"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getDemoCredentials } from "@/lib/supabase/demo-config";

export interface AuthActionResult {
  ok: boolean;
  error?: string;
  requiresEmailConfirmation?: boolean;
}

const credentialsSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long"),
});

export async function signInAction(input: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  if (!getSupabaseConfig().isConfigured) {
    return {
      ok: false,
      error: "Supabase environment variables are missing in .env.local.",
    };
  }

  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid credentials",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function signUpAction(input: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  if (!getSupabaseConfig().isConfigured) {
    return {
      ok: false,
      error: "Supabase environment variables are missing in .env.local.",
    };
  }

  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid sign-up data",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return {
    ok: true,
    requiresEmailConfirmation: !data.session,
  };
}

export async function signInDemoAction(): Promise<AuthActionResult> {
  const demo = getDemoCredentials();
  if (!demo.isConfigured) {
    return {
      ok: false,
      error: "Demo account is not configured in environment variables.",
    };
  }

  return signInAction({ email: demo.email, password: demo.password });
}

export async function signOutAction(): Promise<void> {
  if (getSupabaseConfig().isConfigured) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/");
  redirect("/login");
}
