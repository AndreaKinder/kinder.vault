import type { NoteRecord } from "./types";

const WIKILINK_REGEX = /\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g;

export interface WikiLinkMatch {
  raw: string;
  target: string;
  display: string;
}

export function extractWikiLinks(markdown: string): WikiLinkMatch[] {
  const matches: WikiLinkMatch[] = [];
  const seen = new Set<string>();

  for (const match of markdown.matchAll(WIKILINK_REGEX)) {
    const raw = match[0];
    const target = (match[1] ?? "").trim();
    const display = (match[2] ?? target).trim();

    if (!target) continue;
    const key = target.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    matches.push({ raw, target, display });
  }

  return matches;
}

export function resolveWikiLink(
  target: string,
  notes: Pick<NoteRecord, "id" | "folder" | "slug" | "title" | "aliases">[]
): Pick<NoteRecord, "id" | "folder" | "slug" | "title" | "aliases"> | null {
  const needle = target.trim().toLowerCase();
  if (!needle) return null;

  return (
    notes.find((note) => {
      if (note.slug.toLowerCase() === needle) return true;
      if (`${note.folder}/${note.slug}`.toLowerCase() === needle) return true;
      if (note.title.toLowerCase() === needle) return true;
      return note.aliases.some((alias) => alias.toLowerCase() === needle);
    }) ?? null
  );
}

export function buildFrontmatterPreview(note: {
  slug: string;
  description: string;
  aliases: string[];
  tags: string[];
}): string {
  const lines = [
    "---",
    `id: ${note.slug}`,
    `description: "${note.description.replace(/"/g, '\\"')}"`,
  ];

  if (note.aliases.length > 0) {
    lines.push("aliases:");
    for (const alias of note.aliases) {
      lines.push(`  - "${alias.replace(/"/g, '\\"')}"`);
    }
  } else {
    lines.push("aliases: []");
  }

  if (note.tags.length > 0) {
    lines.push("tags:");
    for (const tag of note.tags) {
      lines.push(`  - ${tag}`);
    }
  } else {
    lines.push("tags: []");
  }

  lines.push("---");
  return lines.join("\n");
}
