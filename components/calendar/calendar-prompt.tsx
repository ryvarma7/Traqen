"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/shared/modal-shell";
import { saveCalendarFeedback } from "@/lib/actions/calendar";

const PROMPT_DELAY_MS = 5000;

/** One-time Google Calendar integration prompt. Shown only while the user
 *  has no calendar_feedback row; the 5s timer starts on first /calendar
 *  visit and the answer is stored per account (not per device). */
export function CalendarPrompt() {
  const [open, setOpen] = React.useState(false);
  const [answer, setAnswer] = React.useState<"yes" | "no" | null>(null);
  const [suggestion, setSuggestion] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setOpen(true), PROMPT_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  const submit = async () => {
    if (!answer) return;
    setSaving(true);
    const res = await saveCalendarFeedback(answer, suggestion);
    // On success the page revalidates and this component unmounts; on
    // error just close so we don't nag.
    if (res?.error) console.error(res.error);
    setOpen(false);
  };

  return (
    <ModalShell open={open} onClose={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-card p-6">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Google Calendar integration?
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          We&apos;re deciding whether Traqen should sync with Google
          Calendar. Would you use it?
        </p>

        <div className="mt-5 flex gap-2.5">
          <Button
            type="button"
            variant={answer === "yes" ? "primary" : "outline"}
            className="flex-1"
            onClick={() => setAnswer("yes")}
          >
            Yes
          </Button>
          <Button
            type="button"
            variant={answer === "no" ? "primary" : "outline"}
            className="flex-1"
            onClick={() => setAnswer("no")}
          >
            No
          </Button>
        </div>

        <textarea
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
          placeholder="Any thoughts? (optional)"
          rows={2}
          className="glass-input mt-3 w-full resize-none rounded-field px-3 py-2 text-sm text-foreground placeholder:text-white/30"
        />

        <div className="mt-4 flex justify-end gap-2.5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
          >
            Later
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!answer || saving}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}