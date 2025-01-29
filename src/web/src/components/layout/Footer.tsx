"use client"

import * as React from "react"
import { buttonVariants } from "../ui/button"
import { cn } from "../../lib/utils"

/**
 * Gets the current year for copyright notice display
 * @returns {number} Current year
 */
const getCurrentYear = (): number => {
  return new Date().getFullYear()
}

/**
 * Footer component that displays copyright information, links, and status indicators
 * Implements WCAG 2.1 Level AA compliance with proper semantic structure and ARIA labels
 */
const Footer: React.FC = () => {
  const currentYear = getCurrentYear()

  return (
    <footer
      role="contentinfo"
      className={cn(
        // Base styles with responsive padding
        "border-t py-6 md:py-0 bg-background",
        // Ensure contrast meets WCAG AA standards
        "text-muted-foreground"
      )}
      aria-label="Site footer"
    >
      <div className="container flex flex-col items-center gap-4 md:h-14 md:flex-row md:justify-between">
        {/* Copyright notice */}
        <p className="text-sm">
          &copy; {currentYear} ERD Visualization Tool. All rights reserved.
        </p>

        {/* Navigation links with proper accessibility */}
        <nav
          className="flex items-center gap-4"
          aria-label="Footer navigation"
        >
          <a
            href="/terms"
            className={cn(
              buttonVariants({ variant: "link" }),
              "text-sm font-medium hover:text-foreground transition-colors"
            )}
          >
            Terms
          </a>
          <a
            href="/privacy"
            className={cn(
              buttonVariants({ variant: "link" }),
              "text-sm font-medium hover:text-foreground transition-colors"
            )}
          >
            Privacy
          </a>
          <a
            href="/help"
            className={cn(
              buttonVariants({ variant: "link" }),
              "text-sm font-medium hover:text-foreground transition-colors"
            )}
          >
            Help
          </a>
        </nav>

        {/* Status indicators */}
        <div 
          className="flex items-center gap-2 text-sm"
          aria-live="polite"
        >
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
            Connected
          </span>
          <span className="text-muted-foreground">|</span>
          <span>Users Online: 3</span>
          <span className="text-muted-foreground">|</span>
          <span>Last saved: 2m ago</span>
        </div>
      </div>
    </footer>
  )
}

export default Footer