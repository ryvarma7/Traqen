import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Usernames are display names, not identifiers — spaces and other punctuation
// are allowed so "Yeshwanth" reads naturally in the hub greeting. Keep this in
// sync with the modal's client-side schema.
const usernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "At least 2 characters")
    .max(30, "Max 30 characters")
    .regex(/^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u, "Start with a letter or number"),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = usernameSchema.safeParse(body);
  if (!parsed.success) {
    // Surface zod's own message so the toast matches what the modal already
    // showed inline, instead of a second, differently-worded rule.
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid name" },
      { status: 400 }
    );
  }

  const { username } = parsed.data;

  // Update the username, then merge name_set into any existing preferences
  // (merge in JS — a flat overwrite would clobber other prefs).
  const { data: prefsRes } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();

  const mergedPrefs = {
    ...((prefsRes?.preferences as Record<string, unknown> | null) ?? {}),
    name_set: true,
  };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ username, preferences: mergedPrefs })
    .eq("id", user.id);

  if (updateError) {
    // Log the real Postgres error. The most common cause by far is a leftover
    // UNIQUE constraint on profiles.username from the pre-Google schema (see
    // `drop constraint` in supabase/schema.sql); without this log the route
    // just reported a generic 500 and the cause was invisible.
    console.error("[profile/username] update failed:", updateError.code, updateError.message);
    return NextResponse.json({ error: "Failed to update username" }, { status: 500 });
  }

  return NextResponse.json({ username });
}