"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  generateLearningPlan,
  type GenerateLearningPlanResult,
} from "@/lib/actions/tracks";
import type { LearningPlanInput, ParsedTrack } from "@/lib/tracks/contract";
import { useMotionPreferences } from "@/components/shared/motion-provider";
import { cn } from "@/lib/utils";

export type BackgroundPlanJob = {
  id: string;
  input: LearningPlanInput;
  status: "generating" | "ready" | "error";
  background: boolean;
  track?: ParsedTrack;
  error?: string;
  code?: GenerateLearningPlanResult["code"];
  remaining?: number;
  resetDate?: string;
};

type BackgroundPlanStart = {
  id: string;
  promise: Promise<GenerateLearningPlanResult>;
};

type BackgroundPlanContextValue = {
  job: BackgroundPlanJob | null;
  start: (input: LearningPlanInput, background?: boolean) => BackgroundPlanStart;
  claimReady: () => BackgroundPlanJob | null;
  retry: () => void;
  continueInBackground: () => void;
  clear: () => void;
};

const BackgroundPlanContext = React.createContext<BackgroundPlanContextValue | null>(null);

function createJobId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function LearningPlanBackgroundProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [job, setJob] = React.useState<BackgroundPlanJob | null>(null);
  const jobRef = React.useRef<BackgroundPlanJob | null>(null);
  const promiseRef = React.useRef<BackgroundPlanStart | null>(null);

  const start = React.useCallback(
    (input: LearningPlanInput, background = false): BackgroundPlanStart => {
      const current = jobRef.current;
      if (current?.status === "generating" && promiseRef.current) {
        return promiseRef.current;
      }

      const id = createJobId();
      const initialJob: BackgroundPlanJob = { id, input, status: "generating", background };
      jobRef.current = initialJob;
      setJob(initialJob);

      const promise = generateLearningPlan(input)
        .then((result) => {
          const currentJob = jobRef.current;
          if (currentJob?.id !== id) return result;

          const nextJob: BackgroundPlanJob = result.track
            ? {
                ...currentJob,
                status: "ready",
                track: result.track,
                remaining: result.remaining,
                resetDate: result.resetDate,
              }
            : {
                ...currentJob,
                status: "error",
                error: result.error ?? "The AI planner could not finish this plan.",
                code: result.code,
                remaining: result.remaining,
                resetDate: result.resetDate,
              };

          jobRef.current = nextJob;
          setJob(nextJob);
          return result;
        })
        .catch(() => {
          const currentJob = jobRef.current;
          const result: GenerateLearningPlanResult = {
            error: "The AI planner is unavailable right now. Please try again in a moment.",
            code: "GENERATION_UNAVAILABLE",
          };

          if (currentJob?.id === id) {
            const nextJob: BackgroundPlanJob = {
              ...currentJob,
              status: "error",
              error: result.error,
              code: result.code,
            };
            jobRef.current = nextJob;
            setJob(nextJob);
          }
          return result;
        });

      const handle = { id, promise };
      promiseRef.current = handle;
      return handle;
    },
    []
  );

  const claimReady = React.useCallback((): BackgroundPlanJob | null => {
    const current = jobRef.current;
    if (!current || current.status !== "ready") return null;

    jobRef.current = null;
    promiseRef.current = null;
    setJob(null);
    return current;
  }, []);

  const clear = React.useCallback(() => {
    jobRef.current = null;
    promiseRef.current = null;
    setJob(null);
  }, []);

  const retry = React.useCallback(() => {
    const current = jobRef.current;
    if (current?.status !== "error") return;
    start(current.input, current.background);
  }, [start]);

  const continueInBackground = React.useCallback(() => {
    const current = jobRef.current;
    if (!current) return;
    const nextJob = { ...current, background: true };
    jobRef.current = nextJob;
    setJob(nextJob);
  }, []);

  const value = React.useMemo(
    () => ({ job, start, claimReady, retry, continueInBackground, clear }),
    [claimReady, clear, continueInBackground, job, retry, start]
  );

  return (
    <BackgroundPlanContext.Provider value={value}>
      {children}
      <BackgroundPlanPopup />
    </BackgroundPlanContext.Provider>
  );
}

export function useLearningPlanBackground(): BackgroundPlanContextValue {
  const context = React.useContext(BackgroundPlanContext);
  if (!context) {
    throw new Error("useLearningPlanBackground must be used inside LearningPlanBackgroundProvider");
  }
  return context;
}

function BackgroundPlanPopup() {
  const context = React.useContext(BackgroundPlanContext);
  const reduceMotion = useMotionPreferences();
  const router = useRouter();

  if (!context) return null;
  const { job, retry, clear } = context;

  const review = () => {
    router.push("/tracks?resume=1");
  };

  return (
    <AnimatePresence initial={false} mode="wait">
      {job?.background && (
        <motion.aside
          key={`${job.id}-${job.status}`}
          initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
          className="pointer-events-none fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[60] md:inset-x-auto md:bottom-5 md:right-5"
          aria-live="polite"
        >
          <div className="pointer-events-auto w-full max-w-md rounded-card border border-white/15 bg-[#151515] p-4 shadow-modal md:w-[24rem]">
            <div className="flex items-start gap-3">
              <StatusIcon status={job.status} reduceMotion={reduceMotion} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {job.status === "generating"
                        ? "Building your learning plan"
                        : job.status === "ready"
                          ? "Your learning plan is ready"
                          : "We couldn’t finish your plan"}
                    </p>
                    <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                      {job.status === "generating"
                        ? "You can keep using Traqen. We’ll let you know here when it’s ready."
                        : job.status === "ready"
                          ? "Review the milestones, adjust the dates, and start tracking."
                          : job.error ?? "Try again and we’ll rebuild it from your original request."}
                    </p>
                  </div>
                  {job.status !== "generating" && (
                    <button
                      type="button"
                      onClick={clear}
                      className="focus-ring -mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-field text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Dismiss plan notification"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <p className="mt-2 truncate text-2xs font-medium uppercase tracking-[0.14em] text-muted-foreground/65">
                  {job.input.topic}
                </p>

                {job.status === "generating" && (
                  <div className="mt-3 flex items-center gap-2 text-2xs text-muted-foreground/75">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                    <span>AI planning in the background</span>
                  </div>
                )}

                {job.status === "ready" && (
                  <button
                    type="button"
                    onClick={review}
                    className="glass-btn-base glass-btn-primary mt-3 min-h-11 w-full rounded-field px-4 text-sm"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Review plan
                  </button>
                )}

                {job.status === "error" && (
                  <button
                    type="button"
                    onClick={retry}
                    className="glass-btn-base glass-btn-outline mt-3 min-h-11 w-full rounded-field px-4 text-sm"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Try again in background
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function StatusIcon({
  status,
  reduceMotion,
}: {
  status: BackgroundPlanJob["status"];
  reduceMotion: boolean;
}) {
  const iconClass = "h-4 w-4";

  if (status === "ready") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
        <CheckCircle2 className={iconClass} aria-hidden="true" />
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertCircle className={iconClass} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/8 text-foreground">
      <motion.span
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 1.2, ease: "linear", repeat: Infinity }}
        className="flex"
        aria-hidden="true"
      >
        <LoaderCircle className={cn(iconClass, "text-white/80")} />
      </motion.span>
      <span className="sr-only">Still building</span>
    </span>
  );
}
