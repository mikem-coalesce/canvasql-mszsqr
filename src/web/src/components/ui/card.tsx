"use client"

import * as React from "react"
import { cn } from "../../lib/utils"

// Card container component with accessibility support
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    loading?: boolean
    error?: boolean
    hoverEffect?: boolean
  }
>(({ className, loading, error, hoverEffect, ...props }, ref) => (
  <div
    ref={ref}
    role="article"
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      loading && "animate-pulse bg-muted",
      error && "border-destructive",
      hoverEffect && "hover:shadow-md hover:scale-[1.02] cursor-pointer",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

// Card header section with consistent spacing
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

// Card title with semantic heading and accessibility
const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { id?: string }
>(({ className, id, ...props }, ref) => {
  const titleId = id || `card-title-${React.useId()}`
  return (
    <h3
      ref={ref}
      id={titleId}
      className={cn(
        "text-2xl font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
})
CardTitle.displayName = "CardTitle"

// Card description with proper contrast and readability
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement> & { id?: string }
>(({ className, id, ...props }, ref) => {
  const descriptionId = id || `card-desc-${React.useId()}`
  return (
    <p
      ref={ref}
      id={descriptionId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
})
CardDescription.displayName = "CardDescription"

// Card content section with consistent padding
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-6 pt-0 overflow-auto", className)}
    {...props}
  />
))
CardContent.displayName = "CardContent"

// Card footer section with action item alignment
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center justify-end gap-4 p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// Export compound component with all sub-components
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}