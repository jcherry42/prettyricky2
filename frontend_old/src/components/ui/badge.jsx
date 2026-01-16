import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: 
          "text-foreground border-border",
        success:
          "border-success/30 bg-success/15 text-success",
        warning:
          "border-warning/30 bg-warning/15 text-warning",
        accent:
          "border-accent/30 bg-accent/15 text-accent",
        hot:
          "border-accent/30 bg-accent/15 text-accent font-semibold",
        warm:
          "border-warning/30 bg-warning/15 text-warning font-semibold",
        cold:
          "border-muted bg-muted text-muted-foreground",
        sold:
          "border-success/30 bg-success/15 text-success font-semibold",
        soft:
          "border-transparent bg-primary/10 text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
