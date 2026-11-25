"use client";

import { useEffect, useState, useTransition } from "react";
import { FileText, Search, X } from "lucide-react";
import { searchNotesAction } from "@/app/actions/notes";
import { FOLDER_METADATA, type NoteRecord } from "@/lib/vault/types";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNote: (note: NoteRecord) => void;
  fallbackNotes: NoteRecord[];
}

export function SearchModal({
  isOpen,
  onClose,
  onSelectNote,
  fallbackNotes,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NoteRecord[]>(fallbackNotes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setResults(fallbackNotes.slice(0, 15));
      setError(null);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await searchNotesAction({ query: trimmed });
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error ?? "Failed to search notes.");
          return;
        }
        setError(null);
        setResults(res.data ?? []);
      });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, isOpen, fallbackNotes]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-20 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, description, content, aliases, or tags..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {error && (
            <p className="p-3 text-xs text-red-300" role="alert">
              {error}
            </p>
          )}

          {isPending && (
            <p className="p-3 text-xs text-zinc-400">
              Searching with Postgres FTS...
            </p>
          )}

          {!isPending && !error && results.length === 0 && (
            <p className="p-6 text-center text-sm text-zinc-500">
              {query.trim()
                ? `No notes found for "${query.trim()}".`
                : "No notes in your vault yet."}
            </p>
          )}

          <ul className="space-y-1">
            {results.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectNote(note);
                    onClose();
                  }}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-zinc-900"
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-zinc-100">
                        {note.title}
                      </span>
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-400">
                        {FOLDER_METADATA[note.folder].label}
                      </span>
                    </div>
                    {note.description && (
                      <p className="mt-0.5 truncate text-xs text-zinc-400">
                        {note.description}
                      </p>
                    )}
                    {note.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {note.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] text-indigo-300/80"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
