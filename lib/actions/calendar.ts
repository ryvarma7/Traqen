"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/** One-time "should we add Google Calendar integration?" answer from the
 *  /calendar popup. Upserts (unique on user_id) so a double-submit or a
 *  second device can't create a second row. */
export async function saveCalendarFeedback(
  answer: "yes" | "no",
  suggestion: string
) {
  const parsed = z.object({
    answer: z.enum(["yes", "no"]),
    suggestion: z.string().max(2000),
  }).safeParse({ answer, suggestion });
  if (!parsed.success) return { error: "Please check your feedback." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("calendar_feedback").upsert(
    {
      user_id: user.id,
      answer: parsed.data.answer,
      suggestion: parsed.data.suggestion.trim() || null,
    },
    { onConflict: "user_id" }
  );
  if (error) return { error: error.message };

  // The popup shows only until an answer exists, so refresh the page data.
  revalidatePath("/calendar");
  return {};
}
