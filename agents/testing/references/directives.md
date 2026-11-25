# Testing Directives Catalog (Deterministic Enforcement Map)

This reference file lists the mandatory directives that `Develop` must satisfy and maps each directive to the **exact deterministic check or test suite** that enforces it.

> **Context hygiene:** `agents/testing/testing.md` stays lean for routine runs. Consult this catalog only when diagnosing a directive failure or adding new deterministic tests.

---

## D1. Build, Static Analysis & Type Safety
- **Zero ESLint errors or warnings** (`npm run lint`).
- **Strict TypeScript (`strict: true`, zero `any`, zero `@ts-ignore`)** (`npm run typecheck`).
- **Clean Next.js 15 production build** across App Router pages and middleware (`npm run build`).

## D2. Vault Domain Invariants
Enforced deterministically by [`src/lib/vault/vault.test.ts`](../../../src/lib/vault/vault.test.ts) and [`src/app/actions/notes.test.ts`](../../../src/app/actions/notes.test.ts):
- **No root-level notes:** Only the 6 official folders (`inbox`, `journal`, `zettelkasten`, `projects`, `todo`, `prompts`) are allowed.
- **Metadata & frontmatter:** `title`, `slug`, `description`, `aliases` (`string[]`), and `tags` (`string[]`, lowercase, deduplicated) validated server-side with Zod (`noteInputSchema` and unified `updateNoteSchema`).
- **Daily journal rules:** `journal` slugs must be real calendar dates `YYYY-MM-DD` (rejecting impossible dates like `2026-02-31` or `2026-99-99`) and always include the `daily-notes` tag.
- **Inbox triage:** Moving notes from `inbox` into `zettelkasten`, `projects`, `todo`, or `prompts` preserves unsaved edits, content, and metadata, and normalizes `project_name` to `null` when empty or non-`projects`.
- **Internal wikilinks:** `[[target]]` and `[[target|display]]` extraction, deduplication, and resolution by slug, `folder/slug`, title, or alias.

## D3. UI Behavior & Async Resilience
Enforced deterministically by component and page test suites:
- **Auth flows** ([`LoginForm.test.tsx`](../../../src/components/auth/LoginForm.test.tsx), [`pages.test.tsx`](../../../src/app/pages.test.tsx)): unconfigured Supabase warning, sign-in/sign-up error handling, email-confirmation preservation (no premature redirect), and one-click demo login.
- **Instant FTS search** ([`SearchModal.test.tsx`](../../../src/components/vault/SearchModal.test.tsx)): debounce, Postgres `textSearch`, empty-vault copy, error banner, Escape close, and stale-response cancellation (race-condition guard).
- **Editor & Workspace** ([`NoteEditor.test.tsx`](../../../src/components/vault/NoteEditor.test.tsx), [`VaultWorkspace.test.tsx`](../../../src/components/vault/VaultWorkspace.test.tsx)): split/edit/preview modes, YAML frontmatter preview, save-before-classify in Inbox, delete confirmation, Inbox quick capture, Today's Note, `Ctrl+K` shortcut, and initial DB error banner.

## D4. Security, RLS & Production Readiness
Enforced deterministically by [`src/lib/vault/security-invariants.test.ts`](../../../src/lib/vault/security-invariants.test.ts), [`src/lib/supabase/supabase.test.ts`](../../../src/lib/supabase/supabase.test.ts), [`src/app/actions/auth.test.ts`](../../../src/app/actions/auth.test.ts), and [`src/app/actions/notes.test.ts`](../../../src/app/actions/notes.test.ts):
- **No secrets in repo:** `.env` and `.env*.local` ignored in `.gitignore`; `.env.example` contains placeholders only.
- **Server-only demo credentials:** `DEMO_EMAIL` and `DEMO_PASSWORD` live strictly in server-only code (`src/lib/supabase/demo-config.ts`); zero `NEXT_PUBLIC_DEMO_*` or `SERVICE_ROLE_KEY` exposure in `src/`.
- **Server-side validation & auth:** Every Server Action validates inputs with Zod and requires an authenticated Supabase user.
- **Database RLS & FTS:** `supabase/schema.sql` enables Row Level Security (`auth.uid() = user_id`), Postgres enum/check constraints, and `search_vector` GIN index.

## D5. Test Integrity & Full-Layer Coverage
- **Zero test tampering:** Never weaken, delete, or skip (`it.skip` / `describe.skip` / `test.skip`) valid tests to make failing code pass.
- **User approval gate:** Existing tests are only modified after explicit user confirmation; otherwise fix application code or halt immediately.
- **Every layer covered:** Domain, security/SQL invariants, Supabase clients/middleware, Server Actions, UI components, and App Router pages.
