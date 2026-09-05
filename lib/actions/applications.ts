"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { HACKATHON_STATUSES, JOB_STATUSES, PRIORITIES } from "@/lib/types";

type ActionResult = { error?: string };

const DATE_FIELDS = [
  "start_date",
  "end_date",
  "deadline",
  "applied_date",
  "follow_up_date",
] as const;

const optionalText = () =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().max(5000).optional()
  );
const optionalDate = () =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  );
const optionalUrl = () =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional()
  );

const jobSchema = z.object({
  company: z.string().trim().min(1).max(500),
  role_type: optionalText(), stage_detail: optionalText(), location_mode: optionalText(),
  source: optionalText(), contact_person: optionalText(), notes: optionalText(),
  status: z.enum(JOB_STATUSES), priority: z.enum(PRIORITIES),
  start_date: optionalDate(), end_date: optionalDate(), deadline: optionalDate(),
  applied_date: optionalDate(), follow_up_date: optionalDate(),
  application_link: optionalUrl(),
});

const hackathonSchema = z.object({
  hackathon_name: z.string().trim().min(1).max(500), organizing_company: optionalText(),
  type: optionalText(), purpose: optionalText(), theme_track: optionalText(),
  track_details: optionalText(), mode: optionalText(), team_members: optionalText(),
  round_detail: optionalText(), result_rank: optionalText(), notes: optionalText(),
  status: z.enum(HACKATHON_STATUSES), priority: z.enum(PRIORITIES),
  team_size: z.preprocess((value) => value === "" ? undefined : value,
    z.coerce.number().int().min(1).max(50).optional()),
  start_date: optionalDate(), end_date: optionalDate(), deadline: optionalDate(),
  applied_date: optionalDate(), follow_up_date: optionalDate(),
  application_link: optionalUrl(), project_link: optionalUrl(),
});

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

  const parsed = jobSchema.safeParse(values);
  if (!parsed.success) return { error: "Please check the application fields." };

  const payload = { ...normalize(parsed.data), updated_at: new Date().toISOString() };

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

  const parsed = hackathonSchema.safeParse(values);
  if (!parsed.success) return { error: "Please check the hackathon fields." };

  const payload = { ...normalize(parsed.data), updated_at: new Date().toISOString() };

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

/** Notes-only saves — the full schemas require company/hackathon_name, so a
 *  quick-edit from the expanded row needs its own lightweight action. */
export async function saveJobApplicationNotes(
  id: string,
  notes: string
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const parsed = z.string().max(5000).safeParse(notes);
  if (!parsed.success) return { error: "Notes are too long." };

  const { error } = await supabase
    .from("job_applications")
    .update({ notes: notes.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/applications");
  return {};
}

export async function saveHackathonNotes(
  id: string,
  notes: string
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const parsed = z.string().max(5000).safeParse(notes);
  if (!parsed.success) return { error: "Notes are too long." };

  const { error } = await supabase
    .from("hackathons")
    .update({ notes: notes.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id);
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

  const allowedFields = new Set([
    "role_type", "location_mode", "source", "type", "purpose", "theme_track", "mode",
  ]);
  if (!allowedFields.has(fieldName)) return { error: "Invalid dropdown field." };

  const { error } = await supabase.from("dropdown_options").insert({
    user_id: user.id,
    section,
    field_name: fieldName,
    value: trimmed,
  });
  // Duplicate (user_id, section, field_name, value) is fine — treat as success.
  if (error && error.code !== "23505") return { error: error.message };
  revalidatePath("/applications");
  return {};
}
