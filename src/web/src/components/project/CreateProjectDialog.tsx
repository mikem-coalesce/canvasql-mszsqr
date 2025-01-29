"use client"

import * as React from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ErrorBoundary } from "react-error-boundary"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "../ui/dialog"
import { Button } from "../ui/button"
import useProject from "../../hooks/useProject"
import { useToast } from "../../hooks/useToast"
import { SQLDialect } from "../../types/sql.types"
import { SecurityLevel } from "../../types/project.types"

// Form validation schema with comprehensive rules
const projectFormSchema = z.object({
  name: z.string()
    .min(1, "Project name is required")
    .max(100, "Project name cannot exceed 100 characters")
    .regex(/^[a-zA-Z0-9-_ ]+$/, "Only alphanumeric characters, spaces, hyphens and underscores allowed"),
  description: z.string()
    .max(500, "Description cannot exceed 500 characters")
    .optional(),
  sqlDialect: z.enum([SQLDialect.POSTGRESQL, SQLDialect.SNOWFLAKE], {
    required_error: "SQL dialect is required"
  }),
  securityLevel: z.nativeEnum(SecurityLevel, {
    required_error: "Security level is required"
  }),
  metadata: z.record(z.unknown()).default({})
})

type ProjectFormData = z.infer<typeof projectFormSchema>

interface CreateProjectDialogProps {
  workspaceId: string
  onSuccess?: (projectId: string) => void
  onError?: (error: Error) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export const CreateProjectDialog: React.FC<CreateProjectDialogProps> = React.memo(({
  workspaceId,
  onSuccess,
  onError,
  open,
  onOpenChange
}) => {
  const { createProject, isLoading } = useProject({ 
    workspaceId,
    securityConfig: {
      level: SecurityLevel.INTERNAL,
      encryption: true,
      auditEnabled: true
    }
  })
  const toast = useToast()

  // Initialize form with validation
  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      sqlDialect: SQLDialect.POSTGRESQL,
      securityLevel: SecurityLevel.INTERNAL,
      metadata: {}
    }
  })

  // Form submission handler with error handling
  const handleSubmit = React.useCallback(async (data: ProjectFormData) => {
    try {
      const project = await createProject({
        ...data,
        workspaceId,
        metadata: {
          ...data.metadata,
          createdAt: new Date().toISOString(),
          sqlDialect: data.sqlDialect
        }
      })

      toast.showSuccess("Project created successfully")
      onSuccess?.(project.id)
      form.reset()
      onOpenChange?.(false)
    } catch (error) {
      console.error("Project creation failed:", error)
      toast.showError("Failed to create project", error.message)
      onError?.(error)
    }
  }, [workspaceId, createProject, onSuccess, onError, onOpenChange])

  // Error fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }) => (
    <div className="p-4 text-red-500" role="alert">
      <p>Something went wrong:</p>
      <pre className="mt-2 text-sm">{error.message}</pre>
      <Button 
        variant="outline" 
        onClick={resetErrorBoundary}
        className="mt-4"
      >
        Try again
      </Button>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px]"
        aria-labelledby="create-project-title"
        aria-describedby="create-project-description"
      >
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <DialogHeader>
            <h2 
              id="create-project-title"
              className="text-lg font-semibold leading-none tracking-tight"
            >
              Create New Project
            </h2>
            <p
              id="create-project-description"
              className="text-sm text-muted-foreground"
            >
              Create a new project in your workspace
            </p>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Project Name
                </label>
                <input
                  id="name"
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Enter project name"
                  {...form.register("name")}
                  aria-invalid={!!form.formState.errors.name}
                  aria-describedby="name-error"
                />
                {form.formState.errors.name && (
                  <p id="name-error" className="text-sm text-red-500 mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Enter project description"
                  {...form.register("description")}
                  aria-invalid={!!form.formState.errors.description}
                  aria-describedby="description-error"
                />
                {form.formState.errors.description && (
                  <p id="description-error" className="text-sm text-red-500 mt-1">
                    {form.formState.errors.description.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="sqlDialect"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  SQL Dialect
                </label>
                <select
                  id="sqlDialect"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...form.register("sqlDialect")}
                  aria-invalid={!!form.formState.errors.sqlDialect}
                  aria-describedby="sqlDialect-error"
                >
                  <option value={SQLDialect.POSTGRESQL}>PostgreSQL</option>
                  <option value={SQLDialect.SNOWFLAKE}>Snowflake</option>
                </select>
                {form.formState.errors.sqlDialect && (
                  <p id="sqlDialect-error" className="text-sm text-red-500 mt-1">
                    {form.formState.errors.sqlDialect.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="securityLevel"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Security Level
                </label>
                <select
                  id="securityLevel"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...form.register("securityLevel")}
                  aria-invalid={!!form.formState.errors.securityLevel}
                  aria-describedby="securityLevel-error"
                >
                  <option value={SecurityLevel.PUBLIC}>Public</option>
                  <option value={SecurityLevel.INTERNAL}>Internal</option>
                  <option value={SecurityLevel.SENSITIVE}>Sensitive</option>
                  <option value={SecurityLevel.CRITICAL}>Critical</option>
                </select>
                {form.formState.errors.securityLevel && (
                  <p id="securityLevel-error" className="text-sm text-red-500 mt-1">
                    {form.formState.errors.securityLevel.message}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange?.(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!form.formState.isValid || isLoading}
                isLoading={isLoading}
              >
                Create Project
              </Button>
            </DialogFooter>
          </form>
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  )
})

CreateProjectDialog.displayName = "CreateProjectDialog"

export default CreateProjectDialog