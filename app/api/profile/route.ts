import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Signed-in user's own profile: username + login email. RLS scopes the
 *  read to auth.uid(), so the email never leaks to anyone but the owner. */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("username, email_internal")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }

  return NextResponse.json({
    username: data?.username ?? null,
    email: data?.email_internal ?? null,
  });
}