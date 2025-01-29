"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot" // v1.0.0
import { cn } from "../../lib/utils"

/**
 * Props interface for Button component with enhanced functionality
 * Implements UI Component Library requirements for button variants
 */
interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  asChild?: boolean
  isLoading?: boolean
}

/**
 * Enhanced button component with loading state and polymorphic behavior
 * Implements WCAG 2.1 Level AA compliance and keyboard navigation support
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant = "default", 
    size = "default", 
    asChild = false,
    isLoading = false,
    disabled,
    children,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : "button"

    // Combine disabled states
    const isDisabled = isLoading || disabled

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          isLoading && "opacity-70 cursor-wait",
        )}
        ref={ref}
        disabled={isDisabled}
        {...props}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {children}
          </div>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

/**
 * Enhanced utility function to generate button class names
 * Implements consistent styling based on design specifications
 */
const buttonVariants = ({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
  className?: string
} = {}) => {
  return cn(
    // Base styles with accessibility focus states
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    
    // Variant styles implementing design specifications
    {
      // Primary actions: filled buttons
      "default": "bg-primary text-primary-foreground hover:bg-primary/90",
      // Destructive actions
      "destructive": "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      // Secondary actions: outlined buttons
      "outline": "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      // Alternative secondary style
      "secondary": "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      // Tertiary actions: text buttons
      "ghost": "hover:bg-accent hover:text-accent-foreground",
      // Link style
      "link": "text-primary underline-offset-4 hover:underline"
    }[variant],

    // Size variations with consistent spacing scale
    {
      "default": "h-10 px-4 py-2",
      "sm": "h-9 rounded-md px-3",
      "lg": "h-11 rounded-md px-8",
      "icon": "h-10 w-10"
    }[size],
    
    className
  )
}

export { Button, buttonVariants }