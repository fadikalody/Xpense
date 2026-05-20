import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-primary text-primary-foreground shadow-xs":
            variant === "default",
          "border-transparent bg-secondary text-secondary-foreground":
            variant === "secondary",
          "border-transparent bg-destructive text-destructive-foreground shadow-xs":
            variant === "destructive",
          "border-border text-foreground": variant === "outline",
          "border-transparent bg-emerald-500/15 text-emerald-500 border border-emerald-500/30":
            variant === "success",
          "border-transparent bg-amber-500/15 text-amber-500 border border-amber-500/30":
            variant === "warning",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
