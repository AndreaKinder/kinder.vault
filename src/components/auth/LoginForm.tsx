"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Sparkles } from "lucide-react";
import {
  signInAction,
  signInDemoAction,
  signUpAction,
} from "@/app/actions/auth";

interface LoginFormProps {
  supabaseConfigured: boolean;
  demoConfigured: boolean;
}

export function LoginForm({
  supabaseConfigured,
  demoConfigured,
}: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    startTransition(async () => {
      const result =
        mode === "signin"
          ? await signInAction({ email, password })
          : await signUpAction({ email, password });

      if (!result.ok) {
        setError(result.error ?? "Authentication failed.");
        return;
      }

      if (mode === "signup" && result.requiresEmailConfirmation) {
        setInfo(
          "Account created. Please check your inbox to confirm your email address before signing in."
        );
        return;
      }

      router.push("/");
      router.refresh();
    });
  }

  function handleDemoSignIn() {
    setError(null);
    setInfo(null);

    startTransition(async () => {
      const result = await signInDemoAction();
      if (!result.ok) {
        setError(result.error ?? "Could not sign in with the demo account.");
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/90 p-8 shadow-2xl">
      <div className="mb-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
          KinderVault
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-100">
          {mode === "signin" ? "Sign in to your vault" : "Create your vault"}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Zettelkasten, Daily Journal, Inbox triage, and Full-Text Search.
        </p>
      </div>

      {!supabaseConfigured && (
        <div className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          Missing <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      {info && (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {info}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-xs font-medium text-zinc-300"
          >
            Email address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2.5 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-medium text-zinc-300"
          >
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2.5 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending || !supabaseConfigured}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending
            ? "Processing..."
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      {demoConfigured && (
        <div className="mt-4 border-t border-zinc-800 pt-4">
          <button
            type="button"
            onClick={handleDemoSignIn}
            disabled={isPending || !supabaseConfigured}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4 text-indigo-400" />
            Sign in with demo account
          </button>
        </div>
      )}

      <div className="mt-6 text-center text-xs text-zinc-400">
        {mode === "signin" ? (
          <>
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className="font-medium text-indigo-400 hover:underline"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
              className="font-medium text-indigo-400 hover:underline"
            >
              Sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
