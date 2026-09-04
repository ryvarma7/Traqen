"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string };

export async function saveNote(
  values: Record<string, unknown>,
  id?: string
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const payload = {
    title: values.title,
    content: values.content || null,
    pinned: Boolean(values.pinned),
    color: values.color || "gray",
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
