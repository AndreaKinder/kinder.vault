import { beforeEach, describe, it, expect, vi } from "vitest";
import type { NoteRecord } from "@/lib/vault/types";

const revalidatePathMock = vi.fn();
const createServerSupabaseClientMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => createServerSupabaseClientMock(),
}));

import {
  classifyInboxNoteAction,
  createNoteAction,
  deleteNoteAction,
  listNotesAction,
  openOrCreateTodayNoteAction,
  searchNotesAction,
  updateNoteAction,
} from "./notes";

const SAMPLE_NOTE: NoteRecord = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  user_id: "user-1",
  folder: "zettelkasten",
  slug: "postgres-fts",
  title: "Postgres FTS",
  description: "Full text search",
  content: "# FTS",
  aliases: ["FTS"],
  tags: ["postgres"],
  project_name: null,
  created_at: "2026-11-25T10:00:00Z",
  updated_at: "2026-11-25T10:00:00Z",
};

function makeQueryBuilder(resolved: { data?: unknown; error?: { message: string } | null }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chainMethods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "order",
    "limit",
    "textSearch",
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder);
  }

  builder.single = vi.fn().mockResolvedValue(resolved);
  builder.maybeSingle = vi.fn().mockResolvedValue(resolved);
  builder.then = vi.fn((onFulfilled: (val: unknown) => unknown) =>
    Promise.resolve(resolved).then(onFulfilled)
  );

  return builder;
}

function mockSupabase(user: { id: string } | null, builder: ReturnType<typeof makeQueryBuilder>) {
  createServerSupabaseClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    from: vi.fn(() => builder),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Notes Server Actions", () => {
  it("blocks all actions when unauthenticated", async () => {
    const builder = makeQueryBuilder({ data: [], error: null });
    mockSupabase(null, builder);

    expect((await listNotesAction()).ok).toBe(false);
    expect((await createNoteAction({})).ok).toBe(false);
    expect((await updateNoteAction({})).ok).toBe(false);
    expect((await deleteNoteAction(SAMPLE_NOTE.id)).ok).toBe(false);
    expect((await classifyInboxNoteAction({})).ok).toBe(false);
    expect((await openOrCreateTodayNoteAction()).ok).toBe(false);
    expect((await searchNotesAction({ query: "fts" })).ok).toBe(false);
  });

  it("listNotesAction validates folder and returns notes", async () => {
    const builder = makeQueryBuilder({ data: [SAMPLE_NOTE], error: null });
    mockSupabase({ id: "user-1" }, builder);

    const invalid = await listNotesAction("invalid-folder");
    expect(invalid.ok).toBe(false);

    const valid = await listNotesAction("zettelkasten");
    expect(valid).toEqual({ ok: true, data: [SAMPLE_NOTE] });
    expect(builder.eq).toHaveBeenCalledWith("folder", "zettelkasten");
  });

  it("createNoteAction validates domain rules and persists note", async () => {
    const builder = makeQueryBuilder({ data: SAMPLE_NOTE, error: null });
    mockSupabase({ id: "user-1" }, builder);

    const bad = await createNoteAction({
      folder: "journal",
      slug: "2026-02-31",
      title: "Bad date",
    });
    expect(bad.ok).toBe(false);

    const ok = await createNoteAction({
      folder: "zettelkasten",
      slug: "postgres-fts",
      title: "Postgres FTS",
      description: "Full text search",
      content: "# FTS",
      aliases: ["FTS"],
      tags: ["Postgres"],
    });
    expect(ok).toEqual({ ok: true, data: SAMPLE_NOTE });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("updateNoteAction enforces unified updateNoteSchema and updates DB", async () => {
    const builder = makeQueryBuilder({ data: SAMPLE_NOTE, error: null });
    mockSupabase({ id: "user-1" }, builder);

    const invalidId = await updateNoteAction({
      id: "not-a-uuid",
      folder: "zettelkasten",
      slug: "postgres-fts",
      title: "Title",
    });
    expect(invalidId.ok).toBe(false);

    const ok = await updateNoteAction({
      id: SAMPLE_NOTE.id,
      folder: "zettelkasten",
      slug: "postgres-fts",
      title: "Postgres FTS",
      description: "Updated",
      content: "# Updated",
      aliases: [],
      tags: ["postgres"],
    });
    expect(ok).toEqual({ ok: true, data: SAMPLE_NOTE });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("deleteNoteAction validates UUID and deletes note", async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    mockSupabase({ id: "user-1" }, builder);

    expect((await deleteNoteAction("bad-uuid")).ok).toBe(false);

    const ok = await deleteNoteAction(SAMPLE_NOTE.id);
    expect(ok).toEqual({ ok: true, data: { id: SAMPLE_NOTE.id } });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("classifyInboxNoteAction validates target folder and normalizes project_name", async () => {
    const moved = { ...SAMPLE_NOTE, folder: "projects" as const, project_name: "kinder-vault" };
    const builder = makeQueryBuilder({ data: moved, error: null });
    mockSupabase({ id: "user-1" }, builder);

    expect(
      (
        await classifyInboxNoteAction({
          id: SAMPLE_NOTE.id,
          targetFolder: "journal",
        })
      ).ok
    ).toBe(false);

    const ok = await classifyInboxNoteAction({
      id: SAMPLE_NOTE.id,
      targetFolder: "projects",
      project_name: "  kinder-vault  ",
    });
    expect(ok).toEqual({ ok: true, data: moved });
    expect(builder.update).toHaveBeenCalledWith({
      folder: "projects",
      project_name: "kinder-vault",
    });
  });

  it("openOrCreateTodayNoteAction returns existing daily note or creates one with daily-notes tag", async () => {
    const existingJournal = {
      ...SAMPLE_NOTE,
      folder: "journal" as const,
      slug: "2026-11-25",
      tags: ["daily-notes"],
    };

    const existingBuilder = makeQueryBuilder({ data: existingJournal, error: null });
    mockSupabase({ id: "user-1" }, existingBuilder);
    const existingRes = await openOrCreateTodayNoteAction();
    expect(existingRes).toEqual({ ok: true, data: existingJournal });

    const createBuilder = makeQueryBuilder({ data: null, error: null });
    createBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    createBuilder.single = vi.fn().mockResolvedValue({ data: existingJournal, error: null });
    mockSupabase({ id: "user-1" }, createBuilder);

    const createdRes = await openOrCreateTodayNoteAction();
    expect(createdRes).toEqual({ ok: true, data: existingJournal });
    expect(createBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: "journal",
        tags: ["daily-notes"],
      })
    );
  });

  it("searchNotesAction delegates empty query to listNotesAction and uses textSearch for queries", async () => {
    const builder = makeQueryBuilder({ data: [SAMPLE_NOTE], error: null });
    mockSupabase({ id: "user-1" }, builder);

    const empty = await searchNotesAction({ query: "   " });
    expect(empty).toEqual({ ok: true, data: [SAMPLE_NOTE] });
    expect(builder.textSearch).not.toHaveBeenCalled();

    const queried = await searchNotesAction({
      query: "postgres",
      folder: "zettelkasten",
    });
    expect(queried).toEqual({ ok: true, data: [SAMPLE_NOTE] });
    expect(builder.textSearch).toHaveBeenCalledWith("search_vector", "postgres", {
      type: "websearch",
      config: "simple",
    });
  });
});
