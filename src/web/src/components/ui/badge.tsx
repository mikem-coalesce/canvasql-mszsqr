"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority" // v0.7.0
import { cn } from "../../lib/utils"

// Define badge variants using class-variance-authority
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground"
      },
    },
    defaultVariant: "default",
  }
)

// Define props interface extending HTML div attributes and variant props
export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * A reusable badge component for displaying status indicators, labels, or counts.
 * Implements WCAG 2.1 Level AA compliance with proper ARIA roles and focus states.
 * 
 * @component
 * @param {BadgeProps} props - Component props including variant and className
 * @returns {JSX.Element} Rendered badge component
 */
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    )
  }
)

// Set display name for debugging and dev tools
Badge.displayName = "Badge"

export { Badge, badgeVariants }