"use client"

import * as React from "react"
import { Toaster as Sonner } from "sonner"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

// Constants for toast configuration
const TOAST_DURATION = 5000
const TOAST_Z_INDEX = 400 // Based on z-index layer specs

// Toast variant styles using class-variance-authority
const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full",
  {
    variants: {
      variant: {
        default: "border-border bg-background text-foreground",
        success: "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900 dark:text-green-100",
        error: "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900 dark:text-red-100",
        warning: "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
        info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-900 dark:text-blue-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Toast component props interface
interface ToastProps extends VariantProps<typeof toastVariants> {
  title: string
  description?: string
  duration?: number
  className?: string
  onDismiss?: () => void
  ariaLabel?: string
}

// Main Toast component with accessibility support
export function Toast({
  variant = "default",
  title,
  description,
  duration = TOAST_DURATION,
  className,
  onDismiss,
  ariaLabel,
}: ToastProps) {
  return (
    <div
      role="alert"
      aria-label={ariaLabel || title}
      className={cn(toastVariants({ variant }), className)}
      data-toast-duration={duration}
    >
      <div className="grid gap-1">
        <div className="text-sm font-semibold">
          {title}
        </div>
        {description && (
          <div className="text-sm opacity-90">
            {description}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
          aria-label="Close notification"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
}

// Toast provider component with accessibility configuration
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      closeButton
      position="top-right"
      expand
      richColors
      duration={TOAST_DURATION}
      style={{ zIndex: TOAST_Z_INDEX }}
      // Accessibility attributes
      theme="system"
      hotkey={["altKey", "KeyT"]}
      gap={8}
      visibleToasts={3}
    >
      {children}
    </Sonner>
  )
}

// Export toast variants for external use
export { toastVariants }