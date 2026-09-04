"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string };

const DATE_FIELDS = [
  "start_date",
  "end_date",
  "deadline",
  "applied_date",
  "follow_up_date",
] as const;

/** Empty strings from the form become nulls for Postgres. */
function normalize(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === "team_size") {
      out[key] = value === "" || value == null ? null : Number(value);
    } else if ((DATE_FIELDS as readonly string[]).includes(key)) {
      out[key] = value || null;
    } else {
      out[key] = typeof value === "string" && value.trim() === "" ? null : value;
    }
  }
  return out;
}

export async function saveJobApplication(
  values: Record<string, unknown>,
  id?: string
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const payload = { ...normalize(values), updated_at: new Date().toISOString() };

  const { error } = id
    ? await supabase.from("job_applications").update(payload).eq("id", id)
    : await supabase.from("job_applications").insert({ ...payload, user_id: user.id });

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/applications");
  return {};
}

export async function deleteJobApplication(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("job_applications").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/applications");
  return {};
}

export async function saveHackathon(
  values: Record<string, unknown>,
  id?: string
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const payload = { ...normalize(values), updated_at: new Date().toISOString() };

  const { error } = id
    ? await supabase.from("hackathons").update(payload).eq("id", id)
    : await supabase.from("hackathons").insert({ ...payload, user_id: user.id });

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/applications");
  return {};
}

export async function deleteHackathon(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("hackathons").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/applications");
  return {};
}

/** "+ Add new" — persist a custom dropdown value scoped to user/section/field. */
export async function addDropdownOption(
  section: "jobs" | "hackathons",
  fieldName: string,
  value: string
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const trimmed = value.trim();
  if (!trimmed) return { error: "Enter a value." };

  const { error } = await supabase.from("dropdown_options").insert({
    user_id: user.id,
    section,
    field_name: fieldName,
    value: trimmed,
  });
  // Duplicate (user_id, section, field_name, value) is fine — treat as success.
  if (error && !error.message.includes("duplicate")) return { error: error.message };
  revalidatePath("/applications");
  return {};
}
