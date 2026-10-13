"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Privacy is a single-field, user-owned update. Keeping this small mutation in
 * the browser avoids a Server Action/RSC round trip; Supabase RLS remains the
 * authorization boundary for every request.
 */
export async function updateNotePrivacy(
  id: string,
  isPrivate: boolean
): Promise<{ error?: string }> {
  const { data, error } = await createClient()
    .from("notes")
    .update({ private: isPrivate })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { error: "Unable to update note visibility." };
  }

  return {};
}
