"use client";

import * as React from "react";
import { Link } from "react-router-dom";
import { 
  Menu, 
  User, 
  Sun, 
  Moon, 
  Settings, 
  HelpCircle, 
  Bell, 
  ChevronDown,
  LogOut
} from "lucide-react";
import { cn } from "../../lib/utils";
import { buttonVariants } from "../ui/button";
import { Dropdown, DropdownItem, DropdownSeparator } from "../ui/dropdown";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { WorkspaceRole } from "../../types/workspace.types";

interface HeaderProps {
  className?: string;
}

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType;
}

/**
 * Main application header component providing navigation and controls
 * Implements Layout Structure and Theme Support requirements
 */
const Header = React.memo(({ className }: HeaderProps) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { currentWorkspace, workspaces } = useWorkspace();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Navigation items based on user role
  const navigationItems = React.useMemo(() => {
    const items: NavigationItem[] = [
      { label: "Projects", href: "/projects", icon: Menu },
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Help", href: "/help", icon: HelpCircle }
    ];

    // Add admin items if user has sufficient permissions
    if (user?.role === "ADMIN" || user?.role === "OWNER") {
      items.push({ label: "Admin", href: "/admin", icon: Settings });
    }

    return items;
  }, [user?.role]);

  const handleLogout = React.useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }, [logout]);

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}>
      <div className="container flex h-14 items-center justify-between px-4">
        {/* Logo and Navigation */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl">ERD Tool</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-4 lg:space-x-6">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "text-sm font-medium transition-colors hover:text-primary"
                )}
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Workspace Selector */}
        {user && (
          <Dropdown
            trigger={
              <button className={cn(
                buttonVariants({ variant: "ghost" }),
                "flex items-center gap-2"
              )}>
                {currentWorkspace?.name || "Select Workspace"}
                <ChevronDown className="h-4 w-4" />
              </button>
            }
            align="end"
          >
            <div className="min-w-[200px] p-2">
              {workspaces.map((workspace) => (
                <DropdownItem
                  key={workspace.id}
                  className="cursor-pointer"
                  onSelect={() => {
                    // Handle workspace selection
                  }}
                >
                  {workspace.name}
                </DropdownItem>
              ))}
            </div>
          </Dropdown>
        )}

        {/* User Controls */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <button
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "hover:bg-accent"
            )}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </button>

          {/* User Menu */}
          {user && (
            <Dropdown
              trigger={
                <button className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "flex items-center gap-2"
                )}>
                  <User className="h-5 w-5" />
                  <span className="hidden md:inline-block">
                    {user.email}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              }
              align="end"
            >
              <div className="min-w-[200px] p-2">
                <DropdownItem className="cursor-default">
                  <span className="font-medium">{user.email}</span>
                </DropdownItem>
                <DropdownItem className="cursor-default text-sm text-muted-foreground">
                  Role: {user.role}
                </DropdownItem>
                <DropdownSeparator />
                <DropdownItem
                  className="cursor-pointer"
                  onSelect={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownItem>
              </div>
            </Dropdown>
          )}
        </div>
      </div>
    </header>
  );
});

Header.displayName = "Header";

export default Header;