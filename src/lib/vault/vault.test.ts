import { describe, it, expect } from "vitest";
import {
  DAILY_NOTE_TAG,
  classifyInboxNoteSchema,
  formatDateSlug,
  isValidDateSlug,
  normalizeAliases,
  normalizeSlug,
  normalizeTags,
  noteInputSchema,
  searchNotesSchema,
  updateNoteSchema,
} from "./schema";
import {
  buildFrontmatterPreview,
  extractWikiLinks,
  resolveWikiLink,
} from "./wikilinks";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("Vault domain validation (schema)", () => {
  it("normalizes slugs into valid kebab-case without diacritics", () => {
    expect(normalizeSlug("  Café & FTS5 Guide!  ")).toBe("cafe-fts5-guide");
    expect(normalizeSlug("2026-11-25")).toBe("2026-11-25");
  });

  it("rejects notes outside the 6 official vault folders including empty folder", () => {
    const rootAttempt = noteInputSchema.safeParse({
      folder: "root",
      slug: "my-note",
      title: "My note",
      description: "Attempt to create a root-level note",
      content: "",
      aliases: [],
      tags: [],
    });

    expect(rootAttempt.success).toBe(false);

    const emptyFolder = noteInputSchema.safeParse({
      folder: "",
      slug: "my-note",
      title: "My note",
      description: "",
      content: "",
      aliases: [],
      tags: [],
    });

    expect(emptyFolder.success).toBe(false);
  });

  it("enforces valid YYYY-MM-DD calendar dates and auto-adds daily-notes tag for journal notes", () => {
    const valid = noteInputSchema.safeParse({
      folder: "journal",
      slug: "2026-11-25",
      title: "Journal 2026-11-25",
      description: "Daily summary",
      content: "## Today\n- Ship technical assessment",
      aliases: ["Nov 25"],
      tags: ["Work", "work"],
    });

    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.tags).toEqual(["work", DAILY_NOTE_TAG]);
      expect(valid.data.aliases).toEqual(["Nov 25"]);
    }

    const leapDay = noteInputSchema.safeParse({
      folder: "journal",
      slug: "2024-02-29",
      title: "Leap day journal",
      description: "",
      content: "",
      aliases: [],
      tags: [],
    });
    expect(leapDay.success).toBe(true);

    const invalidJournalSlugs = [
      "today-journal",
      "2026-02-31",
      "2026-99-99",
      "2025-02-29",
      "2026-00-10",
      "2026-13-01",
    ];

    for (const slug of invalidJournalSlugs) {
      expect(isValidDateSlug(slug)).toBe(false);
      const parsed = noteInputSchema.safeParse({
        folder: "journal",
        slug,
        title: "Invalid journal note",
        description: "",
        content: "",
        aliases: [],
        tags: [],
      });
      expect(parsed.success).toBe(false);
    }
  });

  it("rejects invalid non-journal slugs containing spaces, uppercase, or malformed hyphens", () => {
    const invalidSlugs = ["my note", "My-Note", "UPPERCASE", "-leading", "trailing-", "double--hyphen"];

    for (const slug of invalidSlugs) {
      const parsed = noteInputSchema.safeParse({
        folder: "zettelkasten",
        slug,
        title: "Invalid slug note",
        description: "",
        content: "",
        aliases: [],
        tags: [],
      });
      expect(parsed.success).toBe(false);
    }
  });

  it("enforces max-length boundaries on title, description, and project_name", () => {
    const atBoundary = noteInputSchema.safeParse({
      folder: "projects",
      slug: "boundary-test",
      title: "a".repeat(200),
      description: "b".repeat(500),
      content: "",
      aliases: [],
      tags: [],
      project_name: "c".repeat(120),
    });
    expect(atBoundary.success).toBe(true);

    const titleTooLong = noteInputSchema.safeParse({
      folder: "zettelkasten",
      slug: "boundary-test",
      title: "a".repeat(201),
      description: "",
      content: "",
      aliases: [],
      tags: [],
    });
    expect(titleTooLong.success).toBe(false);

    const descriptionTooLong = noteInputSchema.safeParse({
      folder: "zettelkasten",
      slug: "boundary-test",
      title: "Valid title",
      description: "b".repeat(501),
      content: "",
      aliases: [],
      tags: [],
    });
    expect(descriptionTooLong.success).toBe(false);

    const projectNameTooLong = noteInputSchema.safeParse({
      folder: "projects",
      slug: "boundary-test",
      title: "Valid title",
      description: "",
      content: "",
      aliases: [],
      tags: [],
      project_name: "c".repeat(121),
    });
    expect(projectNameTooLong.success).toBe(false);
  });

  it("validates zettelkasten notes and deduplicates tags and aliases", () => {
    const result = noteInputSchema.safeParse({
      folder: "zettelkasten",
      slug: "postgres-fts",
      title: "Postgres Full-Text Search",
      description: "Notes on tsvector and GIN indexes",
      content: "Use [[supabase-rls|RLS]] alongside GIN indexes.",
      aliases: ["FTS", "FTS", "  Full Text  "],
      tags: ["Postgres", "postgres", "  SQL "],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual(["postgres", "sql"]);
      expect(result.data.aliases).toEqual(["FTS", "Full Text"]);
      expect(result.data.project_name).toBeNull();
    }
  });

  it("preserves project_name only for projects folder and strips it for non-projects folders", () => {
    const projectNote = noteInputSchema.safeParse({
      folder: "projects",
      slug: "kinder-vault-specs",
      title: "Specs",
      description: "Specifications",
      content: "",
      aliases: [],
      tags: [],
      project_name: "  kinder-vault  ",
    });

    expect(projectNote.success).toBe(true);
    if (projectNote.success) {
      expect(projectNote.data.project_name).toBe("kinder-vault");
    }

    const whitespaceProjectName = noteInputSchema.safeParse({
      folder: "projects",
      slug: "kinder-vault-specs",
      title: "Specs",
      description: "",
      content: "",
      aliases: [],
      tags: [],
      project_name: "   ",
    });
    expect(whitespaceProjectName.success).toBe(true);
    if (whitespaceProjectName.success) {
      expect(whitespaceProjectName.data.project_name).toBeNull();
    }

    const nonProjectNote = noteInputSchema.safeParse({
      folder: "inbox",
      slug: "quick-idea",
      title: "Quick idea",
      description: "",
      content: "",
      aliases: [],
      tags: [],
      project_name: "should-be-stripped",
    });

    expect(nonProjectNote.success).toBe(true);
    if (nonProjectNote.success) {
      expect(nonProjectNote.data.project_name).toBeNull();
    }
  });

  it("enforces all domain rules and normalization in updateNoteSchema", () => {
    const validJournalUpdate = updateNoteSchema.safeParse({
      id: VALID_UUID,
      folder: "journal",
      slug: "2026-11-25",
      title: "Updated Journal",
      description: "Updated daily entry",
      content: "Updated content",
      aliases: ["  Today ", "Today"],
      tags: ["Focus", "focus"],
      project_name: "should-be-cleared",
    });

    expect(validJournalUpdate.success).toBe(true);
    if (validJournalUpdate.success) {
      expect(validJournalUpdate.data.id).toBe(VALID_UUID);
      expect(validJournalUpdate.data.tags).toEqual(["focus", DAILY_NOTE_TAG]);
      expect(validJournalUpdate.data.aliases).toEqual(["Today"]);
      expect(validJournalUpdate.data.project_name).toBeNull();
    }

    const invalidUuidUpdate = updateNoteSchema.safeParse({
      id: "not-a-uuid",
      folder: "inbox",
      slug: "quick-note",
      title: "Quick Note",
      description: "",
      content: "",
      aliases: [],
      tags: [],
    });
    expect(invalidUuidUpdate.success).toBe(false);

    const impossibleDateUpdate = updateNoteSchema.safeParse({
      id: VALID_UUID,
      folder: "journal",
      slug: "2026-02-31",
      title: "Impossible Date",
      description: "",
      content: "",
      aliases: [],
      tags: [],
    });
    expect(impossibleDateUpdate.success).toBe(false);
  });

  it("validates inbox classification targets, UUIDs, and normalizes project_name", () => {
    const validZettel = classifyInboxNoteSchema.safeParse({
      id: VALID_UUID,
      targetFolder: "zettelkasten",
      project_name: "ignored-project",
    });
    expect(validZettel.success).toBe(true);
    if (validZettel.success) {
      expect(validZettel.data.project_name).toBeNull();
    }

    const validProject = classifyInboxNoteSchema.safeParse({
      id: VALID_UUID,
      targetFolder: "projects",
      project_name: "  kinder-vault  ",
    });
    expect(validProject.success).toBe(true);
    if (validProject.success) {
      expect(validProject.data.project_name).toBe("kinder-vault");
    }

    const emptyProjectName = classifyInboxNoteSchema.safeParse({
      id: VALID_UUID,
      targetFolder: "projects",
      project_name: "   ",
    });
    expect(emptyProjectName.success).toBe(true);
    if (emptyProjectName.success) {
      expect(emptyProjectName.data.project_name).toBeNull();
    }

    expect(
      classifyInboxNoteSchema.safeParse({
        id: VALID_UUID,
        targetFolder: "inbox",
      }).success
    ).toBe(false);

    expect(
      classifyInboxNoteSchema.safeParse({
        id: VALID_UUID,
        targetFolder: "journal",
      }).success
    ).toBe(false);

    expect(
      classifyInboxNoteSchema.safeParse({
        id: "invalid-uuid",
        targetFolder: "todo",
      }).success
    ).toBe(false);
  });

  it("validates searchNotesSchema inputs and boundaries", () => {
    const validSearch = searchNotesSchema.safeParse({
      query: "  postgres fts  ",
      folder: "zettelkasten",
    });
    expect(validSearch.success).toBe(true);
    if (validSearch.success) {
      expect(validSearch.data.query).toBe("postgres fts");
      expect(validSearch.data.folder).toBe("zettelkasten");
    }

    const emptyQuery = searchNotesSchema.safeParse({ query: "   " });
    expect(emptyQuery.success).toBe(true);
    if (emptyQuery.success) {
      expect(emptyQuery.data.query).toBe("");
    }

    expect(
      searchNotesSchema.safeParse({
        query: "a".repeat(201),
      }).success
    ).toBe(false);

    expect(
      searchNotesSchema.safeParse({
        query: "notes",
        folder: "invalid-folder",
      }).success
    ).toBe(false);
  });

  it("formats dates as YYYY-MM-DD and normalizes helpers", () => {
    expect(formatDateSlug(new Date(2026, 10, 5))).toBe("2026-11-05");
    expect(normalizeTags(["A", "a", ""], "journal")).toEqual(["a", DAILY_NOTE_TAG]);
    expect(normalizeAliases([" one ", "one", ""])).toEqual(["one"]);
  });
});

describe("Wikilinks and frontmatter utilities", () => {
  it("extracts unique wikilinks with optional display labels and ignores empty wikilinks", () => {
    const links = extractWikiLinks(
      "See [[postgres-fts]], also [[journal/2026-11-25|Today]], ignore [[]] and [[   ]], and again [[postgres-fts]]."
    );

    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({
      raw: "[[postgres-fts]]",
      target: "postgres-fts",
      display: "postgres-fts",
    });
    expect(links[1]).toEqual({
      raw: "[[journal/2026-11-25|Today]]",
      target: "journal/2026-11-25",
      display: "Today",
    });
  });

  it("resolves wikilinks by slug, folder/slug, title, or alias and returns null for blank targets", () => {
    const notes = [
      {
        id: "1",
        folder: "zettelkasten" as const,
        slug: "postgres-fts",
        title: "Postgres Full-Text Search",
        aliases: ["FTS Search"],
      },
    ];

    expect(resolveWikiLink("postgres-fts", notes)?.id).toBe("1");
    expect(resolveWikiLink("zettelkasten/postgres-fts", notes)?.id).toBe("1");
    expect(resolveWikiLink("Postgres Full-Text Search", notes)?.id).toBe("1");
    expect(resolveWikiLink("fts search", notes)?.id).toBe("1");
    expect(resolveWikiLink("missing-note", notes)).toBeNull();
    expect(resolveWikiLink("   ", notes)).toBeNull();
  });

  it("generates YAML frontmatter preview including empty arrays and escaped quotes", () => {
    const yaml = buildFrontmatterPreview({
      slug: "2026-11-25",
      description: 'Daily "focus" note',
      aliases: ['Today "v1"'],
      tags: ["daily-notes"],
    });

    expect(yaml).toContain("id: 2026-11-25");
    expect(yaml).toContain('description: "Daily \\"focus\\" note"');
    expect(yaml).toContain('  - "Today \\"v1\\""');
    expect(yaml).toContain("  - daily-notes");

    const emptyYaml = buildFrontmatterPreview({
      slug: "empty-meta",
      description: "",
      aliases: [],
      tags: [],
    });

    expect(emptyYaml).toContain("aliases: []");
    expect(emptyYaml).toContain("tags: []");
  });
});
