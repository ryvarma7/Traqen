"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string };

const noteSchema = z.object({
  title: z.string().trim().min(1).max(500),
  content: z.preprocess((value) => value === "" ? undefined : value, z.string().max(20000).optional()),
  pinned: z.preprocess(
    (value) => value === "true" ? true : value === "false" ? false : value,
    z.boolean()
  ),
  color: z.enum(["gray", "red", "orange", "amber", "green", "blue", "violet"]),
});
const noteIdSchema = z.string().uuid();

export async function saveNote(
  values: Record<string, unknown>,
  id?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };

  const parsed = noteSchema.safeParse(values);
  if (!parsed.success) return { error: "Please check the note fields." };
  if (id !== undefined && !noteIdSchema.safeParse(id).success) {
    return { error: "Unable to save this note." };
  }

  const payload = {
    title: parsed.data.title,
    content: parsed.data.content || null,
    pinned: parsed.data.pinned,
    color: parsed.data.color,
    updated_at: new Date().toISOString(),
  };

  const result = id
    ? await supabase
        .from("notes")
        .update(payload)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle()
    : await supabase.from("notes").insert({ ...payload, user_id: user.id }).select("id").single();

  if (result.error) return { error: "Unable to save this note." };
  if (id && !result.data) return { error: "That note no longer exists." };
  revalidatePath("/");
  revalidatePath("/notes");
  return {};
}

export async function deleteNote(id: string): Promise<ActionResult> {
  if (!noteIdSchema.safeParse(id).success) {
    return { error: "Unable to delete this note." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };
  const { data, error } = await supabase
    .from("notes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return { error: "Unable to delete this note." };
  if (!data) return { error: "That note no longer exists." };
  revalidatePath("/");
  revalidatePath("/notes");
  return {};
}
