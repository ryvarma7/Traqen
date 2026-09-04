import { redirect } from "next/navigation";
import { PageTransition } from "@/components/shell/page-transition";
import { TopBar } from "@/components/shell/top-bar";
import { NotesView } from "@/components/notes/notes-view";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", user.id);

  return (
    <>
      <TopBar />
      <PageTransition>
        <h1 className="mb-6 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
          Notes
        </h1>
        <NotesView notes={data ?? []} />
      </PageTransition>
    </>
  );
}
