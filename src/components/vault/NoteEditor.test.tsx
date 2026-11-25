import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NoteRecord } from "@/lib/vault/types";

const updateNoteActionMock = vi.fn();
const deleteNoteActionMock = vi.fn();
const classifyInboxNoteActionMock = vi.fn();

vi.mock("@/app/actions/notes", () => ({
  updateNoteAction: (...args: unknown[]) => updateNoteActionMock(...args),
  deleteNoteAction: (...args: unknown[]) => deleteNoteActionMock(...args),
  classifyInboxNoteAction: (...args: unknown[]) => classifyInboxNoteActionMock(...args),
}));

import { NoteEditor } from "./NoteEditor";

const TARGET_NOTE: NoteRecord = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  user_id: "user-1",
  folder: "zettelkasten",
  slug: "postgres-fts",
  title: "Postgres FTS",
  description: "Search guide",
  content: "# FTS",
  aliases: [],
  tags: ["postgres"],
  project_name: null,
  created_at: "2026-11-25T10:00:00Z",
  updated_at: "2026-11-25T10:00:00Z",
};

const INBOX_NOTE: NoteRecord = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  user_id: "user-1",
  folder: "inbox",
  slug: "quick-idea",
  title: "Quick Idea",
  description: "Raw capture",
  content: "Linked to [[postgres-fts]] and [[missing-note]].",
  aliases: ["Idea"],
  tags: ["draft"],
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

describe("NoteEditor component", () => {
  it("renders wikilinks, navigates on resolved link click, and toggles YAML frontmatter preview", () => {
    const onNavigate = vi.fn();

    render(
      <NoteEditor
        note={INBOX_NOTE}
        allNotes={[INBOX_NOTE, TARGET_NOTE]}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onNavigateNote={onNavigate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "[[postgres-fts]]" }));
    expect(onNavigate).toHaveBeenCalledWith(TARGET_NOTE);
    expect(screen.getByText("[[missing-note]]")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Toggle YAML frontmatter preview"));
    expect(screen.getByText(/id: quick-idea/)).toBeTruthy();
  });

  it("saves edits via updateNoteAction and displays feedback", async () => {
    const onUpdated = vi.fn();
    const updated = { ...INBOX_NOTE, title: "Updated Title" };
    updateNoteActionMock.mockResolvedValueOnce({ ok: true, data: updated });

    render(
      <NoteEditor
        note={INBOX_NOTE}
        allNotes={[INBOX_NOTE]}
        onUpdated={onUpdated}
        onDeleted={vi.fn()}
        onNavigateNote={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Note title"), {
      target: { value: "Updated Title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateNoteActionMock).toHaveBeenCalledTimes(1);
      expect(onUpdated).toHaveBeenCalledWith(updated);
      expect(screen.getByText("Saved successfully")).toBeTruthy();
    });
  });

  it("persists unsaved edits before classifying an inbox note into projects with project_name", async () => {
    const onUpdated = vi.fn();
    const savedInbox = { ...INBOX_NOTE, title: "Refined Project Spec" };
    const classified = {
      ...savedInbox,
      folder: "projects" as const,
      project_name: "kinder-vault",
    };

    updateNoteActionMock.mockResolvedValueOnce({ ok: true, data: savedInbox });
    classifyInboxNoteActionMock.mockResolvedValueOnce({ ok: true, data: classified });

    render(
      <NoteEditor
        note={INBOX_NOTE}
        allNotes={[INBOX_NOTE]}
        onUpdated={onUpdated}
        onDeleted={vi.fn()}
        onNavigateNote={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Classify note into folder"), {
      target: { value: "projects" },
    });

    const projectInput = screen.getByPlaceholderText(/Project name/i);
    fireEvent.change(projectInput, { target: { value: "kinder-vault" } });
    fireEvent.change(screen.getByPlaceholderText("Note title"), {
      target: { value: "Refined Project Spec" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Classify" }));

    await waitFor(() => {
      expect(updateNoteActionMock).toHaveBeenCalledTimes(1);
      expect(classifyInboxNoteActionMock).toHaveBeenCalledWith({
        id: INBOX_NOTE.id,
        targetFolder: "projects",
        project_name: "kinder-vault",
      });
      expect(onUpdated).toHaveBeenCalledWith(classified);
    });
  });

  it("deletes a note only when user confirms dialog", async () => {
    const onDeleted = vi.fn();
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    deleteNoteActionMock.mockResolvedValueOnce({
      ok: true,
      data: { id: INBOX_NOTE.id },
    });

    render(
      <NoteEditor
        note={INBOX_NOTE}
        allNotes={[INBOX_NOTE]}
        onUpdated={vi.fn()}
        onDeleted={onDeleted}
        onNavigateNote={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("Delete note"));
    expect(deleteNoteActionMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Delete note"));
    await waitFor(() => {
      expect(deleteNoteActionMock).toHaveBeenCalledWith(INBOX_NOTE.id);
      expect(onDeleted).toHaveBeenCalledWith(INBOX_NOTE.id);
    });

    confirmSpy.mockRestore();
  });
});
