# KinderVault

A web-based personal knowledge vault built with **Next.js (App Router)** and **Supabase**, designed and developed using a **3-agent workflow** (`Orchestrator`, `Develop`, and `Testing`).

## Inspiration & Related Projects

KinderVault brings my local Obsidian + Neovim notes infrastructure to the web, replicating its strict folder taxonomy, frontmatter metadata, daily journal rules, inbox triage, and fast search. It is directly inspired by my published notes ecosystem on GitHub:

- **[templates-path-notes](https://github.com/AndreaKinder/templates-path-notes)** — Folder architecture, templates, and path-resolution conventions for the vault.
- **[skills-notes](https://github.com/AndreaKinder/skills-notes)** — Modular agent skills and workflows for managing and querying personal notes.
- **[mcp-rag-notes](https://github.com/AndreaKinder/mcp-rag-notes)** — Semantic search and context retrieval over personal notes via MCP.

---

## Multi-Agent Architecture

This repository is structured around three collaborating agents:

| Agent | File | Responsibility |
| :--- | :--- | :--- |
| **Orchestrator** | [`AGENTS.md`](AGENTS.md) | Plans phases, breaks down tasks, routes deterministic failures to `Develop`, enforces user approval for test edits, and gates `git push` on `STATUS: PASS`. |
| **Develop** | [`agents/develop/develop.md`](agents/develop/develop.md) | Implements Next.js features, Supabase queries, Zod validation, and Vitest tests (with on-demand [`references/engineering-and-domain.md`](agents/develop/references/engineering-and-domain.md)). |
| **Testing** | [`agents/testing/testing.md`](agents/testing/testing.md) | Executes 100% deterministic checks and tests, mapping failures on demand to [`references/directives.md`](agents/testing/references/directives.md) (`D1–D5`). |

---

## Key Features

- **Strict 6-Folder Taxonomy (No Root Notes):** Every note belongs to `inbox`, `journal`, `zettelkasten`, `projects`, `todo`, or `prompts` — enforced in Zod and Postgres constraints.
- **Structured Frontmatter & Markdown Editor:** Live split/edit/preview Markdown editor with `slug`, `title`, `description`, `aliases`, `tags`, YAML frontmatter preview, and clickable `[[wikilinks]]`.
- **One-Click Daily Note:** Automatically opens or creates `journal/YYYY-MM-DD` with the mandatory `daily-notes` tag.
- **Inbox Triage Flow:** Quick capture in `inbox` with one-click classification into `zettelkasten`, `projects`, `todo`, or `prompts`.
- **Instant Full-Text Search (`Ctrl+K`):** Powered by Postgres generated `tsvector` + GIN index in Supabase across title, description, content, aliases, and tags.
- **Auth & Row Level Security (RLS):** Supabase Auth with per-user RLS policies and optional one-click demo login.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router) + React 19 + strict TypeScript + Tailwind CSS
- **Database & Auth:** Supabase (Postgres, Full-Text Search, Auth, RLS)
- **Validation & Testing:** Zod + Vitest + Testing Library
- **Deployment:** Vercel (public production URL)

---

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in your Supabase project credentials:
   ```bash
   cp .env.example .env.local
   ```
3. Run [`supabase/schema.sql`](supabase/schema.sql) in your Supabase project's **SQL Editor** to create the table, constraints, FTS index, and RLS policies.
4. Start the development server:
   ```bash
   npm run dev
   ```

---

## Verification Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
