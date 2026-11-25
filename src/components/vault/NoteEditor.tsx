"use client";

import { useMemo, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowRightLeft,
  Code2,
  Eye,
  Link2,
  Save,
  Trash2,
} from "lucide-react";
import {
  classifyInboxNoteAction,
  deleteNoteAction,
  updateNoteAction,
} from "@/app/actions/notes";
import {
  FOLDER_METADATA,
  VAULT_FOLDERS,
  type NoteRecord,
  type VaultFolder,
} from "@/lib/vault/types";
import {
  buildFrontmatterPreview,
  extractWikiLinks,
  resolveWikiLink,
} from "@/lib/vault/wikilinks";

interface NoteEditorProps {
  note: NoteRecord;
  allNotes: NoteRecord[];
  onUpdated: (updated: NoteRecord) => void;
  onDeleted: (deletedId: string) => void;
  onNavigateNote: (note: NoteRecord) => void;
}

export function NoteEditor({
  note,
  allNotes,
  onUpdated,
  onDeleted,
  onNavigateNote,
}: NoteEditorProps) {
  const [folder, setFolder] = useState<VaultFolder>(note.folder);
  const [title, setTitle] = useState(note.title);
  const [slug, setSlug] = useState(note.slug);
  const [description, setDescription] = useState(note.description);
  const [aliasesText, setAliasesText] = useState(note.aliases.join(", "));
  const [tagsText, setTagsText] = useState(note.tags.join(", "));
  const [projectName, setProjectName] = useState(note.project_name ?? "");
  const [content, setContent] = useState(note.content);
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("split");
  const [showYaml, setShowYaml] = useState(false);
  const [classifyTarget, setClassifyTarget] = useState<
    "zettelkasten" | "projects" | "todo" | "prompts"
  >("zettelkasten");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsedAliases = useMemo(
    () =>
      aliasesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [aliasesText]
  );

  const parsedTags = useMemo(
    () =>
      tagsText
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    [tagsText]
  );

  const wikiLinks = useMemo(() => extractWikiLinks(content), [content]);

  const frontmatterPreview = useMemo(
    () =>
      buildFrontmatterPreview({
        slug,
        description,
        aliases: parsedAliases,
        tags: parsedTags,
      }),
    [slug, description, parsedAliases, parsedTags]
  );

  function handleSave() {
    setErrorMessage(null);
    setStatusMessage(null);

    startTransition(async () => {
      const res = await updateNoteAction({
        id: note.id,
        folder,
        slug,
        title,
        description,
        content,
        aliases: parsedAliases,
        tags: parsedTags,
        project_name: folder === "projects" ? projectName || null : null,
      });

      if (!res.ok || !res.data) {
        setErrorMessage(res.error ?? "Failed to save note.");
        return;
      }

      setTagsText(res.data.tags.join(", "));
      setAliasesText(res.data.aliases.join(", "));
      setStatusMessage("Saved successfully");
      onUpdated(res.data);
    });
  }

  function handleDelete() {
    if (!window.confirm(`Permanently delete "${note.title}"?`)) {
      return;
    }
    setErrorMessage(null);

    startTransition(async () => {
      const res = await deleteNoteAction(note.id);
      if (!res.ok) {
        setErrorMessage(res.error ?? "Failed to delete note.");
        return;
      }
      onDeleted(note.id);
    });
  }

  function handleClassify() {
    setErrorMessage(null);
    setStatusMessage(null);

    startTransition(async () => {
      const hasUnsavedEdits =
        title !== note.title ||
        slug !== note.slug ||
        description !== note.description ||
        content !== note.content ||
        JSON.stringify(parsedAliases) !== JSON.stringify(note.aliases) ||
        JSON.stringify(parsedTags) !== JSON.stringify(note.tags);

      let savedNote: NoteRecord | null = null;
      if (hasUnsavedEdits) {
        const saveRes = await updateNoteAction({
          id: note.id,
          folder: note.folder,
          slug,
          title,
          description,
          content,
          aliases: parsedAliases,
          tags: parsedTags,
          project_name: null,
        });

        if (!saveRes.ok || !saveRes.data) {
          setErrorMessage(
            saveRes.error ?? "Failed to save edits before classifying note."
          );
          return;
        }
        savedNote = saveRes.data;
      }

      const trimmedProjectName = projectName.trim();
      const res = await classifyInboxNoteAction({
        id: note.id,
        targetFolder: classifyTarget,
        project_name:
          classifyTarget === "projects" && trimmedProjectName.length > 0
            ? trimmedProjectName
            : null,
      });

      if (!res.ok || !res.data) {
        if (savedNote) {
          onUpdated(savedNote);
        }
        setErrorMessage(res.error ?? "Failed to classify note.");
        return;
      }

      setFolder(res.data.folder);
      setTagsText(res.data.tags.join(", "));
      setAliasesText(res.data.aliases.join(", "));
      setProjectName(res.data.project_name ?? "");
      setStatusMessage(
        `Note moved to ${FOLDER_METADATA[res.data.folder].label}`
      );
      onUpdated(res.data);
    });
  }

  return (
    <section className="flex h-full flex-col overflow-hidden bg-[#0f1117]">
      {/* Top toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <select
            aria-label="Note folder"
            value={folder}
            onChange={(e) => setFolder(e.target.value as VaultFolder)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 focus:border-indigo-500 focus:outline-none"
          >
            {VAULT_FOLDERS.map((f) => (
              <option key={f} value={f}>
                {FOLDER_METADATA[f].label}
              </option>
            ))}
          </select>
          <span>/</span>
          <input
            aria-label="Note slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-44 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {note.folder === "inbox" && (
            <div className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1">
              <select
                aria-label="Classify note into folder"
                value={classifyTarget}
                onChange={(e) =>
                  setClassifyTarget(
                    e.target.value as
                      | "zettelkasten"
                      | "projects"
                      | "todo"
                      | "prompts"
                  )
                }
                className="bg-transparent text-xs text-amber-200 focus:outline-none"
              >
                <option value="zettelkasten" className="bg-zinc-900">
                  Zettelkasten
                </option>
                <option value="projects" className="bg-zinc-900">
                  Projects
                </option>
                <option value="todo" className="bg-zinc-900">
                  To-Do
                </option>
                <option value="prompts" className="bg-zinc-900">
                  Prompts
                </option>
              </select>
              <button
                type="button"
                onClick={handleClassify}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-100 hover:bg-amber-500/30"
              >
                <ArrowRightLeft className="h-3 w-3" />
                Classify
              </button>
            </div>
          )}

          <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
            {(["edit", "split", "preview"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={`rounded-md px-2.5 py-1 capitalize transition ${
                  viewMode === m
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowYaml((prev) => !prev)}
            title="Toggle YAML frontmatter preview"
            className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
              showYaml
                ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {isPending ? "Saving..." : "Save"}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            aria-label="Delete note"
            className="rounded-lg border border-zinc-800 p-1.5 text-zinc-400 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Feedback banners */}
      {errorMessage && (
        <div
          role="alert"
          className="border-b border-red-500/30 bg-red-500/10 px-5 py-2 text-xs text-red-200"
        >
          {errorMessage}
        </div>
      )}
      {statusMessage && (
        <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-5 py-2 text-xs text-emerald-200">
          {statusMessage}
        </div>
      )}

      {/* Metadata panel */}
      <div className="space-y-3 border-b border-zinc-800/80 bg-zinc-950/50 px-5 py-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title"
          className="w-full bg-transparent text-2xl font-bold text-zinc-100 placeholder-zinc-600 focus:outline-none"
        />

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (1-2 sentences)"
            className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
          <input
            type="text"
            value={aliasesText}
            onChange={(e) => setAliasesText(e.target.value)}
            placeholder="Aliases (comma-separated)"
            className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
          <input
            type="text"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="Tags (e.g. nextjs, supabase, daily-notes)"
            className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {(folder === "projects" ||
          (note.folder === "inbox" && classifyTarget === "projects")) && (
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Project name (e.g. kinder-vault)"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none md:w-1/3"
          />
        )}

        {showYaml && (
          <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-indigo-200">
            {frontmatterPreview}
          </pre>
        )}

        {wikiLinks.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
              <Link2 className="h-3 w-3" />
              Internal links:
            </span>
            {wikiLinks.map((link) => {
              const resolved = resolveWikiLink(link.target, allNotes);
              return resolved ? (
                <button
                  key={link.target}
                  type="button"
                  onClick={() => {
                    const full = allNotes.find((n) => n.id === resolved.id);
                    if (full) onNavigateNote(full);
                  }}
                  className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-300 hover:bg-indigo-500/20"
                >
                  [[{link.display}]]
                </button>
              ) : (
                <span
                  key={link.target}
                  title="Linked note does not exist yet"
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-500"
                >
                  [[{link.display}]]
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor + Preview */}
      <div
        className={`grid flex-1 overflow-hidden ${
          viewMode === "split" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {(viewMode === "edit" || viewMode === "split") && (
          <textarea
            aria-label="Markdown content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write in Markdown... Link other notes using [[note-slug]]."
            className="h-full w-full resize-none border-r border-zinc-800/80 bg-[#0f1117] p-5 font-mono text-sm leading-relaxed text-zinc-200 placeholder-zinc-600 focus:outline-none"
          />
        )}

        {(viewMode === "preview" || viewMode === "split") && (
          <div className="h-full overflow-y-auto bg-[#0c0e14] p-5">
            <div className="mb-3 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
              <Eye className="h-3 w-3" />
              Markdown Preview
            </div>
            <article className="space-y-3 text-sm leading-relaxed text-zinc-200 [&_code]:rounded [&_code]:bg-zinc-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-900 [&_pre]:p-3">
              {content.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              ) : (
                <p className="italic text-zinc-500">
                  No content yet. Start typing in the editor.
                </p>
              )}
            </article>
          </div>
        )}
      </div>
    </section>
  );
}
