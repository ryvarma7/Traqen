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
    /* Fixed 40px row (the ProfileMenu button's height, unchanged) with the
       logo centred inside it at 44px. It overflows 2px top and bottom rather
       than growing the row, so nothing below this bar shifts. */
    <div className="mb-5 flex h-10 items-center justify-between gap-2 md:hidden">
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