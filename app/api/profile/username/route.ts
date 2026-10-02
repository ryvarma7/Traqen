import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const usernameSchema = z.object({
  username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/),
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
    return NextResponse.json(
      { error: "Username must be 2-30 characters, letters/numbers/underscore/hyphen only" },
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
    return NextResponse.json({ error: "Failed to update username" }, { status: 500 });
  }

  return NextResponse.json({ username });
}