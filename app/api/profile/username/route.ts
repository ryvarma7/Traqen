import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { usernameSchema } from "@/lib/profile-validation";
import { readProfile } from "@/lib/supabase/profile";

export async function PATCH(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "We couldn't process that request. Please try again." },
      { status: 403 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Your session has expired. Please sign in again." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "We couldn't process that request. Please try again." },
      { status: 400 }
    );
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

  // The SQL function merges name_set atomically, so a concurrent preference
  // update cannot be lost between a read and a write. The fallback keeps rename
  // working on projects that have not yet run the incremental SQL migration.
  const { data: rpcUsername, error: rpcError } = await supabase.rpc(
    "update_profile_username",
    { p_username: username }
  );
  if (!rpcError && typeof rpcUsername === "string") {
    return NextResponse.json({ username: rpcUsername }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (rpcError && !["PGRST202", "42883"].includes(rpcError.code)) {
    console.error("[profile/username] update failed:", rpcError.code);
    return NextResponse.json({ error: "Failed to update username. Please try again." }, { status: 500 });
  }

  const { data: profile, error: readError } = await readProfile(supabase, user.id);
  if (readError || !profile) {
    return NextResponse.json({ error: "Profile is unavailable. Please try again." }, { status: 503 });
  }
  const preferences = (profile.preferences as Record<string, unknown> | null) ?? {};
  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ username, preferences: { ...preferences, name_set: true } })
    .eq("id", user.id)
    .select("username")
    .maybeSingle();
  if (updateError) {
    console.error("[profile/username] legacy update failed:", updateError.code);
    return NextResponse.json({ error: "Failed to update username. Please try again." }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "Profile is unavailable. Please try again." }, { status: 503 });
  }
  return NextResponse.json({ username: updated.username }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
