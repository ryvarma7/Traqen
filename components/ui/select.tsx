import * as React from "react";
import { cn } from "@/lib/utils";

/** Styled native select with Framer glass styling. */
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "glass-input h-11 w-full appearance-none rounded-field bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22none%22%20stroke%3D%22%2378716C%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m4%206%204%204%204-4%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat px-3 pr-9 text-sm text-foreground focus:outline-none disabled:opacity-50 md:h-10",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export { Select };
