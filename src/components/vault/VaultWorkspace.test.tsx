import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NoteRecord } from "@/lib/vault/types";

const createNoteActionMock = vi.fn();
const openOrCreateTodayNoteActionMock = vi.fn();
const searchNotesActionMock = vi.fn();
const signOutActionMock = vi.fn();

vi.mock("@/app/actions/notes", () => ({
  createNoteAction: (...args: unknown[]) => createNoteActionMock(...args),
  openOrCreateTodayNoteAction: (...args: unknown[]) =>
    openOrCreateTodayNoteActionMock(...args),
  searchNotesAction: (...args: unknown[]) => searchNotesActionMock(...args),
  updateNoteAction: vi.fn(),
  deleteNoteAction: vi.fn(),
  classifyInboxNoteAction: vi.fn(),
}));

vi.mock("@/app/actions/auth", () => ({
  signOutAction: (...args: unknown[]) => signOutActionMock(...args),
}));

import { VaultWorkspace } from "./VaultWorkspace";

const INBOX_NOTE: NoteRecord = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  user_id: "user-1",
  folder: "inbox",
  slug: "capture-1",
  title: "First Capture",
  description: "Inbox item",
  content: "# Capture",
  aliases: [],
  tags: ["inbox"],
  project_name: null,
  created_at: "2026-11-25T10:00:00Z",
  updated_at: "2026-11-25T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("VaultWorkspace component", () => {
  it("renders all 6 vault folders, initialError alert, and empty editor state when no notes exist", () => {
    render(
      <VaultWorkspace
        initialNotes={[]}
        userEmail="andrea@example.com"
        initialError="Database connection failed"
      />
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Database connection failed"
    );
    expect(screen.getByText("Select a note or create a new one")).toBeTruthy();

    for (const label of [
      "Inbox",
      "Journal",
      "Zettelkasten",
      "Projects",
      "To-Do",
      "Prompts",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("supports Inbox quick capture, opening Today's Note, and Ctrl+K search modal", async () => {
    const createdInbox: NoteRecord = {
      ...INBOX_NOTE,
      id: "550e8400-e29b-41d4-a716-446655440009",
      slug: "new-idea-1234",
      title: "New Idea",
    };
    const todayJournal: NoteRecord = {
      ...INBOX_NOTE,
      id: "550e8400-e29b-41d4-a716-446655440010",
      folder: "journal",
      slug: "2026-11-25",
      title: "Journal 2026-11-25",
      tags: ["daily-notes"],
    };

    createNoteActionMock.mockResolvedValueOnce({ ok: true, data: createdInbox });
    openOrCreateTodayNoteActionMock.mockResolvedValueOnce({
      ok: true,
      data: todayJournal,
    });

    render(
      <VaultWorkspace initialNotes={[INBOX_NOTE]} userEmail="andrea@example.com" />
    );

    const quickInput = screen.getByPlaceholderText(/Quick capture in Inbox/i);
    fireEvent.change(quickInput, { target: { value: "New Idea" } });
    fireEvent.submit(quickInput.closest("form")!);

    await waitFor(() => {
      expect(createNoteActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: "inbox",
          title: "New Idea",
        })
      );
      expect(screen.getByText("New Idea")).toBeTruthy();
      const todayBtn = screen.getByRole("button", {
        name: /Today's Note/i,
      }) as HTMLButtonElement;
      expect(todayBtn.disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: /Today's Note/i }));
    await waitFor(() => {
      expect(openOrCreateTodayNoteActionMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Journal 2026-11-25")).toBeTruthy();
    });

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByPlaceholderText(/Search by title/i)).toBeTruthy();
  });
});
