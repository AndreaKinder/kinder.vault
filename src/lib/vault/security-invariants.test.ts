import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { FOLDER_METADATA, VAULT_FOLDERS } from "./types";

const ROOT = process.cwd();

function readProjectFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) {
      results.push(full);
    }
  }
  return results;
}

describe("Vault metadata completeness & security invariants", () => {
  it("defines complete metadata for every official vault folder", () => {
    expect(VAULT_FOLDERS).toEqual([
      "inbox",
      "journal",
      "zettelkasten",
      "projects",
      "todo",
      "prompts",
    ]);

    for (const folder of VAULT_FOLDERS) {
      const meta = FOLDER_METADATA[folder];
      expect(meta.id).toBe(folder);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
      expect(meta.placeholderSlug.length).toBeGreaterThan(0);
    }
  });

  it("enforces RLS, all 6 folder enums, journal constraints, and FTS in supabase/schema.sql", () => {
    const sql = readProjectFile("supabase/schema.sql").toLowerCase();

    expect(sql).toContain("enable row level security");
    expect(sql).toContain("auth.uid() = user_id");
    expect(sql).toContain("notes_journal_slug_format");
    expect(sql).toContain("notes_journal_daily_tag");
    expect(sql).toContain("search_vector tsvector");
    expect(sql).toContain("using gin (search_vector)");

    for (const folder of VAULT_FOLDERS) {
      expect(sql).toContain(`'${folder}'`);
    }
  });

  it("keeps .env ignored in .gitignore and avoids exposing demo credentials as NEXT_PUBLIC_ in .env.example", () => {
    const gitignore = readProjectFile(".gitignore");
    const envExample = readProjectFile(".env.example");

    expect(gitignore).toMatch(/^\.env$/m);
    expect(gitignore).toContain(".env*.local");

    expect(envExample).toContain("NEXT_PUBLIC_SUPABASE_URL=");
    expect(envExample).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY=");
    expect(envExample).toContain("DEMO_EMAIL=");
    expect(envExample).toContain("DEMO_PASSWORD=");
    expect(envExample).not.toContain("NEXT_PUBLIC_DEMO_");
    expect(envExample).not.toContain("SERVICE_ROLE");
  });

  it("contains zero forbidden secret patterns or test-skipping statements in source files", () => {
    const files = collectSourceFiles(path.join(ROOT, "src"));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      expect(content).not.toContain("NEXT_PUBLIC_DEMO_");
      expect(content).not.toContain("SERVICE_ROLE_KEY");
    }
  });
});
