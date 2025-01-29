"use client";

import * as React from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { WorkspaceSettings } from "../../types/workspace.types";

// Validation schema for workspace creation
const workspaceSchema = z.object({
  name: z.string()
    .min(1, "Workspace name is required")
    .max(100, "Workspace name cannot exceed 100 characters"),
  settings: z.object({
    defaultRole: z.enum(["VIEWER", "EDITOR", "ADMIN", "OWNER"]),
    allowPublicSharing: z.boolean(),
    enableVersionHistory: z.boolean(),
    requireMfa: z.boolean(),
    maxProjects: z.number().min(1).max(100),
    dataRetentionDays: z.number().min(1)
  })
});

// Props interface for the dialog component
interface CreateWorkspaceDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onWorkspaceCreated?: () => void;
  onError?: (error: Error) => void;
}

// Default workspace settings following security best practices
const defaultWorkspaceSettings: WorkspaceSettings = {
  defaultRole: "VIEWER",
  allowPublicSharing: false,
  enableVersionHistory: true,
  requireMfa: true,
  maxProjects: 10,
  dataRetentionDays: 90
};

export const CreateWorkspaceDialog: React.FC<CreateWorkspaceDialogProps> = ({
  isOpen,
  onOpenChange,
  onWorkspaceCreated,
  onError
}) => {
  // State management
  const [name, setName] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { createWorkspace } = useWorkspace();

  // Input ref for focus management
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  // Reset form state when dialog opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setName("");
      setError(null);
      // Focus name input when dialog opens
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Validate input data
      const validatedData = workspaceSchema.parse({
        name,
        settings: defaultWorkspaceSettings
      });

      // Create workspace with validated data
      await createWorkspace({
        name: validatedData.name,
        settings: validatedData.settings,
        securityLevel: "INTERNAL" // Default security classification
      });

      // Reset and close dialog
      setName("");
      onOpenChange(false);
      onWorkspaceCreated?.();

    } catch (err) {
      // Handle validation and API errors
      const errorMessage = err instanceof z.ZodError
        ? err.errors[0]?.message
        : err instanceof Error
          ? err.message
          : "Failed to create workspace";
      
      setError(errorMessage);
      onError?.(err as Error);
      
      // Refocus input on error
      nameInputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-4">
            <h2 className="text-lg font-semibold">Create New Workspace</h2>
            <p className="text-sm text-muted-foreground">
              Enter a name for your new workspace. The workspace will be created with secure default settings.
            </p>
          </DialogHeader>

          <div className="my-6 space-y-4">
            <div className="space-y-2">
              <Input
                ref={nameInputRef}
                id="workspace-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter workspace name"
                disabled={isLoading}
                aria-label="Workspace name"
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "workspace-name-error" : undefined}
                className="w-full"
                maxLength={100}
                required
              />
              {error && (
                <p 
                  id="workspace-name-error" 
                  className="text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isLoading}
              isLoading={isLoading}
            >
              Create Workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};