import React, { memo, useCallback } from "react";
import { formatDistanceToNow } from "date-fns"; // v2.30.0
import { cn } from "class-variance-authority"; // v0.7.0
import { ErrorBoundary } from "react-error-boundary"; // v4.0.11

import { Avatar } from "../ui/avatar";
import { useCollaboration } from "../../hooks/useCollaboration";
import { UserPresence, UserStatus } from "../../types/collaboration.types";

// Constants for styling and accessibility
const STATUS_COLORS = {
  [UserStatus.ONLINE]: "bg-green-500",
  [UserStatus.IDLE]: "bg-yellow-500",
  [UserStatus.OFFLINE]: "bg-gray-500"
} as const;

const STATUS_LABELS = {
  [UserStatus.ONLINE]: "Online",
  [UserStatus.IDLE]: "Idle",
  [UserStatus.OFFLINE]: "Offline"
} as const;

const ARIA_LABELS = {
  USER_LIST: "Collaborators in session",
  USER_ITEM: "Collaborator",
  STATUS_INDICATOR: "Status indicator",
  LAST_ACTIVE: "Last active time"
} as const;

interface UserListProps {
  className?: string;
  isLoading?: boolean;
  onUserSelect?: (userId: string) => void;
}

// Sort users by status and name
const sortUsersByStatus = (users: UserPresence[]): UserPresence[] => {
  return [...users].sort((a, b) => {
    // First sort by status priority
    const statusPriority = {
      [UserStatus.ONLINE]: 0,
      [UserStatus.IDLE]: 1,
      [UserStatus.OFFLINE]: 2
    };
    
    if (statusPriority[a.status] !== statusPriority[b.status]) {
      return statusPriority[a.status] - statusPriority[b.status];
    }
    
    // Then sort alphabetically by name
    return a.name.localeCompare(b.name);
  });
};

// Format last active time with timezone support
const formatLastActive = (lastActive: Date): string => {
  try {
    return formatDistanceToNow(lastActive, { addSuffix: true });
  } catch (error) {
    console.error("Error formatting last active time:", error);
    return "Unknown";
  }
};

// Error fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <div className="p-4 text-sm text-red-600 bg-red-50 rounded-md">
    <p>Error loading collaborators: {error.message}</p>
  </div>
);

export const UserList: React.FC<UserListProps> = memo(({
  className,
  isLoading = false,
  onUserSelect
}) => {
  const { users } = useCollaboration();
  
  // Memoized user selection handler
  const handleUserClick = useCallback((userId: string) => {
    onUserSelect?.(userId);
  }, [onUserSelect]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-2 p-4", className)} aria-busy="true">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex items-center space-x-3 animate-pulse"
            aria-hidden="true"
          >
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const sortedUsers = sortUsersByStatus(Array.from(users.values()));

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div
        className={cn("space-y-2 p-4", className)}
        role="list"
        aria-label={ARIA_LABELS.USER_LIST}
      >
        {sortedUsers.map((user) => (
          <div
            key={user.userId}
            className={cn(
              "flex items-center space-x-3 p-2 rounded-lg",
              "hover:bg-gray-50 dark:hover:bg-gray-800",
              "transition-colors duration-200",
              "cursor-pointer"
            )}
            role="listitem"
            aria-label={ARIA_LABELS.USER_ITEM}
            onClick={() => handleUserClick(user.userId)}
          >
            <div className="relative">
              <Avatar
                size="sm"
                src={`/api/users/${user.userId}/avatar`}
                alt={user.name}
                fallback={user.name}
              />
              <span
                className={cn(
                  "absolute bottom-0 right-0",
                  "w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-gray-900",
                  STATUS_COLORS[user.status]
                )}
                role="status"
                aria-label={`${STATUS_LABELS[user.status]} ${ARIA_LABELS.STATUS_INDICATOR}`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {user.name}
              </p>
              <p 
                className="text-xs text-gray-500 dark:text-gray-400"
                aria-label={ARIA_LABELS.LAST_ACTIVE}
              >
                {formatLastActive(user.lastActive)}
              </p>
            </div>

            {user.cursorPosition && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Editing
              </div>
            )}
          </div>
        ))}

        {sortedUsers.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No other collaborators in session
          </p>
        )}
      </div>
    </ErrorBoundary>
  );
});

UserList.displayName = "UserList";

export default UserList;