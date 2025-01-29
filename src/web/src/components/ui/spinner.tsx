"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

/**
 * Props interface for the Spinner component
 */
interface SpinnerProps {
  /**
   * Size variant of the spinner
   * @default "md"
   */
  size?: "sm" | "md" | "lg";

  /**
   * Additional CSS classes to apply to the spinner
   */
  className?: string;
}

/**
 * Size-specific classes for the spinner variants
 */
const sizeClasses = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-3"
} as const;

/**
 * A reusable loading spinner component that provides visual feedback during asynchronous operations.
 * Implements shadcn/ui design standards and WCAG 2.1 Level AA accessibility requirements.
 * 
 * @component
 * @example
 * // Default medium spinner
 * <Spinner />
 * 
 * // Small spinner with custom classes
 * <Spinner size="sm" className="text-blue-500" />
 */
export function Spinner({ 
  size = "md", 
  className 
}: SpinnerProps): JSX.Element {
  // Base classes for consistent styling and animation
  const baseClasses = [
    // Core styling
    "inline-block rounded-full border-current",
    // Transparent right border creates spinning effect
    "border-r-transparent",
    // Optimized animation with reduced motion support
    "animate-spin motion-reduce:animate-[spin_1.5s_linear_infinite]",
    // Performance optimization
    "will-change-transform"
  ].join(" ");

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        baseClasses,
        sizeClasses[size],
        // Allow custom color overrides through className
        "text-muted-foreground",
        className
      )}
    >
      {/* Hide visual content from screen readers */}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export type { SpinnerProps };