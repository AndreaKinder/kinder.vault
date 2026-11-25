import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const createServerSupabaseClientMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => createServerSupabaseClientMock(),
}));

import HomePage from "./page";
import LoginPage from "./login/page";

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
  cleanup();
  process.env = { ...ORIGINAL_ENV };
});

describe("App Router Pages (HomePage & LoginPage)", () => {
  it("HomePage renders local setup view when Supabase is unconfigured", async () => {
    const jsx = await HomePage();
    render(jsx);

    expect(screen.getByText("Local setup required")).toBeTruthy();
    expect(screen.getByText("Go to /login")).toBeTruthy();
  });

  it("HomePage redirects to /login when unauthenticated", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    createServerSupabaseClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    await expect(HomePage()).rejects.toThrow("REDIRECT:/login");
  });

  it("HomePage surfaces Supabase query errors instead of failing silently", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const orderMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "relation public.notes does not exist" },
    });
    const eqMock = vi.fn(() => ({ order: orderMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));

    createServerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "andrea@example.com" } },
        }),
      },
      from: vi.fn(() => ({ select: selectMock })),
    });

    const jsx = await HomePage();
    render(jsx);

    expect(screen.getByRole("alert").textContent).toContain(
      "relation public.notes does not exist"
    );
  });

  it("LoginPage redirects to / when already authenticated and renders LoginForm otherwise", async () => {
    const jsxUnconfigured = await LoginPage();
    render(jsxUnconfigured);
    expect(screen.getByText("Sign in to your vault")).toBeTruthy();
    cleanup();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    createServerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
    });

    await expect(LoginPage()).rejects.toThrow("REDIRECT:/");
  });
});
