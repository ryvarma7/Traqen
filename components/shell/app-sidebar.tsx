"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { NAV_ITEMS, isActiveRoute } from "@/components/shell/nav-items";
import { ProfileMenu } from "@/components/shell/profile-menu";
import { haptics } from "@/lib/haptics";

/**
 * Fixed left rail (md and up). One tonal step above the page base — the cards
 * inside the main column sit one step above this again.
 *
 * The logo lives here rather than in a top bar, so the brand, the nav and the
 * profile control all stay in the same column on every route.
 */
export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col lg:w-64">
      <div className="sticky top-0 flex h-dvh flex-col px-3 py-5">
        {/* Brand. The box is pinned to the ORIGINAL 32px height and the logo is
            centred inside it at 44px, so it renders larger while overflowing
            equally top and bottom. The layout footprint never changes, which
            is what keeps the nav below sitting exactly where it did. */}
        <div className="mb-6 flex h-8 items-center px-1">
          <Link href="/" className="flex items-center transition-opacity hover:opacity-80">
            <Image
              src="/logo-main.svg"
              alt="Traqen"
              width={244}
              height={110}
              className="h-11 w-auto"
              unoptimized
              priority
            />
          </Link>
        </div>

        {/* Primary nav */}
        <nav className="flex flex-col gap-0.5" aria-label="Main">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActiveRoute(pathname, href);
            return (
              <motion.div
                key={href}
                whileTap={{ scale: 0.97 }}
                onTap={() => haptics.tap()}
              >
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  data-active={active}
                  className="nav-item"
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{label}</span>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* Profile pinned to the bottom of the rail. */}
        <div className="mt-auto border-t border-white/[0.06] px-1 pt-3">
          <ProfileMenu variant="rail" />
        </div>
      </div>
    </aside>
  );
}