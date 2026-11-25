import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NoteRecord } from "@/lib/vault/types";

const searchNotesActionMock = vi.fn();

vi.mock("@/app/actions/notes", () => ({
  searchNotesAction: (...args: unknown[]) => searchNotesActionMock(...args),
}));

import { SearchModal } from "./SearchModal";

const NOTE_A: NoteRecord = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  user_id: "user-1",
  folder: "zettelkasten",
  slug: "postgres-fts",
  title: "Postgres FTS",
  description: "Full text search",
  content: "# FTS",
  aliases: [],
  tags: ["postgres"],
  project_name: null,
  created_at: "2026-11-25T10:00:00Z",
  updated_at: "2026-11-25T10:00:00Z",
};

const NOTE_B: NoteRecord = {
  ...NOTE_A,
  id: "550e8400-e29b-41d4-a716-446655440002",
  slug: "nextjs-app-router",
  title: "Next.js App Router",
  tags: ["nextjs"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("SearchModal component", () => {
  it("renders nothing when closed and shows empty-vault copy when open with no notes", () => {
    const { rerender } = render(
      <SearchModal
        isOpen={false}
        onClose={vi.fn()}
        onSelectNote={vi.fn()}
        fallbackNotes={[]}
      />
    );
    expect(screen.queryByPlaceholderText(/Search by title/i)).toBeNull();

    rerender(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectNote={vi.fn()}
        fallbackNotes={[]}
      />
    );
    expect(screen.getByText("No notes in your vault yet.")).toBeTruthy();
  });

  it("debounces search queries, renders results, selects note, and closes on Escape", async () => {
    const onClose = vi.fn();
    const onSelectNote = vi.fn();
    searchNotesActionMock.mockResolvedValue({ ok: true, data: [NOTE_B] });

    render(
      <SearchModal
        isOpen={true}
        onClose={onClose}
        onSelectNote={onSelectNote}
        fallbackNotes={[NOTE_A]}
      />
    );

    const input = screen.getByPlaceholderText(/Search by title/i);
    fireEvent.change(input, { target: { value: "nextjs" } });

    await waitFor(() => {
      expect(searchNotesActionMock).toHaveBeenCalledWith({ query: "nextjs" });
      expect(screen.getByText("Next.js App Router")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Next.js App Router"));
    expect(onSelectNote).toHaveBeenCalledWith(NOTE_B);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("displays an error alert when search fails", async () => {
    searchNotesActionMock.mockResolvedValue({
      ok: false,
      error: "Database timeout",
    });

    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectNote={vi.fn()}
        fallbackNotes={[NOTE_A]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Search by title/i), {
      target: { value: "postgres" },
    });

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Database timeout");
    });
  });

  it("discards stale async search responses when query changes rapidly", async () => {
    let resolveFirst!: (value: { ok: boolean; data: NoteRecord[] }) => void;
    const firstPromise = new Promise<{ ok: boolean; data: NoteRecord[] }>((r) => {
      resolveFirst = r;
    });

    searchNotesActionMock
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce({ ok: true, data: [NOTE_B] });

    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectNote={vi.fn()}
        fallbackNotes={[NOTE_A]}
      />
    );

    const input = screen.getByPlaceholderText(/Search by title/i);
    fireEvent.change(input, { target: { value: "first" } });

    await waitFor(() => {
      expect(searchNotesActionMock).toHaveBeenCalledWith({ query: "first" });
    });

    fireEvent.change(input, { target: { value: "second" } });

    await waitFor(() => {
      expect(screen.getByText("Next.js App Router")).toBeTruthy();
    });

    await act(async () => {
      resolveFirst({ ok: true, data: [NOTE_A] });
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(screen.getByText("Next.js App Router")).toBeTruthy();
    expect(screen.queryByText("Postgres FTS")).toBeNull();
  });
});
