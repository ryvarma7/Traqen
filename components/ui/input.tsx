import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "glass-input h-11 w-full rounded-field px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 md:h-10",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
