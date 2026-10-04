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
    <div className="mb-5 flex items-center justify-between gap-2 md:hidden">
      <Link href="/" className="transition-opacity hover:opacity-80">
        <Image
          src="/logo-main.svg"
          alt="Traqen"
          width={244}
          height={110}
          className="h-9 w-auto"
          unoptimized
          priority
        />
      </Link>
      <ProfileMenu />
    </div>
  );
}