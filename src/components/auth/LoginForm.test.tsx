import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const signInActionMock = vi.fn();
const signUpActionMock = vi.fn();
const signInDemoActionMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("@/app/actions/auth", () => ({
  signInAction: (...args: unknown[]) => signInActionMock(...args),
  signUpAction: (...args: unknown[]) => signUpActionMock(...args),
  signInDemoAction: (...args: unknown[]) => signInDemoActionMock(...args),
}));

import { LoginForm } from "./LoginForm";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("LoginForm component", () => {
  it("shows missing Supabase warning and disables submit when unconfigured", () => {
    render(<LoginForm supabaseConfigured={false} demoConfigured={false} />);

    expect(screen.getByText(/NEXT_PUBLIC_SUPABASE_URL/i)).toBeTruthy();
    const submit = screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /demo account/i })).toBeNull();
  });

  it("handles sign-in error and success with redirect", async () => {
    signInActionMock
      .mockResolvedValueOnce({ ok: false, error: "Invalid credentials" })
      .mockResolvedValueOnce({ ok: true });

    render(<LoginForm supabaseConfigured={true} demoConfigured={false} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Invalid credentials");
    });
    expect(pushMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/");
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it("stays on /login showing confirmation message when sign-up requires email confirmation", async () => {
    signUpActionMock.mockResolvedValueOnce({
      ok: true,
      requiresEmailConfirmation: true,
    });

    render(<LoginForm supabaseConfigured={true} demoConfigured={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(screen.getByText(/check your inbox/i)).toBeTruthy();
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("signs in via demo account button when demoConfigured is true", async () => {
    signInDemoActionMock.mockResolvedValueOnce({ ok: true });

    render(<LoginForm supabaseConfigured={true} demoConfigured={true} />);

    fireEvent.click(screen.getByRole("button", { name: /demo account/i }));

    await waitFor(() => {
      expect(signInDemoActionMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith("/");
    });
  });
});
