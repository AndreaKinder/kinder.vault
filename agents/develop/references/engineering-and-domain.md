# Engineering Standards & Vault Domain Reference

Load this reference when implementing new features, Server Actions, UI components, or SQL migrations in **KinderVault**.

---

## 1. Deterministic Testing Standard

Well-designed tests are **more important than application code** because they define and protect the contract of the system:
- All tests and validations must be **100% deterministic code/algorithms** (zero flaky behavior, zero manual checks).
- Write thorough tests from the ground up covering happy paths, boundary conditions, invalid inputs, and domain invariants across every layer (`src/lib/`, Server Actions, UI components, App Router pages, and security/SQL invariants).
- Never modify, weaken, or skip existing valid tests without explicit user confirmation.

---

## 2. Engineering Standards

### Next.js & React
- Use **App Router** (`src/app/`).
- Prefer **Server Components** by default; add `'use client'` only for interactive client components.
- Keep business/domain logic pure and isolated in `src/lib/vault/` so it is deterministically testable with Vitest.
- Explicitly handle **loading**, **empty**, and **error** states in the UI.

### Strict TypeScript
- Zero `any`. Use explicit types or types inferred from **Zod** schemas.
- Never use `@ts-ignore` or `@ts-nocheck`.
- Keep domain types in `src/lib/vault/types.ts`.

### Validation & Security
- Validate **all** form inputs, Server Actions, and Route Handlers server-side with **Zod** before querying Supabase.
- **Never** hardcode API keys, tokens, or credentials.
- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` may be exposed to the client. Keep demo/admin credentials strictly server-only (`DEMO_EMAIL`, `DEMO_PASSWORD` in `src/lib/supabase/demo-config.ts`).
- Assume **RLS (Row Level Security)** is enabled in Supabase on all tables.

---

## 3. Vault Domain Rules to Enforce

1. **Allowed folders (`VAULT_FOLDERS`):** `inbox`, `journal`, `zettelkasten`, `projects`, `todo`, `prompts`. Reject root-level or unknown folders.
2. **Required metadata:** `title` (non-empty), `slug` (kebab-case or real `YYYY-MM-DD` date in `journal`), `description`, `aliases` (`string[]`), and `tags` (`string[]`, lowercase, deduplicated).
3. **Daily notes (`journal`):** `slug` MUST be a valid calendar date `YYYY-MM-DD` (verified with `Date.UTC` round-trip) and `tags` MUST automatically include `'daily-notes'`.
4. **Inbox classification:** Move from `inbox` to `zettelkasten`, `projects`, `todo`, or `prompts` while persisting unsaved edits, content, aliases, and tags, normalizing empty `project_name` to `null`.
5. **Full-Text Search:** Use Supabase's generated `search_vector` (`tsvector` + GIN index).
