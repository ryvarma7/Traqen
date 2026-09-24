"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AuthCard } from "@/components/auth/auth-card";
import { FormError } from "@/components/auth/form-error";
import { GoogleIcon } from "@/components/auth/google-icon";
import { Button } from "@/components/ui/button";
import { logInWithGoogle } from "@/lib/actions/auth";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setIsSubmitting(true);
    const result = await logInWithGoogle();
    if (result?.error) {
      setActionError(result.error);
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard title="Log in" subtitle="Welcome back to Traqen.">
      <motion.form
        initial={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
        animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onSubmit={onSubmit}
        noValidate
      >
        <FormError message={actionError || error} />

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="auth-btn-primary w-full focus-visible:ring-white/30"
        >
          <GoogleIcon className="h-4 w-4" />
          {isSubmitting ? "Opening Google…" : "Continue with Google"}
        </Button>
      </motion.form>

      <p className="mt-6 text-center text-xs text-white/50">
        New to Traqen? The same button creates your account — no forms.
      </p>
    </AuthCard>
  );
}

/** useSearchParams needs a Suspense boundary or the production build
 *  fails during static page generation. */
export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginContent />
    </React.Suspense>
  );
}
