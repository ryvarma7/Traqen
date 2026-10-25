import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readProfile } from "@/lib/supabase/profile";

/** Signed-in user's own display profile. RLS scopes the read to auth.uid(). */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, {
      status: 401, headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { data, error } = await readProfile(supabase, user.id);

  if (error) {
    return NextResponse.json({ error: "We couldn't load your profile. Please try again." }, {
      status: 500, headers: { "Cache-Control": "private, no-store" },
    });
  }

  if (!data) {
    return NextResponse.json({ error: "Profile is unavailable. Please try again." }, {
      status: 503, headers: { "Cache-Control": "private, no-store" },
    });
  }

  return NextResponse.json({
    username: data.username,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
