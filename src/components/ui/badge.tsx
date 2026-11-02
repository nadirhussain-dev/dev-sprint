import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", {
  variants: {
    variant: {
      default: "bg-secondary text-secondary-foreground",
      solid: "bg-energy text-energy-fg border-transparent",
      outline: "text-muted-foreground",
      success: "border-success/30 text-success bg-success/10",
      warning: "border-warning/30 text-warning bg-warning/10",
      danger: "border-danger/30 text-danger bg-danger/10",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
