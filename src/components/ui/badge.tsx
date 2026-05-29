import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-[11px] font-semibold tracking-[0.02em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-[color:var(--cascata-mist)] text-[color:var(--cascata-slate)]",
        brand: "bg-[color:var(--cascata-navy-soft)] text-[color:var(--cascata-navy-ink)]",
        success: "bg-[color:var(--cascata-inflow-soft)] text-[color:var(--cascata-inflow)]",
        warning: "bg-[color:var(--cascata-gold-soft)] text-[color:var(--cascata-gold-ink)]",
        danger: "bg-[color:var(--cascata-outflow-soft)] text-[color:var(--cascata-outflow)]",
        ai: "bg-[color:var(--cascata-gold-soft)] text-[color:var(--cascata-gold-deep)]",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
