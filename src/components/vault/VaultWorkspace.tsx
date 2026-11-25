"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  FilePlus2,
  FolderKanban,
  Inbox,
  LogOut,
  Search,
  Sparkles,
  Terminal,
} from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import {
  createNoteAction,
  openOrCreateTodayNoteAction,
} from "@/app/actions/notes";
import {
  FOLDER_METADATA,
  VAULT_FOLDERS,
  type NoteRecord,
  type VaultFolder,
} from "@/lib/vault/types";
import { formatDateSlug, normalizeSlug } from "@/lib/vault/schema";
import { NoteEditor } from "./NoteEditor";
import { SearchModal } from "./SearchModal";

interface VaultWorkspaceProps {
  initialNotes: NoteRecord[];
  initialError?: string | null;
  userEmail: string;
}

const FOLDER_ICONS: Record<VaultFolder, React.ComponentType<{ className?: string }>> = {
  inbox: Inbox,
  journal: CalendarDays,
  zettelkasten: BookOpen,
  projects: FolderKanban,
  todo: CheckSquare,
  prompts: Terminal,
};

export function VaultWorkspace({
  initialNotes,
  initialError = null,
  userEmail,
}: VaultWorkspaceProps) {
  const [notes, setNotes] = useState<NoteRecord[]>(initialNotes);
  const [activeFolder, setActiveFolder] = useState<VaultFolder>("inbox");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    initialNotes[0]?.id ?? null
  );
  const [quickTitle, setQuickTitle] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(
    initialError
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const folderCounts = useMemo(() => {
    const counts: Record<VaultFolder, number> = {
      inbox: 0,
      journal: 0,
      zettelkasten: 0,
      projects: 0,
      todo: 0,
      prompts: 0,
    };
    for (const note of notes) {
      counts[note.folder] += 1;
    }
    return counts;
  }, [notes]);

  const visibleNotes = useMemo(
    () => notes.filter((n) => n.folder === activeFolder),
    [notes, activeFolder]
  );

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) ?? null,
    [notes, selectedNoteId]
  );

  function handleCreateNote(targetFolder: VaultFolder, titleInput?: string) {
    setFeedbackError(null);
    const title =
      titleInput?.trim() ||
      (targetFolder === "journal"
        ? `Journal ${formatDateSlug()}`
        : `New ${FOLDER_METADATA[targetFolder].label} note`);

    const slug =
      targetFolder === "journal"
        ? formatDateSlug()
        : `${normalizeSlug(title) || "note"}-${Date.now().toString().slice(-4)}`;

    startTransition(async () => {
      const res = await createNoteAction({
        folder: targetFolder,
        slug,
        title,
        description: "",
        content: `# ${title}\n\n`,
        aliases: [],
        tags: targetFolder === "journal" ? ["daily-notes"] : [],
      });

      if (!res.ok || !res.data) {
        setFeedbackError(res.error ?? "Failed to create note.");
        return;
      }

      const created = res.data;
      setNotes((prev) => [created, ...prev]);
      setActiveFolder(created.folder);
      setSelectedNoteId(created.id);
      setQuickTitle("");
    });
  }

  function handleOpenTodayNote() {
    setFeedbackError(null);
    startTransition(async () => {
      const res = await openOrCreateTodayNoteAction();
      if (!res.ok || !res.data) {
        setFeedbackError(res.error ?? "Failed to open today's note.");
        return;
      }

      const todayNote = res.data;
      setNotes((prev) => {
        const exists = prev.some((n) => n.id === todayNote.id);
        return exists ? prev : [todayNote, ...prev];
      });
      setActiveFolder("journal");
      setSelectedNoteId(todayNote.id);
    });
  }

  function handleNoteUpdated(updated: NoteRecord) {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setActiveFolder(updated.folder);
  }

  function handleNoteDeleted(deletedId: string) {
    setNotes((prev) => prev.filter((n) => n.id !== deletedId));
    setSelectedNoteId(null);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0b0d12] text-zinc-100">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold tracking-tight text-zinc-100">
              KinderVault
            </h1>
            <p className="truncate text-[11px] text-zinc-500">{userEmail}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              title="Sign out"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Primary actions */}
        <div className="mb-5 space-y-2">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
          >
            <span className="inline-flex items-center gap-2">
              <Search className="h-3.5 w-3.5" />
              Search notes...
            </span>
            <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px]">
              Ctrl K
            </kbd>
          </button>

          <button
            type="button"
            onClick={handleOpenTodayNote}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Today&apos;s Note ({formatDateSlug()})
          </button>
        </div>

        {/* Folders */}
        <nav aria-label="Vault folders" className="flex-1 space-y-1">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Vault (No Root Notes)
          </p>
          {VAULT_FOLDERS.map((folder) => {
            const Icon = FOLDER_ICONS[folder];
            const isActive = activeFolder === folder;
            return (
              <button
                key={folder}
                type="button"
                onClick={() => setActiveFolder(folder)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                  isActive
                    ? "bg-indigo-500/15 font-medium text-indigo-300"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  {FOLDER_METADATA[folder].label}
                </span>
                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400">
                  {folderCounts[folder]}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 pt-3 text-[11px] text-zinc-500">
          {FOLDER_METADATA[activeFolder].description}
        </div>
      </aside>

      {/* Notes list column */}
      <div className="flex w-80 shrink-0 flex-col border-r border-zinc-800 bg-[#0d1017]">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              {FOLDER_METADATA[activeFolder].label}
            </h2>
            <p className="text-[11px] text-zinc-500">
              {visibleNotes.length}{" "}
              {visibleNotes.length === 1 ? "note" : "notes"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleCreateNote(activeFolder)}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            New
          </button>
        </div>

        {/* Quick inbox capture */}
        {activeFolder === "inbox" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!quickTitle.trim()) return;
              handleCreateNote("inbox", quickTitle);
            }}
            className="border-b border-zinc-800 p-3"
          >
            <input
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Quick capture in Inbox + Enter..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
          </form>
        )}

        {feedbackError && (
          <div
            role="alert"
            className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200"
          >
            {feedbackError}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {visibleNotes.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">
              No notes in{" "}
              <span className="font-medium text-zinc-300">
                {FOLDER_METADATA[activeFolder].label}
              </span>
              . Create one using the button above.
            </div>
          ) : (
            <ul className="space-y-1">
              {visibleNotes.map((note) => {
                const isSelected = note.id === selectedNoteId;
                return (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedNoteId(note.id)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        isSelected
                          ? "border-indigo-500/50 bg-indigo-500/10"
                          : "border-transparent hover:bg-zinc-900"
                      }`}
                    >
                      <p className="truncate text-sm font-medium text-zinc-100">
                        {note.title}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
                        {note.folder}/{note.slug}.md
                      </p>
                      {note.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                          {note.description}
                        </p>
                      )}
                      {note.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {note.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-indigo-300/90"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Editor pane */}
      <main className="flex-1 overflow-hidden">
        {selectedNote ? (
          <NoteEditor
            key={selectedNote.id}
            note={selectedNote}
            allNotes={notes}
            onUpdated={handleNoteUpdated}
            onDeleted={handleNoteDeleted}
            onNavigateNote={(target) => {
              setActiveFolder(target.folder);
              setSelectedNoteId(target.id);
            }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <BookOpen className="h-10 w-10 text-zinc-700" />
            <h3 className="text-base font-medium text-zinc-300">
              Select a note or create a new one
            </h3>
            <p className="max-w-sm text-xs text-zinc-500">
              Press <kbd className="rounded bg-zinc-800 px-1.5 py-0.5">Ctrl+K</kbd>{" "}
              to search across your entire vault, or open today&apos;s daily note.
            </p>
          </div>
        )}
      </main>

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        fallbackNotes={notes}
        onSelectNote={(note) => {
          setActiveFolder(note.folder);
          setSelectedNoteId(note.id);
        }}
      />
    </div>
  );
}
