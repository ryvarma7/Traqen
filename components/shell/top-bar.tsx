"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, LogOut } from "lucide-react";
import { logOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const linkClass =
  "glass-btn-base glass-btn-outline h-9 min-w-9 rounded-field px-3 text-xs md:text-sm font-medium text-foreground transition-all";

export function TopBar() {
  const pathname = usePathname();
  const isHub = pathname === "/";

  return (
    <header className="fixed inset-x-0 top-0 z-40 glass-header">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80"
        >
          {/* Olive-branded logo mark */}
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold"
            style={{
              background: "linear-gradient(135deg, #4A5730 0%, #3A4228 100%)",
              border: "1px solid rgba(107, 116, 76, 0.50)",
              color: "#F0A030",
              boxShadow:
                "0 1px 3px rgba(38,43,26,0.18), inset 0 1px 0 rgba(255,210,140,0.15)",
            }}
          >
            T
          </span>
          <span>Traqen</span>
        </Link>

        <nav className="flex items-center gap-2">
          {!isHub && (
            <motion.div whileTap={{ scale: 0.97 }}>
              <Link href="/" className={linkClass} aria-label="Home">
                <Home className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="hidden md:inline">Home</span>
              </Link>
            </motion.div>
          )}
          <motion.div whileTap={{ scale: 0.97 }}>
            <button
              type="button"
              onClick={() => logOut()}
              className={cn(linkClass)}
              aria-label="Log out"
            >
              <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden md:inline">Log out</span>
            </button>
          </motion.div>
        </nav>
      </div>
    </header>
  );
}
