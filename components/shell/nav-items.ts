import {
  Briefcase,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutGrid,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

/** Every destination in the app, in sidebar order. Single source for the
 *  desktop sidebar and the mobile tab bar so the two can never drift. */
export type NavItem = {
  href: string;
  label: string;
  /** Bottom-bar label — kept to ~4 chars so five icons plus "+" fit a phone. */
  short: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", short: "Home", icon: LayoutGrid },
  { href: "/applications", label: "Applications", short: "Apps", icon: Briefcase },
  { href: "/tasks", label: "Tasks", short: "Tasks", icon: ClipboardList },
  { href: "/notes", label: "Notes", short: "Notes", icon: StickyNote },
  { href: "/calendar", label: "Calendar", short: "Cal", icon: CalendarDays },
  { href: "/tracks", label: "Tracks", short: "Tracks", icon: GraduationCap },
];

/** Routes whose view owns a create sheet. The floating "+" only appears on
 *  these — tapping it elsewhere would have nothing to open. */
export const CREATE_ROUTES = new Set([
  "/applications",
  "/tasks",
  "/notes",
  "/tracks",
]);

/** True when `pathname` is `href` or sits underneath it, so /tracks/abc
 *  still highlights the Tracks nav item. */
export function isActiveRoute(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}