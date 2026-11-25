import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

const revalidatePathMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  void url;
  throw new Error("NEXT_REDIRECT");
});
const createServerSupabaseClientMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => createServerSupabaseClientMock(),
}));

import {
  signInAction,
  signInDemoAction,
  signOutAction,
  signUpAction,
} from "./auth";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  };
  delete process.env.DEMO_EMAIL;
  delete process.env.DEMO_PASSWORD;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("Auth Server Actions", () => {
  it("rejects signInAction when Supabase is unconfigured or credentials are invalid", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const unconfigured = await signInAction({
      email: "user@example.com",
      password: "password123",
    });
    expect(unconfigured.ok).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    const badEmail = await signInAction({
      email: "not-an-email",
      password: "password123",
    });
    expect(badEmail.ok).toBe(false);

    const shortPass = await signInAction({
      email: "user@example.com",
      password: "123",
    });
    expect(shortPass.ok).toBe(false);
  });

  it("handles signInAction Supabase error and success", async () => {
    const signInWithPassword = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: "Invalid login credentials" } })
      .mockResolvedValueOnce({ error: null });

    createServerSupabaseClientMock.mockResolvedValue({
      auth: { signInWithPassword },
    });

    const failed = await signInAction({
      email: "user@example.com",
      password: "password123",
    });
    expect(failed).toEqual({ ok: false, error: "Invalid login credentials" });

    const ok = await signInAction({
      email: "user@example.com",
      password: "password123",
    });
    expect(ok).toEqual({ ok: true });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("handles signUpAction with and without email confirmation", async () => {
    const signUp = vi
      .fn()
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({
        data: { session: { access_token: "tok" } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { session: null },
        error: { message: "User already registered" },
      });

    createServerSupabaseClientMock.mockResolvedValue({ auth: { signUp } });

    const needsConfirm = await signUpAction({
      email: "new@example.com",
      password: "password123",
    });
    expect(needsConfirm).toEqual({ ok: true, requiresEmailConfirmation: true });

    const immediate = await signUpAction({
      email: "new2@example.com",
      password: "password123",
    });
    expect(immediate).toEqual({ ok: true, requiresEmailConfirmation: false });

    const failed = await signUpAction({
      email: "dup@example.com",
      password: "password123",
    });
    expect(failed).toEqual({ ok: false, error: "User already registered" });
  });

  it("handles signInDemoAction unconfigured and configured flows", async () => {
    const unconfigured = await signInDemoAction();
    expect(unconfigured.ok).toBe(false);

    process.env.DEMO_EMAIL = "demo@kindervault.app";
    process.env.DEMO_PASSWORD = "demo-password";

    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    createServerSupabaseClientMock.mockResolvedValue({
      auth: { signInWithPassword },
    });

    const ok = await signInDemoAction();
    expect(ok).toEqual({ ok: true });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "demo@kindervault.app",
      password: "demo-password",
    });
  });

  it("signs out and redirects to /login in signOutAction", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    createServerSupabaseClientMock.mockResolvedValue({ auth: { signOut } });

    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT");
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
