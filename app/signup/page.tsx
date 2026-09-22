import { redirect } from "next/navigation";

/** Google sign-in creates accounts on first use, so there is no separate
 *  signup form anymore — keep the URL alive for old links/bookmarks. */
export default function SignupPage() {
  redirect("/login");
}