"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardPaste,
  Copy,
  Globe,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormSheet } from "@/components/shared/form-sheet";
import { importTrack } from "@/lib/actions/tracks";
import { buildPrompt, parseTrackInput, type ParsedTrack } from "@/lib/tracks/contract";
import { cn } from "@/lib/utils";

const spring = { type: "spring", stiffness: 400, damping: 36 } as const;

const STEPS = ["Details", "Plan", "Paste", "Review"] as const;

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function ImportTrackModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [raw, setRaw] = React.useState("");
  const [track, setTrack] = React.useState<ParsedTrack | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [startDate, setStartDate] = React.useState(todayISO());
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Step 1 form fields
  const [topic, setTopic] = React.useState("");
  const [specs, setSpecs] = React.useState("");
  const [timeframe, setTimeframe] = React.useState("");
  const [courseUrl, setCourseUrl] = React.useState("");

  const generatedPrompt = React.useMemo(
    () => buildPrompt({ topic, specs, timeframe, courseUrl }),
    [topic, specs, timeframe, courseUrl]
  );

  const reset = React.useCallback(() => {
    setStep(0);
    setRaw("");
    setTrack(null);
    setParseError(null);
    setStartDate(todayISO());
    setSaving(false);
    setCopied(false);
    setTopic("");
    setSpecs("");
    setTimeframe("");
    setCourseUrl("");
  }, []);

  const close = () => {
    onClose();
    reset();
  };

  const copyPrompt = async () => {
    if (!topic.trim()) {
      toast.error("Enter what you want to learn first");
      return;
    }
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      toast.success("Prompt copied — paste it into your AI app");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Couldn't copy — select the text and copy manually");
    }
  };

  const handleParse = () => {
    const result = parseTrackInput(raw);
    if (result.ok) {
      setTrack(result.track);
      setParseError(null);
      setStep(3);
    } else {
      setParseError(result.error);
      setTrack(null);
    }
  };

  const handleSave = async () => {
    if (!track) return;
    setSaving(true);
    const result = await importTrack(track, startDate);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Track imported");
    close();
    router.push(`/tracks/${result.trackId}`);
  };

  const totalItems = track?.phases.reduce((n, p) => n + p.items.length, 0) ?? 0;

  const inputClass =
    "w-full rounded-field glass-input px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50";

  return (
    <FormSheet open={open} onClose={close} title="Import learning track">
      <div className="space-y-5">
        {/* Step indicator */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => i < step && setStep(i)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium transition-colors",
                i === step
                  ? "bg-white/12 text-foreground border border-white/25"
                  : i < step
                    ? "text-foreground/80 border border-transparent hover:bg-white/5"
                    : "text-muted-foreground border border-transparent"
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                  i < step
                    ? "bg-success text-black"
                    : i === step
                      ? "bg-white text-black"
                      : "bg-white/10 text-muted-foreground"
                )}
              >
                {i < step ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </span>
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Step 1: fill in details, copy generated prompt ────────────── */}
          {step === 0 && (
            <motion.div key="s0" {...slideFade} className="space-y-4">
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-foreground">
                  1 · Tell us what you want to learn
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Fill in the details — we&apos;ll build a ready-to-paste prompt
                  for your AI app.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="trk-topic" className="mb-1 block text-xs font-medium text-muted-foreground">
                    What do you want to learn? <span className="text-danger">*</span>
                  </label>
                  <input
                    id="trk-topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Web development, Machine learning, Piano…"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="trk-specs" className="mb-1 block text-xs font-medium text-muted-foreground">
                    Specifications &amp; suggestions <span className="font-normal text-muted-foreground/60">(optional)</span>
                  </label>
                  <input
                    id="trk-specs"
                    value={specs}
                    onChange={(e) => setSpecs(e.target.value)}
                    placeholder="e.g. 2 hrs/day, focus on React, include projects…"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="trk-time" className="mb-1 block text-xs font-medium text-muted-foreground">
                    Timeframe <span className="font-normal text-muted-foreground/60">(optional)</span>
                  </label>
                  <input
                    id="trk-time"
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    placeholder="e.g. 6 weeks, 3 months, starting April 1…"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="trk-url" className="mb-1 block text-xs font-medium text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Course URL for the AI to reference
                    </span>{" "}
                    <span className="font-normal text-muted-foreground/60">(optional)</span>
                  </label>
                  <input
                    id="trk-url"
                    value={courseUrl}
                    onChange={(e) => setCourseUrl(e.target.value)}
                    placeholder="e.g. https://www.udemy.com/course/…"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Generated prompt preview */}
              {topic.trim() && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                    Generated prompt preview
                  </p>
                  <div className="max-h-44 overflow-y-auto rounded-field glass-input p-3 text-xs leading-relaxed text-muted-foreground">
                    <pre className="whitespace-pre-wrap break-words font-sans">{generatedPrompt}</pre>
                  </div>
                </motion.div>
              )}

              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={copyPrompt}
                disabled={!topic.trim()}
                className="glass-btn-base glass-btn-primary h-11 w-full gap-2 rounded-field text-sm disabled:opacity-40"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy prompt"}
              </motion.button>

              <div className="flex justify-end">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => setStep(1)}
                  className="glass-btn-base glass-btn-outline h-10 gap-2 rounded-field px-4 text-sm"
                >
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: plan in the AI app ────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="s1" {...slideFade} className="space-y-4">
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-foreground">
                  2 · Get your plan from the AI
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Open your AI app (ChatGPT, Claude, Gemini…), paste the prompt
                  you just copied, and hit send. The AI returns a compact plan
                  in a code block.
                </p>
              </div>

              <div className="rounded-card glass-section p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-white/8 border border-white/15">
                    <Sparkles className="h-4 w-4 text-foreground" />
                  </span>
                  <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                    <p>
                      <span className="font-semibold text-foreground">Tips for a better plan:</span>
                    </p>
                    <ul className="list-disc space-y-1 pl-4">
                      <li>The prompt already includes your topic, specs, and timeframe — just paste and go.</li>
                      <li>If you gave a course URL, the AI will try to align with that syllabus.</li>
                      <li>The output is a compact pipe format, not JSON — much faster to generate.</li>
                      <li>Copy the entire code block the AI returns.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => setStep(0)}
                  className="glass-btn-base glass-btn-ghost h-10 gap-2 rounded-field px-3 text-sm text-muted-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => setStep(2)}
                  className="glass-btn-base glass-btn-primary h-10 gap-2 rounded-field px-4 text-sm"
                >
                  I have the plan <ArrowRight className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: paste the answer ──────────────────────────────────── */}
          {step === 2 && (
            <motion.div key="s2" {...slideFade} className="space-y-4">
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-foreground">
                  3 · Paste the AI&apos;s answer
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Paste the entire code block the AI returned. Both the compact
                  pipe format and legacy JSON work.
                </p>
              </div>

              <textarea
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value);
                  setParseError(null);
                }}
                rows={9}
                placeholder={"TRACK: Web Dev Fundamentals\nDESC: …\n---\nPHASE: Foundations\nDESC: …\nLearn HTML | Read MDN and build a page | https://mdn.io | +0"}
                className="w-full resize-y rounded-field glass-input p-3.5 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/50"
                spellCheck={false}
              />

              {parseError && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-field border border-danger-border/70 bg-danger-soft/60 px-3 py-2 text-xs text-danger"
                >
                  {parseError}
                </motion.p>
              )}

              <div className="flex justify-between">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => setStep(1)}
                  className="glass-btn-base glass-btn-ghost h-10 gap-2 rounded-field px-3 text-sm text-muted-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  disabled={!raw.trim()}
                  onClick={handleParse}
                  className="glass-btn-base glass-btn-primary h-10 gap-2 rounded-field px-4 text-sm disabled:opacity-40"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" /> Read plan
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: review + start date + save ────────────────────────── */}
          {step === 3 && track && (
            <motion.div key="s3" {...slideFade} className="space-y-4">
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-foreground">
                  4 · Review and save
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Looks right? Pick when the track starts (relative &ldquo;+N
                  day&rdquo; steps are counted from here), then save.
                </p>
              </div>

              <div className="rounded-card glass-section space-y-3 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{track.track_title}</p>
                  {track.description && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {track.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 font-mono text-2xs tabular-nums text-foreground/80">
                    {track.phases.length} phases
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 font-mono text-2xs tabular-nums text-foreground/80">
                    {totalItems} steps
                  </span>
                </div>
                <div className="max-h-44 space-y-2 overflow-y-auto border-t border-border pt-3">
                  {track.phases.map((phase, pi) => (
                    <div key={pi}>
                      <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {phase.title}
                      </p>
                      <ul className="mt-1 space-y-0.5 pl-3">
                        {phase.items.map((item, ii) => (
                          <li key={ii} className="flex items-baseline gap-2 text-xs text-foreground/85">
                            <span className="h-1 w-1 shrink-0 translate-y-[-1px] rounded-full bg-white/40" />
                            <span className="truncate">{item.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="track-start" className="shrink-0 text-xs font-medium text-muted-foreground">
                  Start date
                </label>
                <input
                  id="track-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="glass-input h-10 flex-1 rounded-field px-3 text-sm text-foreground [color-scheme:dark]"
                />
              </div>

              <div className="flex justify-between">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => setStep(2)}
                  className="glass-btn-base glass-btn-ghost h-10 gap-2 rounded-field px-3 text-sm text-muted-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  disabled={saving || !startDate}
                  onClick={handleSave}
                  className="glass-btn-base glass-btn-primary h-10 gap-2 rounded-field px-5 text-sm disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {saving ? "Saving…" : "Start tracking"}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FormSheet>
  );
}

const slideFade = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: spring,
} as const;
