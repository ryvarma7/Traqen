"use client";

import Link from "next/link";
import Image from "next/image";
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
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <Image
            src="/logo.png"
            alt="Traqen"
            width={100}
            height={36}
            className="h-9 w-auto object-contain"
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
