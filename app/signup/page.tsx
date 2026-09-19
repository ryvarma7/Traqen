"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";

const schema = z
  .object({
    username: z
      .string()
      .min(3, "At least 3 characters")
      .max(24, "Max 24 characters")
      .regex(/^[a-z0-9_-]+$/i, "Only letters, numbers, _ and -"),
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });

type FormData = z.infer<typeof schema>;
type Availability = "idle" | "checking" | "available" | "taken";

export default function SignupPage() {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [availability, setAvailability] = React.useState<Availability>("idle");
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const username = watch("username");

  // Debounced live availability check via the SECURITY DEFINER RPC —
  // it only ever returns one email for one exact username match.
  React.useEffect(() => {
    const uname = username?.trim().toLowerCase() ?? "";
    if (uname.length < 3 || !/^[a-z0-9_-]+$/.test(uname)) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.rpc("get_email_for_username", {
          uname,
        });
        setAvailability(data ? "taken" : "available");
      } catch {
        setAvailability("idle");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const result = await signUp(data.username, data.password);
    if (result?.error) setServerError(result.error);
  };

  return (
    <AuthCard title="Create your account" subtitle="Just a username and password — no email needed.">
      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="username" className="text-white/70">Username</Label>
          <div className="relative">
            <Input
              id="username"
              autoComplete="username"
              placeholder="yourname"
              className="auth-input pr-9 text-white placeholder:text-white/30"
              {...register("username")}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <AnimatePresence mode="wait">
                {availability === "checking" && (
                  <motion.span
                    key="checking"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                  </motion.span>
                )}
                {availability === "available" && (
                  <motion.span
                    key="available"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </motion.span>
                )}
                {availability === "taken" && (
                  <motion.span
                    key="taken"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <XCircle className="h-4 w-4 text-danger" />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </div>
          {errors.username ? (
            <FormError message={errors.username.message ?? null} />
          ) : (
            <FormError
              message={availability === "taken" ? "That username is taken." : null}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-white/70">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="auth-input text-white placeholder:text-white/30"
            {...register("password")}
          />
          {errors.password && (
            <FormError message={errors.password.message ?? null} />
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="text-white/70">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            className="auth-input text-white placeholder:text-white/30"
            {...register("confirm")}
          />
          {errors.confirm && (
            <FormError message={errors.confirm.message ?? null} />
          )}
        </div>

        <FormError message={serverError} />

        <Button
          type="submit"
          size="lg"
          className="auth-btn-primary w-full focus-visible:ring-white/30"
          disabled={isSubmitting || availability === "taken"}
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </motion.form>

      <p className="mt-6 text-center text-xs text-white/50">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-white underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
