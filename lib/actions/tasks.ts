"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeActionError } from "@/lib/action-errors";

type ActionResult = { error?: string };

const taskSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.preprocess((value) => value === "" ? undefined : value, z.string().max(5000).optional()),
  notes: z.preprocess((value) => value === "" ? undefined : value, z.string().max(5000).optional()),
  status: z.enum(["To do", "In progress", "Done"]),
  priority: z.enum(["High", "Medium", "Low"]),
  due_date: z.preprocess((value) => value === "" ? undefined : value, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  category: z.preprocess((value) => value === "" ? undefined : value, z.string().max(200).optional()),
  related_type: z.preprocess((value) => value === "" ? undefined : value, z.enum(["job", "hackathon"]).optional()),
  related_name: z.preprocess((value) => value === "" ? undefined : value, z.string().trim().max(200).optional()),
});
const idSchema = z.string().uuid();

export async function saveTask(
  values: Record<string, unknown>,
  id?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (id !== undefined && !idSchema.safeParse(id).success) {
    return { error: "Unable to save this task." };
  }

  const parsed = taskSchema.safeParse(values);
  if (!parsed.success) return { error: "Please check the task fields." };

  if (parsed.data.related_type !== undefined && parsed.data.related_name === undefined) {
    return { error: "Name the job or hackathon you're linking." };
  }
  if (parsed.data.related_name !== undefined && parsed.data.related_type === undefined) {
    return { error: "Select a link type." };
  }

  const payload: Record<string, unknown> = {
    title: parsed.data.title,
    description: parsed.data.description || null,
    notes: parsed.data.notes || null,
    status: parsed.data.status,
    priority: parsed.data.priority,
    due_date: parsed.data.due_date || null,
    category: parsed.data.category || null,
    related_type: parsed.data.related_type || null,
    related_name: parsed.data.related_name || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("tasks").update(payload).eq("id", id).eq("user_id", user.id)
    : await supabase.from("tasks").insert({ ...payload, user_id: user.id });

  if (error) return { error: safeActionError(error, "Unable to save this task.") };
  revalidatePath("/");
  revalidatePath("/tasks");
  return {};
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!idSchema.safeParse(id).success) return { error: "Unable to delete this task." };
  const { error } = await supabase.from("tasks").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: safeActionError(error, "Unable to delete this task.") };
  revalidatePath("/");
  revalidatePath("/tasks");
  return {};
}

export async function setTaskStatus(
  id: string,
  status: "To do" | "In progress" | "Done"
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!idSchema.safeParse(id).success) return { error: "Unable to update this task." };
  const parsedStatus = z.enum(["To do", "In progress", "Done"]).safeParse(status);
  if (!parsedStatus.success) return { error: "Invalid task status." };
  const { error } = await supabase
    .from("tasks")
    .update({ status: parsedStatus.data, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id);
  if (error) return { error: safeActionError(error, "Unable to update this task.") };
  revalidatePath("/");
  revalidatePath("/tasks");
  return {};
}

/** Notes-only save — the full saveTask schema requires title/status/priority. */
export async function saveTaskNotes(
  id: string,
  notes: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!idSchema.safeParse(id).success) return { error: "Unable to save these notes." };

  const parsed = z.string().max(5000).safeParse(notes);
  if (!parsed.success) return { error: "Notes are too long." };

  const { error } = await supabase
    .from("tasks")
    .update({ notes: notes.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id);
  if (error) return { error: safeActionError(error, "Unable to save these notes.") };
  revalidatePath("/");
  revalidatePath("/tasks");
  return {};
}
