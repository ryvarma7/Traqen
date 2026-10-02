import { PRIORITIES } from "@/lib/types";

/** Semantic order for the priority pills: High → Medium → Low. Sorting
 *  alphabetically would interleave them (High, Low, Medium), so every sort
 *  key that touches priority goes through this rank instead. Unknown or
 *  missing values sort last. */
export function priorityRank(priority: string | null | undefined): number {
  const i = PRIORITIES.indexOf(priority as (typeof PRIORITIES)[number]);
  return i === -1 ? PRIORITIES.length : i;
}