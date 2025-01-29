"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs" // v1.0.0
import { cn } from "../../lib/utils"

// Props interface for the main Tabs component
interface TabsProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> {
  defaultValue?: string
  orientation?: "horizontal" | "vertical"
  className?: string
}

// Props interface for individual tab triggers
interface TabsTriggerProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  value: string
  disabled?: boolean
  className?: string
}

// Props interface for tab content panels
interface TabsContentProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content> {
  value: string
  forceMount?: boolean
  className?: string
}

// Utility function for generating dynamic class names
const tabsVariants = ({
  orientation = "horizontal",
  className,
}: {
  orientation?: "horizontal" | "vertical"
  className?: string
}) => {
  return cn(
    "w-full relative",
    {
      // Horizontal orientation styles
      "flex-row space-x-2 rtl:space-x-reverse": orientation === "horizontal",
      // Vertical orientation styles  
      "flex-col space-y-2": orientation === "vertical",
    },
    className
  )
}

// Main Tabs component with compound components
const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  TabsProps
>(({ className, orientation = "horizontal", ...props }, ref) => (
  <TabsPrimitive.Root
    ref={ref}
    orientation={orientation}
    className={tabsVariants({ orientation, className })}
    {...props}
  />
))
Tabs.displayName = TabsPrimitive.Root.displayName

// Tab list component
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

// Tab trigger component
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5",
      "text-sm font-medium ring-offset-background transition-all",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

// Tab content component
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  TabsContentProps
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

// Export compound components
export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  type TabsProps,
  type TabsTriggerProps,
  type TabsContentProps,
}