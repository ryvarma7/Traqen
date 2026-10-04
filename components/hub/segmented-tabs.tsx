"use client";

import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** Segmented text tab — no box, active state is brightness only. */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="tablist">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => {
            haptics.tap();
            onChange(key);
          }}
          className={cn(
            "focus-ring rounded-field px-2 py-1 text-2xs font-medium transition-colors duration-150",
            value === key
              ? "text-foreground"
              : "text-muted-foreground/70 hover:text-muted-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
