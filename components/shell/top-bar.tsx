"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, Home, LogOut } from "lucide-react";
import { logOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const linkClass =
  "glass-btn-base glass-btn-outline flex h-10 items-center justify-center gap-1.5 rounded-field px-2.5 transition-all md:h-9 md:min-w-9 md:px-3 md:text-sm md:font-medium";

/* In-flow brand row: logo top-left, actions top-right. No fixed header bar. */
export function TopBar() {
  const pathname = usePathname();
  const isHub = pathname === "/";

  return (
    <div className="mb-6 flex items-center justify-between md:mb-8">
      <Link href="/" className="transition-opacity hover:opacity-80">
        <Image
          src="/logo-main.svg"
          alt="Traqen"
          width={244}
          height={110}
          className="h-12 w-auto md:h-16"
          unoptimized
          priority
        />
      </Link>

      <nav className="flex items-center gap-2">
        {!isHub && (
          <motion.div whileTap={{ scale: 0.97 }}>
            <Link href="/" className={linkClass} aria-label="Home">
              <Home className="h-4 w-4 shrink-0 text-muted-foreground md:h-3.5 md:w-3.5" />
              <span className="hidden md:inline">Home</span>
            </Link>
          </motion.div>
        )}
        <motion.div whileTap={{ scale: 0.97 }}>
          <Link href="/calendar" className={linkClass} aria-label="Calendar">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground md:h-3.5 md:w-3.5" />
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
            <LogOut className="h-4 w-4 shrink-0 text-muted-foreground md:h-3.5 md:w-3.5" />
            <span className="hidden md:inline">Log out</span>
          </button>
        </motion.div>
      </nav>
    </div>
  );
}
