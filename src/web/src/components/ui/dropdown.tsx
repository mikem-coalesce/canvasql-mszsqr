"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu" // v2.0.0
import { cn } from "../../lib/utils"
import { buttonVariants } from "./button"

/**
 * Props interface for the main Dropdown component
 * Implements UI Component Library requirements for dropdowns
 */
interface DropdownProps {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: "start" | "center" | "end"
  side?: "top" | "right" | "bottom" | "left"
  className?: string
  disabled?: boolean
  onOpenChange?: () => void
}

/**
 * Props interface for individual dropdown items
 * Implements accessibility and keyboard navigation requirements
 */
interface DropdownItemProps {
  children: React.ReactNode
  className?: string
  disabled?: boolean
  onSelect?: () => void
  shortcut?: string
  destructive?: boolean
}

/**
 * Enhanced dropdown component with accessibility features
 * Implements WCAG 2.1 Level AA compliance and keyboard navigation
 */
const Dropdown = React.memo(({
  trigger,
  children,
  align = "end",
  side = "bottom",
  className,
  disabled,
  onOpenChange
}: DropdownProps) => {
  return (
    <DropdownMenuPrimitive.Root onOpenChange={onOpenChange}>
      <DropdownMenuPrimitive.Trigger
        asChild
        disabled={disabled}
        aria-label="Open menu"
      >
        {trigger}
      </DropdownMenuPrimitive.Trigger>

      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          side={side}
          className={cn(
            // Base styles
            "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
            // Animation
            "animate-in fade-in-0 zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            className
          )}
        >
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
})
Dropdown.displayName = "Dropdown"

/**
 * Enhanced dropdown item component with keyboard navigation
 * Implements consistent styling based on design specifications
 */
const DropdownItem = React.forwardRef<
  HTMLDivElement,
  DropdownItemProps & DropdownMenuPrimitive.DropdownMenuItemProps
>(({
  children,
  className,
  disabled,
  onSelect,
  shortcut,
  destructive,
  ...props
}, ref) => {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        // Base styles
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
        // Focus and hover states
        "focus:bg-accent focus:text-accent-foreground",
        // Disabled state
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        // Destructive variant
        destructive && "text-destructive",
        className
      )}
      disabled={disabled}
      onSelect={onSelect}
      {...props}
    >
      {children}
      {shortcut && (
        <span className="ml-auto text-xs tracking-widest text-muted-foreground">
          {shortcut}
        </span>
      )}
    </DropdownMenuPrimitive.Item>
  )
})
DropdownItem.displayName = "DropdownItem"

/**
 * Dropdown separator component for visual grouping
 */
const DropdownSeparator = React.forwardRef<
  HTMLDivElement,
  DropdownMenuPrimitive.DropdownMenuSeparatorProps
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
DropdownSeparator.displayName = "DropdownSeparator"

/**
 * Sub-menu component for nested dropdown functionality
 */
const DropdownSubMenu = React.forwardRef<
  HTMLDivElement,
  DropdownMenuPrimitive.DropdownMenuSubContentProps
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      // Base styles
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
      // Position and animation
      "absolute top-0 right-0 translate-x-1 data-[side=left]:-translate-x-1",
      // Animation
      "animate-in fade-in-0 zoom-in-95",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
      className
    )}
    {...props}
  />
))
DropdownSubMenu.displayName = "DropdownSubMenu"

export {
  Dropdown,
  DropdownItem,
  DropdownSeparator,
  DropdownSubMenu,
  type DropdownProps,
  type DropdownItemProps
}