"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { CREATE_ROUTES, NAV_ITEMS, isActiveRoute } from "@/components/shell/nav-items";
import { requestCreate } from "@/lib/create-bus";
import { haptics } from "@/lib/haptics";

/**
 * Floating translucent tab bar (below md), where the sidebar is hidden.
 *
 * The trailing "+" is the app's create affordance on mobile — it dispatches
 * on the create bus, and the view currently on screen opens the same sheet its
 * old floating button opened. It hides on routes with nothing to create
 * (Overview, Calendar) rather than sitting there inert.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const canCreate = CREATE_ROUTES.has(pathname);

  return (
    /* Outer wrapper owns the viewport anchoring; the bar inside is sized and
       centred. Doing `fixed inset-x-0` + a width + `mx-auto` on one element
       makes the bar's position depend on margin resolution, which is fragile
       when a page also has to scroll horizontally. */
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <nav
        aria-label="Main"
        className="bottom-bar mx-auto mb-3 flex w-[calc(100%-1.5rem)] max-w-md items-stretch gap-0.5 rounded-full px-1.5 py-1.5"
        style={{ boxShadow: "0 8px 32px -8px rgba(0,0,0,0.70)" }}
      >
        {NAV_ITEMS.map(({ href, short, icon: Icon }) => {
          const active = isActiveRoute(pathname, href);
          return (
            <motion.div
              key={href}
              whileTap={{ scale: 0.94 }}
              onTap={() => haptics.tap()}
              className="min-w-0 flex-1"
            >
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1 transition-colors"
                style={{
                  background: active ? "rgba(255,255,255,0.09)" : "transparent",
                  color: active ? "#FFFFFF" : "#C4C4C4",
                }}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="w-full truncate text-center text-[10px] font-medium leading-none">
                  {short}
                </span>
              </Link>
            </motion.div>
          );
        })}

        {canCreate && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onTap={() => haptics.tap()}
            type="button"
            aria-label="Create new"
            onClick={requestCreate}
            className="ml-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "#FFFFFF",
              color: "#0A0A0A",
              border: "1px solid #FFFFFF",
            }}
          >
            <Plus className="h-5 w-5" strokeWidth={2.25} />
          </motion.button>
        )}
      </nav>
    </div>
  );
}