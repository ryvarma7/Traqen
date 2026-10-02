"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { MotionConfig } from "framer-motion";
import { ModalShell } from "@/components/shared/modal-shell";
import { useIsMobile } from "@/lib/hooks";
import { haptics } from "@/lib/haptics";
import { useProfile } from "@/lib/profile-store";
import { cn } from "@/lib/utils";

const schema = z.object({
  username: z
    .string()
    .min(2, "At least 2 characters")
    .max(30, "Max 30 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, underscore, hyphen only"),
});

type FormData = z.infer<typeof schema>;

/** Shared rename modal. Rendered once at the app root; opened either by the
 *  profile menu ("Rename") or the hub's first-login gate. Drives the shared
 *  username in the profile store so the avatar + greeting stay in sync. */
export function ProfileRenameModal() {
  const router = useRouter();
  const { username, renameOpen, renameMode, closeRename, rename } = useProfile();
  const isMobile = useIsMobile();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Prefill the current name each time the modal opens (rename flow); first
  // entry stays blank.
  React.useEffect(() => {
    if (renameOpen) reset({ username: renameMode === "rename" ? (username ?? "") : "" });
  }, [renameOpen, renameMode, username, reset]);

  const onSubmit = async (data: FormData) => {
    haptics.impact();
    const res = await fetch("/api/profile/username", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Something went wrong" }));
      toast.error(err.error ?? "Something went wrong");
      haptics.error();
      return;
    }
    rename(data.username);
    toast.success(renameMode === "rename" ? "Name updated" : `Welcome, ${data.username}`);
    haptics.success();
    router.refresh();
  };

  return (
    <MotionConfig transition={{ duration: 0.25, ease: "easeOut" }}>
      <ModalShell open={renameOpen} onClose={closeRename} variant={isMobile ? "sheet" : "centered"}>
        <div className="flex flex-col gap-6 p-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-white">
              {renameMode === "rename" ? "Rename your profile" : "What should we call you?"}
            </h2>
            <p className="mt-1 text-sm text-white/50">
              This will be your display name across the app.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="relative">
              <label htmlFor="profile-username" className="sr-only">
                Username
              </label>
              <input
                {...register("username")}
                id="profile-username"
                type="text"
                autoComplete="off"
                autoFocus
                placeholder="Enter your name"
                className={cn(
                  "glass-input w-full px-4 py-3 text-white placeholder-white/30",
                  "focus:outline-none focus:ring-2 focus:ring-white/20",
                  errors.username && "border-red-500/50"
                )}
                disabled={isSubmitting}
              />
              {errors.username && (
                <p className="absolute bottom-[-20px] left-0 text-xs text-red-400">
                  {errors.username.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "glass-btn-primary w-full py-3 rounded-field font-medium transition-all",
                "whileTap:scale-[0.98]",
                isSubmitting && "opacity-50 cursor-wait"
              )}
            >
              {isSubmitting ? "Saving..." : "Continue"}
            </button>
          </form>
        </div>
      </ModalShell>
    </MotionConfig>
  );
}