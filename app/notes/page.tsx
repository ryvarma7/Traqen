import { redirect } from "next/navigation";
import { PageTransition } from "@/components/shell/page-transition";
import { NotesView } from "@/components/notes/notes-view";
import { createClient } from "@/lib/supabase/server";
import { requireAuthData, requireQueryData } from "@/lib/supabase/query";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const supabase = await createClient();

  // Auth check runs in parallel with the read; RLS scopes rows to auth.uid().
  const [userRes, notesRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("notes")
      .select("id, title, content, color, pinned, private, updated_at")
      .order("updated_at", { ascending: false }),
  ]);

  const auth = requireAuthData(userRes, "notes auth");
  if (!auth.user) redirect("/login");

  return (
    <>
      <PageTransition>
        <NotesView notes={requireQueryData(notesRes, "notes")} />
      </PageTransition>
    </>
  );
}
