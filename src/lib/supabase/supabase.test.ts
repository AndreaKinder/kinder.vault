// @vitest-environment node
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

const createBrowserClientMock = vi.fn((url: string, key: string) => {
  void url;
  void key;
  return { kind: "browser-client" };
});
const createServerClientMock = vi.fn();
const cookiesMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: (url: string, key: string) =>
    createBrowserClientMock(url, key),
  createServerClient: (...args: unknown[]) => createServerClientMock(...args),
}));

vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}));

import { getSupabaseConfig } from "./config";
import { getDemoCredentials } from "./demo-config";
import { createClient } from "./client";
import { createServerSupabaseClient } from "./server";
import { updateSession } from "./middleware";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.DEMO_EMAIL;
  delete process.env.DEMO_PASSWORD;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("Supabase configuration & clients", () => {
  it("reports Supabase config state accurately", () => {
    expect(getSupabaseConfig()).toEqual({
      url: "",
      anonKey: "",
      isConfigured: false,
    });

    process.env.NEXT_PUBLIC_SUPABASE_URL = "  https://demo.supabase.co  ";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "  anon-key  ";

    expect(getSupabaseConfig()).toEqual({
      url: "https://demo.supabase.co",
      anonKey: "anon-key",
      isConfigured: true,
    });
  });

  it("reports server-only demo credentials accurately", () => {
    expect(getDemoCredentials()).toEqual({
      email: "",
      password: "",
      isConfigured: false,
    });

    process.env.DEMO_EMAIL = " demo@example.com ";
    process.env.DEMO_PASSWORD = " secret123 ";

    expect(getDemoCredentials()).toEqual({
      email: "demo@example.com",
      password: "secret123",
      isConfigured: true,
    });
  });

  it("throws in createClient when Supabase env vars are missing and returns browser client when configured", () => {
    expect(() => createClient()).toThrow(/Supabase is not configured/i);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const client = createClient();
    expect(client).toEqual({ kind: "browser-client" });
    expect(createBrowserClientMock).toHaveBeenCalledWith(
      "https://demo.supabase.co",
      "anon-key"
    );
  });

  it("creates server client with cookie adapters and handles readonly cookieStore.set gracefully", async () => {
    await expect(createServerSupabaseClient()).rejects.toThrow(
      /Supabase is not configured/i
    );

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const setMock = vi.fn(() => {
      throw new Error("Cookies cannot be set in Server Component");
    });
    const getAllMock = vi.fn(() => [{ name: "sb-token", value: "abc" }]);
    cookiesMock.mockResolvedValue({ getAll: getAllMock, set: setMock });

    createServerClientMock.mockImplementation((_u, _k, opts) => {
      expect(opts.cookies.getAll()).toEqual([{ name: "sb-token", value: "abc" }]);
      expect(() =>
        opts.cookies.setAll([{ name: "sb-token", value: "xyz", options: {} }])
      ).not.toThrow();
      return { kind: "server-client" };
    });

    const client = await createServerSupabaseClient();
    expect(client).toEqual({ kind: "server-client" });
    expect(setMock).toHaveBeenCalled();
  });

  it("skips session refresh in middleware when Supabase is unconfigured and refreshes when configured", async () => {
    const req1 = new NextRequest("http://localhost:3000/");
    const res1 = await updateSession(req1);
    expect(res1.status).toBe(200);
    expect(createServerClientMock).not.toHaveBeenCalled();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const getUserMock = vi.fn().mockResolvedValue({ data: { user: null } });
    createServerClientMock.mockImplementation((_u, _k, opts) => {
      opts.cookies.getAll();
      opts.cookies.setAll([
        { name: "sb-access", value: "token-1", options: { path: "/" } },
      ]);
      return { auth: { getUser: getUserMock } };
    });

    const req2 = new NextRequest("http://localhost:3000/");
    const res2 = await updateSession(req2);
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(res2.cookies.get("sb-access")?.value).toBe("token-1");
  });
});
