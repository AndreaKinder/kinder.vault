export const VAULT_FOLDERS = [
  "inbox",
  "journal",
  "zettelkasten",
  "projects",
  "todo",
  "prompts",
] as const;

export type VaultFolder = (typeof VAULT_FOLDERS)[number];

export interface FolderMeta {
  id: VaultFolder;
  label: string;
  description: string;
  placeholderSlug: string;
}

export const FOLDER_METADATA: Record<VaultFolder, FolderMeta> = {
  inbox: {
    id: "inbox",
    label: "Inbox",
    description: "Quick captures pending classification",
    placeholderSlug: "quick-capture",
  },
  journal: {
    id: "journal",
    label: "Journal",
    description: "Daily notes (YYYY-MM-DD, daily-notes tag)",
    placeholderSlug: "2026-11-25",
  },
  zettelkasten: {
    id: "zettelkasten",
    label: "Zettelkasten",
    description: "Atomic knowledge, technical guides, and learnings",
    placeholderSlug: "postgres-fts-architecture",
  },
  projects: {
    id: "projects",
    label: "Projects",
    description: "Documentation for specific projects",
    placeholderSlug: "kinder-vault-roadmap",
  },
  todo: {
    id: "todo",
    label: "To-Do",
    description: "Dated task lists and action tracking",
    placeholderSlug: "week-48-tasks",
  },
  prompts: {
    id: "prompts",
    label: "Prompts",
    description: "AI agent instructions and prompt templates",
    placeholderSlug: "agent-orchestrator",
  },
};

export interface NoteRecord {
  id: string;
  user_id: string;
  folder: VaultFolder;
  slug: string;
  title: string;
  description: string;
  content: string;
  aliases: string[];
  tags: string[];
  project_name: string | null;
  created_at: string;
  updated_at: string;
}
