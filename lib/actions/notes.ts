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

export async function saveNote(
  values: Record<string, unknown>,
  id?: string
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const parsed = noteSchema.safeParse(values);
  if (!parsed.success) return { error: "Please check the note fields." };

  const payload = {
    title: parsed.data.title,
    content: parsed.data.content || null,
    pinned: parsed.data.pinned,
    color: parsed.data.color,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("notes").update(payload).eq("id", id)
    : await supabase.from("notes").insert({ ...payload, user_id: user.id });

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/notes");
  return {};
}

export async function deleteNote(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/notes");
  return {};
}
