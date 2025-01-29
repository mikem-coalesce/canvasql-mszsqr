"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip" // v1.0.0
import { cn } from "../../lib/utils"

// Constants for tooltip configuration
const DEFAULT_DELAY = 200
const DEFAULT_SIDE = "top" as const
const DEFAULT_ALIGN = "center" as const
const ANIMATION_DURATION = 150

// Props interface with enhanced accessibility options
interface TooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  content: string | React.ReactNode
  delayDuration?: number
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  sideOffset?: number
  role?: string
  id?: string
  ariaLabel?: string
  asChild?: boolean
}

// Provider component for global tooltip configuration
const TooltipProvider = TooltipPrimitive.Provider

// Root component for tooltip context
const TooltipRoot = TooltipPrimitive.Root

// Trigger component that wraps the element that triggers the tooltip
const TooltipTrigger = TooltipPrimitive.Trigger

// Content component with enhanced styling and animations
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      // Base styles with Tailwind CSS
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
      // Animations
      "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
      // Slide animations based on side
      "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = "TooltipContent"

// Main Tooltip component with compound components pattern
const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  ({
    children,
    content,
    delayDuration = DEFAULT_DELAY,
    side = DEFAULT_SIDE,
    align = DEFAULT_ALIGN,
    sideOffset = 4,
    role = "tooltip",
    id,
    ariaLabel,
    asChild = false,
    className,
    ...props
  }, ref) => {
    return (
      <TooltipProvider delayDuration={delayDuration}>
        <TooltipRoot>
          <TooltipTrigger asChild={asChild}>
            {children}
          </TooltipTrigger>
          <TooltipContent
            ref={ref}
            side={side}
            align={align}
            sideOffset={sideOffset}
            role={role}
            id={id}
            aria-label={ariaLabel}
            className={cn(className)}
            {...props}
          >
            {content}
          </TooltipContent>
        </TooltipRoot>
      </TooltipProvider>
    )
  }
)
Tooltip.displayName = "Tooltip"

// Export compound components
export {
  Tooltip,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent
}