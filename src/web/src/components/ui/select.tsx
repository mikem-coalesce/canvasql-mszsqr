"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons"
import { cn } from "../../lib/utils"

// Interface for select item data structure
export interface SelectItem {
  value: string
  label: string
  disabled?: boolean
  description?: string
  icon?: React.ReactNode
}

// Props interface for Select component with accessibility support
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  items: SelectItem[]
  label?: string
  error?: string
  required?: boolean
  ariaLabel?: string
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({ className, value, onValueChange, placeholder, disabled, items, label, error, required, ariaLabel, ...props }, ref) => {
    return (
      <div className="relative">
        {label && (
          <label
            className={cn(
              "absolute left-2 -top-2 z-10 bg-background px-2 text-xs text-muted-foreground transition-all",
              error && "text-destructive"
            )}
          >
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </label>
        )}
        <SelectPrimitive.Root
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
        >
          <SelectPrimitive.Trigger
            ref={ref}
            className={cn(
              "relative w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-destructive focus:ring-destructive",
              className
            )}
            aria-label={ariaLabel}
            {...props}
          >
            <SelectPrimitive.Value placeholder={placeholder} />
            <SelectPrimitive.Icon className="absolute right-3 top-1/2 -translate-y-1/2">
              <ChevronDownIcon className="h-4 w-4" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>

          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              className={cn(
                "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                error && "border-destructive"
              )}
            >
              <SelectPrimitive.Viewport className="p-1">
                {items.map((item) => (
                  <SelectPrimitive.Item
                    key={item.value}
                    value={item.value}
                    disabled={item.disabled}
                    className={cn(
                      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                      item.disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <SelectPrimitive.ItemIndicator>
                        <CheckIcon className="h-4 w-4" />
                      </SelectPrimitive.ItemIndicator>
                    </span>
                    <div className="flex items-center gap-2">
                      {item.icon}
                      <div>
                        <SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
                        {item.description && (
                          <span className="text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
        {error && (
          <span className="text-xs text-destructive mt-1 ml-2">{error}</span>
        )}
      </div>
    )
  }
)

Select.displayName = "Select"

export { Select }