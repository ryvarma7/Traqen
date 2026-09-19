"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logIn } from "@/lib/actions/auth";

const schema = z.object({
  username: z.string().min(1, "Enter your username"),
  password: z.string().min(1, "Enter your password"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const result = await logIn(data.username, data.password);
    if (result?.error) setServerError(result.error);
  };

  return (
    <AuthCard title="Log in" subtitle="Welcome back to Traqen.">
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
          <Input
            id="username"
            autoComplete="username"
            placeholder="yourname"
            className="auth-input text-white placeholder:text-white/30"
            {...register("username")}
          />
          {errors.username && (
            <FormError message={errors.username.message ?? null} />
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-white/70">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="auth-input text-white placeholder:text-white/30"
            {...register("password")}
          />
          {errors.password && (
            <FormError message={errors.password.message ?? null} />
          )}
        </div>

        <FormError message={serverError} />

        <Button
          type="submit"
          size="lg"
          className="auth-btn-primary w-full focus-visible:ring-white/30"
          disabled={isSubmitting}
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Log in
        </Button>
      </motion.form>

      <p className="mt-6 text-center text-xs text-white/50">
        No account yet?{" "}
        <Link
          href="/signup"
          className="font-medium text-white underline-offset-4 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </AuthCard>
  );
}
