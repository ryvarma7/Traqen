"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string };

export async function saveTask(
  values: Record<string, unknown>,
  id?: string
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const payload: Record<string, unknown> = {
    title: values.title,
    description: values.description || null,
    status: values.status,
    priority: values.priority,
    due_date: values.due_date || null,
    category: values.category || null,
    related_type: values.related_type || null,
    related_id: values.related_id || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("tasks").update(payload).eq("id", id)
    : await supabase.from("tasks").insert({ ...payload, user_id: user.id });

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/tasks");
  return {};
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/tasks");
  return {};
}

export async function setTaskStatus(
  id: string,
  status: "To do" | "In progress" | "Done"
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/tasks");
  return {};
}
