"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string };

const taskSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.preprocess((value) => value === "" ? undefined : value, z.string().max(5000).optional()),
  status: z.enum(["To do", "In progress", "Done"]),
  priority: z.enum(["High", "Medium", "Low"]),
  due_date: z.preprocess((value) => value === "" ? undefined : value, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  category: z.preprocess((value) => value === "" ? undefined : value, z.string().max(200).optional()),
  related_type: z.preprocess((value) => value === "" ? undefined : value, z.enum(["job", "hackathon"]).optional()),
  related_id: z.preprocess((value) => value === "" ? undefined : value, z.string().uuid().optional()),
});

export async function saveTask(
  values: Record<string, unknown>,
  id?: string
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const parsed = taskSchema.safeParse(values);
  if (!parsed.success) return { error: "Please check the task fields." };

  if (parsed.data.related_type !== undefined && parsed.data.related_id === undefined) {
    return { error: "Select an application to link." };
  }
  if (parsed.data.related_id !== undefined && parsed.data.related_type === undefined) {
    return { error: "Select a link type." };
  }
  if (parsed.data.related_id && parsed.data.related_type) {
    const table = parsed.data.related_type === "job" ? "job_applications" : "hackathons";
    const { data: linkedItem, error: linkError } = await supabase
      .from(table)
      .select("id")
      .eq("id", parsed.data.related_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (linkError || !linkedItem) return { error: "That application could not be found." };
  }

  const payload: Record<string, unknown> = {
    title: parsed.data.title,
    description: parsed.data.description || null,
    status: parsed.data.status,
    priority: parsed.data.priority,
    due_date: parsed.data.due_date || null,
    category: parsed.data.category || null,
    related_type: parsed.data.related_type || null,
    related_id: parsed.data.related_id || null,
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
