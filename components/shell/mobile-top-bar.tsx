"use client";

import Image from "next/image";
import Link from "next/link";
import { ProfileMenu } from "@/components/shell/profile-menu";

/**
 * Compact sticky header for phones, where the sidebar is hidden. Mirrors the
 * brand + profile pairing at the top of the desktop rail in a single row.
 */
export function MobileTopBar() {
  return (
    <div className="mobile-top-bar sticky top-0 z-30 -mx-4 mb-5 flex min-h-11 items-center justify-between gap-2 bg-background/90 px-4 pb-1 backdrop-blur-md md:hidden">
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
      <ProfileMenu />
    </div>
  );
}
