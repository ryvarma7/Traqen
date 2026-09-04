"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, LogOut } from "lucide-react";
import { logOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const linkClass =
  "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-field px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-9";

export function TopBar() {
  const pathname = usePathname();
  const isHub = pathname === "/";

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-foreground"
        >
          Traqen
        </Link>

        <nav className="flex items-center gap-1">
          {!isHub && (
            <motion.div whileTap={{ scale: 0.97 }}>
              <Link href="/" className={linkClass} aria-label="Home">
                <Home className="h-4 w-4" />
                <span className="hidden md:inline">Home</span>
              </Link>
            </motion.div>
          )}
          <motion.div whileTap={{ scale: 0.97 }}>
            <button
              type="button"
              onClick={() => logOut()}
              className={cn(linkClass, "min-w-11")}
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Log out</span>
            </button>
          </motion.div>
        </nav>
      </div>
    </header>
  );
}
