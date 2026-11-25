"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  DAILY_NOTE_TAG,
  classifyInboxNoteSchema,
  formatDateSlug,
  noteInputSchema,
  searchNotesSchema,
  updateNoteSchema,
  vaultFolderSchema,
} from "@/lib/vault/schema";
import type { NoteRecord } from "@/lib/vault/types";

export interface ActionResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const uuidSchema = z.string().uuid("Invalid note ID");

async function requireAuthenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null };
  }

  return { supabase, user };
}

export async function listNotesAction(
  folder?: unknown
): Promise<ActionResult<NoteRecord[]>> {
  const { supabase, user } = await requireAuthenticatedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to access your vault." };
  }

  const parsedFolder = vaultFolderSchema.optional().safeParse(folder);
  if (!parsedFolder.success) {
    return {
      ok: false,
      error:
        parsedFolder.error.issues[0]?.message ?? "Invalid folder filter.",
    };
  }

  let query = supabase
    .from("notes")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (parsedFolder.data) {
    query = query.eq("folder", parsedFolder.data);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: (data ?? []) as NoteRecord[] };
}

export async function createNoteAction(
  rawInput: unknown
): Promise<ActionResult<NoteRecord>> {
  const { supabase, user } = await requireAuthenticatedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to create notes." };
  }

  const parsed = noteInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid note data",
    };
  }

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      ...parsed.data,
    })
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, data: data as NoteRecord };
}

export async function updateNoteAction(
  rawInput: unknown
): Promise<ActionResult<NoteRecord>> {
  const { supabase, user } = await requireAuthenticatedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to edit notes." };
  }

  const parsed = updateNoteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid update payload",
    };
  }

  const { id, ...noteFields } = parsed.data;

  const { data, error } = await supabase
    .from("notes")
    .update(noteFields)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, data: data as NoteRecord };
}

export async function deleteNoteAction(
  rawId: string
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await requireAuthenticatedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to delete notes." };
  }

  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) {
    return { ok: false, error: "Invalid note ID." };
  }

  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", parsedId.data)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, data: { id: parsedId.data } };
}

export async function classifyInboxNoteAction(
  rawInput: unknown
): Promise<ActionResult<NoteRecord>> {
  const { supabase, user } = await requireAuthenticatedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to classify notes." };
  }

  const parsed = classifyInboxNoteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid classification target",
    };
  }

  const normalizedProjectName =
    parsed.data.targetFolder === "projects" &&
    parsed.data.project_name &&
    parsed.data.project_name.trim().length > 0
      ? parsed.data.project_name.trim()
      : null;

  const { data, error } = await supabase
    .from("notes")
    .update({
      folder: parsed.data.targetFolder,
      project_name: normalizedProjectName,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .eq("folder", "inbox")
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, data: data as NoteRecord };
}

export async function openOrCreateTodayNoteAction(): Promise<
  ActionResult<NoteRecord>
> {
  const { supabase, user } = await requireAuthenticatedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to open today's note." };
  }

  const todaySlug = formatDateSlug(new Date());

  const { data: existing, error: fetchError } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", user.id)
    .eq("folder", "journal")
    .eq("slug", todaySlug)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }

  if (existing) {
    return { ok: true, data: existing as NoteRecord };
  }

  const { data: created, error: insertError } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      folder: "journal",
      slug: todaySlug,
      title: `Journal ${todaySlug}`,
      description: `Daily journal entry for ${todaySlug}`,
      content: `# ${todaySlug}\n\n## Today's Focus\n- \n\n## Quick Notes\n- \n`,
      aliases: [todaySlug],
      tags: [DAILY_NOTE_TAG],
      project_name: null,
    })
    .select("*")
    .single();

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  revalidatePath("/");
  return { ok: true, data: created as NoteRecord };
}

export async function searchNotesAction(
  rawInput: unknown
): Promise<ActionResult<NoteRecord[]>> {
  const { supabase, user } = await requireAuthenticatedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to search notes." };
  }

  const parsed = searchNotesSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Invalid search parameters." };
  }

  const { query: rawQuery, folder } = parsed.data;
  if (!rawQuery) {
    return listNotesAction(folder);
  }

  let dbQuery = supabase
    .from("notes")
    .select("*")
    .eq("user_id", user.id)
    .textSearch("search_vector", rawQuery, {
      type: "websearch",
      config: "simple",
    })
    .order("updated_at", { ascending: false })
    .limit(30);

  if (folder) {
    dbQuery = dbQuery.eq("folder", folder);
  }

  const { data, error } = await dbQuery;
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: (data ?? []) as NoteRecord[] };
}
