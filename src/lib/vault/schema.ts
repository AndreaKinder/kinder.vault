import { z } from "zod";
import { VAULT_FOLDERS, type VaultFolder } from "./types";

export const DAILY_NOTE_TAG = "daily-notes";
export const JOURNAL_SLUG_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const GENERAL_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeTags(tags: string[], folder?: VaultFolder): string[] {
  const cleaned = tags
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0);

  if (folder === "journal" && !cleaned.includes(DAILY_NOTE_TAG)) {
    cleaned.push(DAILY_NOTE_TAG);
  }

  return Array.from(new Set(cleaned));
}

export function normalizeAliases(aliases: string[]): string[] {
  const cleaned = aliases
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0);

  return Array.from(new Set(cleaned));
}

export function formatDateSlug(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidDateSlug(slug: string): boolean {
  if (!JOURNAL_SLUG_REGEX.test(slug)) {
    return false;
  }

  const [yearStr, monthStr, dayStr] = slug.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const vaultFolderSchema = z.enum(VAULT_FOLDERS, {
  errorMap: () => ({
    message:
      "Invalid folder. Every note must belong to: inbox, journal, zettelkasten, projects, todo, or prompts.",
  }),
});

export const noteInputSchema = z
  .object({
    folder: vaultFolderSchema,
    slug: z.string().trim().min(1, "Slug is required"),
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(200, "Title cannot exceed 200 characters"),
    description: z
      .string()
      .trim()
      .max(500, "Description cannot exceed 500 characters")
      .default(""),
    content: z.string().default(""),
    aliases: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    project_name: z.string().trim().max(120).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.folder === "journal") {
      if (!isValidDateSlug(data.slug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["slug"],
          message:
            "Journal notes must use a valid calendar date in YYYY-MM-DD format",
        });
      }
    } else if (!GENERAL_SLUG_REGEX.test(data.slug)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slug"],
        message: "Slug must use kebab-case (lowercase letters, numbers, and hyphens)",
      });
    }
  })
  .transform((data) => ({
    ...data,
    aliases: normalizeAliases(data.aliases),
    tags: normalizeTags(data.tags, data.folder),
    project_name:
      data.folder === "projects" &&
      data.project_name &&
      data.project_name.trim().length > 0
        ? data.project_name.trim()
        : null,
  }));

export type ValidatedNoteInput = z.output<typeof noteInputSchema>;

export const updateNoteSchema = z
  .object({
    id: z.string().uuid("Invalid note ID"),
  })
  .and(noteInputSchema);

export type ValidatedUpdateNoteInput = z.output<typeof updateNoteSchema>;

export const classifyInboxNoteSchema = z
  .object({
    id: z.string().uuid("Invalid note ID"),
    targetFolder: z.enum(["zettelkasten", "projects", "todo", "prompts"], {
      errorMap: () => ({
        message:
          "Inbox notes can only be classified into zettelkasten, projects, todo, or prompts.",
      }),
    }),
    project_name: z.string().trim().max(120).nullable().optional(),
  })
  .transform((data) => ({
    ...data,
    project_name:
      data.targetFolder === "projects" &&
      data.project_name &&
      data.project_name.trim().length > 0
        ? data.project_name.trim()
        : null,
  }));

export const searchNotesSchema = z.object({
  query: z.string().trim().max(200),
  folder: vaultFolderSchema.optional(),
});
