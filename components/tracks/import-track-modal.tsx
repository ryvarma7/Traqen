"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormSheet } from "@/components/shared/form-sheet";
import { LoadingBar } from "@/components/shared/loading-bar";
import { PlanGenerationLoader } from "@/components/tracks/plan-generation-loader";
import { inputClass } from "@/components/tracks/fields";
import { useMotionPreferences } from "@/components/shared/motion-provider";
import { beginNav } from "@/components/shell/nav-loader";
import {
  generateLearningPlan,
  getLearningPlanQuota,
  importTrack,
} from "@/lib/actions/tracks";
import type { ParsedTrack } from "@/lib/tracks/contract";
import { haptics } from "@/lib/haptics";
import { blurIn, blurInTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";

const DEFAULT_QUOTA_LIMIT = 5;

const STEPS = ["Details", "Generate", "Review"] as const;

type LearningPlanQuotaResult = {
  used?: number;
  remaining?: number;
  limit?: number;
  resetDate?: string | null;
  error?: string;
};

type QuotaState = {
  used: number;
  remaining: number;
  limit: number;
  resetDate: string | null;
};

type FieldErrors = {
  topic?: string;
  dates?: string;
};

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatResetDate(value?: string | null): string | null {
  if (!value) return null;
  const datePart = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;

  const date = new Date(`${datePart}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normaliseCode(code?: string): string {
  return code?.trim().toLowerCase().replace(/[-\s]+/g, "_") ?? "";
}

function actionMessage(
  code: string | undefined,
  fallback: string
): string {
  const normalised = normaliseCode(code);

  switch (normalised) {
    case "quota_exceeded":
      return "You’ve used today’s 5 AI plans. Try again after the quota resets.";
    case "quota_unavailable":
      return "We couldn’t check your AI plan quota right now. Please try again.";
    case "quota_setup_required":
      return "Learning-plan setup is incomplete. Please apply the latest database migration and try again.";
    case "invalid_input":
    case "validation":
      return "Check your topic and dates, then try again.";
    case "invalid_plan":
      return "The AI planner returned an incomplete plan. Please try again.";
    case "generation_not_configured":
      return "The AI planner is not available yet. Please try again later.";
    case "generation_timeout":
      return "The AI planner took too long to respond. Please try again.";
    case "generation_incomplete":
      return "The AI planner response was cut off. Please try again.";
    case "generation_unavailable":
    case "provider":
    case "generation_failed":
      return "The AI planner is unavailable right now. Please try again in a moment.";
    case "unauthenticated":
    case "auth":
    case "sign_in":
      return "Your session has expired. Refresh the page and try again.";
    case "save":
    case "save_failed":
    case "database":
      return "We couldn’t save this learning track. Please try again.";
    default:
      break;
  }

  if (normalised.includes("quota") || normalised.includes("limit") || normalised.includes("rate")) {
    return "We couldn’t check your AI plan quota right now. Please try again.";
  }
  if (normalised.includes("validation") || normalised.includes("input")) {
    return "Check your topic and dates, then try again.";
  }
  if (normalised.includes("provider") || normalised.includes("generation")) {
    return "The AI planner is unavailable right now. Please try again in a moment.";
  }
  if (normalised.includes("auth") || normalised.includes("sign_in")) {
    return "Your session has expired. Refresh the page and try again.";
  }
  if (normalised.includes("save") || normalised.includes("database")) {
    return "We couldn’t save this learning track. Please try again.";
  }

  return fallback;
}

export function ImportTrackModal({  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const reduceMotion = useMotionPreferences();
  const [step, setStep] = React.useState(0);
  const [track, setTrack] = React.useState<ParsedTrack | null>(null);
  const [topic, setTopic] = React.useState("");
  const [specs, setSpecs] = React.useState("");
  const [timeframe, setTimeframe] = React.useState("");
  const [startDate, setStartDate] = React.useState(() => todayISO());
  const [endDate, setEndDate] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [quota, setQuota] = React.useState<QuotaState | null>(null);
  const [quotaLoading, setQuotaLoading] = React.useState(false);
  const [quotaError, setQuotaError] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const generationRequest = React.useRef(0);

  const reset = React.useCallback(() => {
    generationRequest.current += 1;
    setStep(0);
    setTrack(null);
    setTopic("");
    setSpecs("");
    setTimeframe("");
    setStartDate(todayISO());
    setEndDate("");
    setFieldErrors({});
    setErrorMessage(null);
    setQuota(null);
    setQuotaLoading(false);
    setQuotaError(null);
    setGenerating(false);
    setSaving(false);
  }, []);

  const close = React.useCallback(() => {
    onClose();
    reset();
  }, [onClose, reset]);

  const mergeQuota = React.useCallback((result: LearningPlanQuotaResult) => {
    setQuota((current) => {
      const limit = typeof result.limit === "number" ? result.limit : current?.limit ?? DEFAULT_QUOTA_LIMIT;
      const remaining =
        typeof result.remaining === "number"
          ? Math.max(0, result.remaining)
          : current?.remaining ?? limit;
      const used = typeof result.used === "number" ? Math.max(0, result.used) : Math.max(0, limit - remaining);

      return {
        used,
        remaining,
        limit,
        resetDate: result.resetDate ?? current?.resetDate ?? null,
      };
    });
    setQuotaError(null);
  }, []);

  const refreshQuota = React.useCallback(async () => {
    try {
      const result = await getLearningPlanQuota();
      if (result.error) {
        setQuotaError("We couldn’t check your AI plan quota right now.");
        return;
      }
      mergeQuota(result);
    } catch {
      setQuotaError("We couldn’t check your AI plan quota right now.");
    }
  }, [mergeQuota]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setQuotaLoading(true);
    setQuotaError(null);

    void getLearningPlanQuota()
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          setQuotaError("We couldn’t check your AI plan quota right now.");
          return;
        }
        mergeQuota(result);
      })
      .catch(() => {
        if (!cancelled) setQuotaError("We couldn’t check your AI plan quota right now.");
      })
      .finally(() => {
        if (!cancelled) setQuotaLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mergeQuota, open]);

  const goTo = (nextStep: number) => {
    if (generating || nextStep > step) return;
    haptics.selection();
    setErrorMessage(null);
    setStep(nextStep);
  };

  const setTopicValue = (value: string) => {
    setTopic(value);
    setFieldErrors((current) => ({ ...current, topic: undefined }));
    setErrorMessage(null);
  };

  const setStartDateValue = (value: string) => {
    setStartDate(value);
    setFieldErrors((current) => ({ ...current, dates: undefined }));
    setErrorMessage(null);
  };

  const setEndDateValue = (value: string) => {
    setEndDate(value);
    setFieldErrors((current) => ({ ...current, dates: undefined }));
    setErrorMessage(null);
  };

  const validateDetails = (): boolean => {
    const nextErrors: FieldErrors = {};
    if (!topic.trim()) nextErrors.topic = "Tell us what you want to learn.";

    if (!startDate) {
      nextErrors.dates = "Choose a start date.";
    } else if (endDate && endDate < startDate) {
      nextErrors.dates = "End date must be on or after the start date.";
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      haptics.error();
      toast.error(nextErrors.topic ?? nextErrors.dates ?? "Check the required fields.");
      return false;
    }
    return true;
  };

  const showActionError = (message: string) => {
    setErrorMessage(message);
    haptics.error();
    toast.error(message);
  };

  const handleGenerate = async () => {
    if (generating || !validateDetails()) return;

    if (quota?.remaining === 0) {
      const resetLabel = formatResetDate(quota.resetDate);
      const message = resetLabel
        ? `You’ve used today’s 5 AI plans. Your quota resets ${resetLabel}.`
        : "You’ve used today’s 5 AI plans. Try again after the quota resets.";
      showActionError(message);
      haptics.warning();
      return;
    }

    const requestId = generationRequest.current + 1;
    generationRequest.current = requestId;
    setErrorMessage(null);
    setTrack(null);
    setGenerating(true);
    setStep(1);
    haptics.impact();

    try {
      const result = await generateLearningPlan({
        topic: topic.trim(),
        specs: specs.trim(),
        timeframe: timeframe.trim(),
        startDate,
        endDate: endDate || null,
      });

      if (generationRequest.current !== requestId) return;

      const hasQuotaUpdate = typeof result.remaining === "number" || result.resetDate !== undefined;
      if (hasQuotaUpdate) {
        mergeQuota({ remaining: result.remaining, resetDate: result.resetDate });
      }

      if (result.error || !result.track) {
        const message = actionMessage(
          result.code,
          "We couldn’t build your learning plan. Please try again."
        );
        setStep(0);
        showActionError(message);
        if (!hasQuotaUpdate) void refreshQuota();
        return;
      }

      setTrack(result.track);
      setStep(2);
      haptics.success();
    } catch {
      if (generationRequest.current !== requestId) return;
      setStep(0);
      showActionError("The AI planner is unavailable right now. Please try again in a moment.");
      void refreshQuota();
    } finally {
      if (generationRequest.current === requestId) setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (saving || !track) return;
    if (!validateDetails()) return;

    setSaving(true);
    try {
      const result = await importTrack(track, startDate, endDate || null);
      if (result.error || !result.trackId) {
        showActionError(
          actionMessage(undefined, "We couldn’t save this learning track. Please try again.")
        );
        void refreshQuota();
        return;
      }

      haptics.success();
      toast.success("Learning track created");
      close();
      beginNav();
      router.push(`/tracks/${result.trackId}`);
    } catch {
      showActionError("We couldn’t save this learning track. Please try again.");
      void refreshQuota();
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 0) void handleGenerate();
    if (step === 2) void handleSave();
  };

  const totalItems = track?.phases.reduce((count, phase) => count + phase.items.length, 0) ?? 0;
  const stepMotion = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : { ...blurIn, transition: blurInTransition };

  return (
    <FormSheet
      open={open}
      onClose={close}
      title="Create learning track"
      headerRight={<QuotaHeader quota={quota} loading={quotaLoading} error={quotaError} />}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center gap-1.5" aria-label="Learning plan steps">
          {STEPS.map((label, index) => {
            const canReturn = index === 0 && index < step && !generating;
            return (
              <button
                key={label}
                type="button"
                onClick={() => canReturn && goTo(index)}
                disabled={!canReturn}
                aria-current={index === step ? "step" : undefined}
                className={cn(
                  "flex min-h-9 items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium transition-colors",
                  index === step
                    ? "border border-white/25 bg-white/12 text-foreground"
                    : index < step
                      ? "border border-transparent text-foreground/80"
                      : "border border-transparent text-muted-foreground",
                  canReturn && "hover:bg-white/5"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                    index < step
                      ? "bg-success text-black"
                      : index === step
                        ? "bg-white text-black"
                        : "bg-white/10 text-muted-foreground"
                  )}
                >
                  {index < step ? <Check className="h-2.5 w-2.5" /> : index + 1}
                </span>
                {label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === 0 && (
            <motion.div key="details" {...stepMotion} className="space-y-4">
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-foreground">1 · Tell us what you want to learn</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Give Traqen a direction and its in-app AI planner will turn it into a paced, actionable track.
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
                    onChange={(event) => setTopicValue(event.target.value)}
                    placeholder="e.g. Web development, machine learning, piano…"
                    className={cn(inputClass, fieldErrors.topic && "border-danger/70")}
                    aria-invalid={Boolean(fieldErrors.topic)}
                    aria-describedby={fieldErrors.topic ? "trk-topic-error" : undefined}
                    autoComplete="off"
                  />
                  {fieldErrors.topic && (
                    <p id="trk-topic-error" className="mt-1 text-2xs text-danger">
                      {fieldErrors.topic}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="trk-specs" className="mb-1 block text-xs font-medium text-muted-foreground">
                    Specifications and suggestions <span className="font-normal text-muted-foreground/60">(optional)</span>
                  </label>
                  <textarea
                    id="trk-specs"
                    value={specs}
                    onChange={(event) => setSpecs(event.target.value)}
                    placeholder="e.g. 2 hrs/day, focus on React, include projects…"
                    rows={3}
                    className={cn(inputClass, "resize-y leading-relaxed")}
                  />
                </div>

                <div>
                  <label htmlFor="trk-time" className="mb-1 block text-xs font-medium text-muted-foreground">
                    Time frame <span className="font-normal text-muted-foreground/60">(optional)</span>
                  </label>
                  <input
                    id="trk-time"
                    value={timeframe}
                    onChange={(event) => setTimeframe(event.target.value)}
                    placeholder="e.g. 6 weeks, 3 months, or exam-ready"
                    className={inputClass}
                    autoComplete="off"
                  />
                </div>

                <fieldset>
                  <legend className="mb-1 block text-xs font-medium text-muted-foreground">Plan date range</legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="track-start" className="mb-1 block text-2xs text-muted-foreground/80">
                        Start date <span className="text-danger">*</span>
                      </label>
                      <div className="relative">
                        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                          id="track-start"
                          type="date"
                          value={startDate}
                          onChange={(event) => setStartDateValue(event.target.value)}
                          className="glass-input h-10 w-full rounded-field px-3 pl-9 text-sm text-foreground [color-scheme:dark]"
                          aria-invalid={Boolean(fieldErrors.dates)}
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="track-end" className="mb-1 block text-2xs text-muted-foreground/80">
                        End date <span className="font-normal text-muted-foreground/60">(optional)</span>
                      </label>
                      <div className="relative">
                        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                          id="track-end"
                          type="date"
                          value={endDate}
                          min={startDate || undefined}
                          onChange={(event) => setEndDateValue(event.target.value)}
                          className="glass-input h-10 w-full rounded-field px-3 pl-9 text-sm text-foreground [color-scheme:dark]"
                          aria-invalid={Boolean(fieldErrors.dates)}
                          aria-describedby={fieldErrors.dates ? "trk-dates-error" : undefined}
                        />
                      </div>
                    </div>
                  </div>
                  {fieldErrors.dates && (
                    <p id="trk-dates-error" className="mt-1 text-2xs text-danger">
                      {fieldErrors.dates}
                    </p>
                  )}
                </fieldset>
              </div>

              {errorMessage && <InlineError message={errorMessage} />}

              <motion.button
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                type="submit"
                disabled={generating || quota?.remaining === 0}
                className="glass-btn-base glass-btn-primary h-11 w-full gap-2 rounded-field text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {quota?.remaining === 0 ? "Daily quota reached" : "Build my learning plan"}
                <ArrowRight className="h-3.5 w-3.5" />
              </motion.button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="generating" {...stepMotion}>
              <PlanGenerationLoader topic={topic} />
            </motion.div>
          )}

          {step === 2 && track && (
            <motion.div key="review" {...stepMotion} className="space-y-4">
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-foreground">3 · Review and save</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Your plan is ready. Review the milestones, confirm the date range, and start tracking.
                </p>
              </div>

              <div className="rounded-card glass-section space-y-3 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{track.track_title}</p>
                  {track.description && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{track.description}</p>
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
                <div className="max-h-64 space-y-3 overflow-y-auto border-t border-border pt-3">
                  {track.phases.map((phase, phaseIndex) => (
                    <div key={`${phase.title}-${phaseIndex}`}>
                      <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {phase.title}
                      </p>
                      {phase.description && (
                        <p className="mt-0.5 line-clamp-2 text-2xs leading-relaxed text-muted-foreground/70">
                          {phase.description}
                        </p>
                      )}
                      <ul className="mt-1 space-y-1.5 pl-3">
                        {phase.items.map((item, itemIndex) => (
                          <li key={`${item.title}-${itemIndex}`}>
                            <div className="flex items-baseline gap-2 text-xs text-foreground/85">
                              <span className="h-1 w-1 shrink-0 translate-y-[-1px] rounded-full bg-white/40" />
                              <span className="min-w-0 flex-1">{item.title}</span>
                            </div>
                            {item.description && (
                              <p className="mt-0.5 line-clamp-2 pl-3 text-2xs leading-relaxed text-muted-foreground/80">
                                {item.description}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="review-start" className="mb-1 block text-2xs font-medium text-muted-foreground">
                    Start date
                  </label>
                  <input
                    id="review-start"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDateValue(event.target.value)}
                    className="glass-input h-10 w-full rounded-field px-3 text-sm text-foreground [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label htmlFor="review-end" className="mb-1 block text-2xs font-medium text-muted-foreground">
                    End date <span className="font-normal text-muted-foreground/60">(optional)</span>
                  </label>
                  <input
                    id="review-end"
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(event) => setEndDateValue(event.target.value)}
                    className="glass-input h-10 w-full rounded-field px-3 text-sm text-foreground [color-scheme:dark]"
                  />
                </div>
              </div>

              {errorMessage && <InlineError message={errorMessage} />}

              <div className="flex justify-between gap-3">
                <motion.button
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                  type="button"
                  onClick={() => goTo(0)}
                  disabled={saving}
                  className="glass-btn-base glass-btn-ghost h-10 gap-2 rounded-field px-3 text-sm text-muted-foreground disabled:opacity-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </motion.button>
                <motion.button
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                  type="submit"
                  disabled={saving}
                  className="glass-btn-base glass-btn-primary h-10 gap-2 rounded-field px-5 text-sm disabled:opacity-60"
                >
                  {saving ? <LoadingBar className="h-1 w-10" /> : <Check className="h-4 w-4" />}
                  {saving ? "Saving…" : "Start tracking"}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </FormSheet>
  );
}

function QuotaHeader({
  quota,
  loading,
  error,
}: {
  quota: QuotaState | null;
  loading: boolean;
  error: string | null;
}) {
  const label = loading
    ? "AI · …"
    : error
      ? "AI · unavailable"
    : quota
      ? `AI · ${quota.remaining}/${quota.limit} left`
      : "AI · 5/day";
  const description = error
    ? "AI plan quota is temporarily unavailable"
    : quota
      ? `${quota.remaining} of ${quota.limit} AI plans remain today`
      : "Five AI plans per UTC day";

  return (
    <span
      className={cn(
        "max-w-[7.5rem] shrink-0 truncate rounded-full border px-2 py-1 text-[10px] font-medium tabular-nums",
        error ? "border-danger-border/60 text-danger" : "border-white/15 bg-white/5 text-muted-foreground"
      )}
      role="status"
      aria-live="polite"
      aria-label={description}
      title={description}
    >
      {label}
    </span>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-field border border-danger-border/70 bg-danger-soft/60 px-3 py-2 text-xs leading-relaxed text-danger"
    >
      {message}
    </p>
  );
}
