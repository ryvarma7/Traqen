import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "glass-input w-full rounded-field px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
