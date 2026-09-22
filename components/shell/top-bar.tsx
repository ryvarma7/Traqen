"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, Home, LogOut } from "lucide-react";
import { logOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const linkClass =
  "glass-btn-base glass-btn-outline h-9 min-w-9 rounded-field px-3 text-xs md:text-sm font-medium text-foreground transition-all";

/* In-flow brand row: logo top-left, actions top-right. No fixed header bar. */
export function TopBar() {
  const pathname = usePathname();
  const isHub = pathname === "/";

  return (
    <div className="mb-8 flex items-center justify-between">
      <Link href="/" className="transition-opacity hover:opacity-80">
        <Image
          src="/logo-main.svg"
          alt="Traqen"
          width={244}
          height={110}
          className="h-12 w-auto md:h-14"
          unoptimized
          priority
        />
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
          <Link href="/calendar" className={linkClass} aria-label="Calendar">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden md:inline">Calendar</span>
          </Link>
        </motion.div>
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
  );
}
