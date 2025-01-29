"use client"

import * as React from "react"
import { cn } from "../../lib/utils"
import type { AuthUser } from "../../types/auth.types"

// Size mappings for avatar and fallback text
const AVATAR_SIZES = {
  sm: "h-8 w-8",
  md: "h-10 w-10", 
  lg: "h-12 w-12"
} as const

const FALLBACK_SIZES = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base"
} as const

const LOADING_STYLES = {
  base: "animate-pulse bg-gray-200 dark:bg-gray-700",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12"
} as const

interface AvatarProps {
  size?: keyof typeof AVATAR_SIZES
  src?: string
  alt: string
  fallback?: string
  className?: string
  user?: AuthUser
  onError?: (e: Event) => void
  loading?: boolean
}

/**
 * Extracts initials from user's email or name
 * @param text - Email or name to extract initials from
 * @returns Two uppercase letters for initials
 */
const getInitials = (text: string): string => {
  if (!text) return "AA"

  // Remove special characters and extra spaces
  const cleanText = text
    .replace(/[^\w\s@]/g, "")
    .replace(/\s+/g, " ")
    .trim()

  // Handle email addresses by taking username part
  const username = text.includes("@") ? text.split("@")[0] : text

  // Split into words and get first letter of first two words
  const words = username.split(" ")
  const firstLetter = words[0] ? words[0][0] : "A"
  const secondLetter = words[1] ? words[1][0] : words[0] ? words[0][1] : "A"

  return (firstLetter + secondLetter).toUpperCase()
}

/**
 * Avatar component that displays user profile images or fallback initials
 * Follows shadcn/ui design system and ensures WCAG 2.1 Level AA compliance
 */
export const Avatar: React.FC<AvatarProps> = ({
  size = "md",
  src,
  alt,
  fallback,
  className,
  user,
  onError,
  loading = false
}) => {
  const [imgError, setImgError] = React.useState(false)

  // Handle image load errors
  const handleError = (e: Event) => {
    setImgError(true)
    onError?.(e)
  }

  // Show loading skeleton
  if (loading) {
    return (
      <div
        className={cn(
          "rounded-full",
          LOADING_STYLES.base,
          LOADING_STYLES[size],
          className
        )}
        role="presentation"
        aria-hidden="true"
      />
    )
  }

  // Show image if available and no error
  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={alt}
        onError={handleError}
        className={cn(
          "rounded-full object-cover",
          AVATAR_SIZES[size],
          className
        )}
      />
    )
  }

  // Show fallback with initials
  const initials = fallback || (user && (user.name || user.email)) 
    ? getInitials(fallback || user?.name || user?.email || "")
    : "AA"

  return (
    <div
      className={cn(
        "rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center",
        AVATAR_SIZES[size],
        className
      )}
      role="img"
      aria-label={alt}
    >
      <span
        className={cn(
          "font-medium text-gray-600 dark:text-gray-300",
          FALLBACK_SIZES[size]
        )}
      >
        {initials}
      </span>
    </div>
  )
}