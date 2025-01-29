"use client"

import * as React from "react"
import { Avatar } from "../ui/avatar"
import { cn } from "../../lib/utils"
import type { UserPresence, UserStatus } from "../../types/collaboration.types"

// Status color mappings with dark mode variants
const STATUS_COLORS: Record<UserStatus, string> = {
  online: "bg-green-500 dark:bg-green-400",
  idle: "bg-yellow-500 dark:bg-yellow-400",
  offline: "bg-gray-500 dark:bg-gray-400"
}

// ARIA labels for accessibility
const STATUS_LABELS: Record<UserStatus, string> = {
  online: "User is online",
  idle: "User is idle",
  offline: "User is offline"
}

interface PresenceIndicatorProps {
  user: UserPresence
  size?: "sm" | "md" | "lg"
  className?: string
}

/**
 * Gets the appropriate status color class with dark mode support
 * @param status - User's current status
 * @returns Tailwind CSS class for status color
 */
const getStatusColor = (status: UserStatus): string => {
  return STATUS_COLORS[status] || STATUS_COLORS.offline
}

/**
 * A component that displays user presence information with accessibility support
 * Implements real-time collaboration presence indicators from technical specifications
 */
export const PresenceIndicator: React.FC<PresenceIndicatorProps> = React.memo(({ 
  user,
  size = "md",
  className
}) => {
  // Validate user status
  const status = Object.values(UserStatus).includes(user.status) 
    ? user.status 
    : UserStatus.OFFLINE

  return (
    <div 
      className={cn(
        "relative inline-flex items-center",
        className
      )}
      role="status"
      aria-label={`${user.name} - ${STATUS_LABELS[status]}`}
    >
      {/* User avatar */}
      <Avatar
        size={size}
        alt={user.name}
        fallback={user.name}
      />

      {/* Status indicator dot */}
      <span
        className={cn(
          "absolute block rounded-full ring-2 ring-white dark:ring-gray-900",
          getStatusColor(status),
          {
            "h-2.5 w-2.5 -right-0.5 -bottom-0.5": size === "sm",
            "h-3 w-3 -right-1 -bottom-1": size === "md",
            "h-3.5 w-3.5 -right-1 -bottom-1": size === "lg"
          }
        )}
        aria-hidden="true"
      />

      {/* Loading state animation */}
      {status === UserStatus.ONLINE && (
        <span
          className={cn(
            "absolute block rounded-full opacity-75 animate-ping",
            getStatusColor(status),
            {
              "h-2.5 w-2.5 -right-0.5 -bottom-0.5": size === "sm",
              "h-3 w-3 -right-1 -bottom-1": size === "md",
              "h-3.5 w-3.5 -right-1 -bottom-1": size === "lg"
            }
          )}
          aria-hidden="true"
        />
      )}
    </div>
  )
})

PresenceIndicator.displayName = "PresenceIndicator"