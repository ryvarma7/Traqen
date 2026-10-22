import * as React from "react";
import { cn } from "@/lib/utils";

/** Input types whose popup is drawn by the OS — the date and time pickers.
 *  They cannot carry the app theme, but `color-scheme: dark` is the one
 *  switch that makes the browser draw them dark instead of white. */
const NATIVE_PICKER_TYPES = new Set([
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "glass-input h-11 w-full rounded-field px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 md:h-10",
      type && NATIVE_PICKER_TYPES.has(type) && "[color-scheme:dark]",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
