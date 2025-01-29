"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

// Input component props interface extending HTML input attributes
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  className?: string;
  floating?: boolean;
  helperText?: string;
}

// Base input classes following shadcn/ui design system
const baseInputClasses = 
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background " +
  "file:border-0 file:bg-transparent file:text-sm file:font-medium " +
  "placeholder:text-muted-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "transition-colors duration-200";

// Error state classes
const errorClasses = "border-destructive focus-visible:ring-destructive";

// Floating label classes
const floatingLabelClasses = 
  "absolute left-3 -top-2.5 bg-background px-1 text-sm transition-all " +
  "peer-placeholder-shown:top-2.5 peer-focus:-top-2.5 " +
  "peer-disabled:cursor-not-allowed peer-disabled:opacity-50";

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, floating, helperText, ...props }, ref) => {
    // Generate unique ID for input-label association
    const id = React.useId();

    // Combine classes based on state
    const inputClasses = cn(
      baseInputClasses,
      error && errorClasses,
      floating && "peer",
      className
    );

    return (
      <div className="relative w-full">
        {/* Floating label container */}
        {floating && label && (
          <div className="relative">
            <label
              htmlFor={id}
              className={cn(
                floatingLabelClasses,
                error && "text-destructive"
              )}
            >
              {label}
            </label>
          </div>
        )}

        {/* Non-floating label */}
        {!floating && label && (
          <label
            htmlFor={id}
            className={cn(
              "mb-2 block text-sm font-medium",
              error && "text-destructive"
            )}
          >
            {label}
          </label>
        )}

        {/* Input element */}
        <input
          id={id}
          type={type}
          className={inputClasses}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={
            error ? `${id}-error` : helperText ? `${id}-helper` : undefined
          }
          ref={ref}
          {...props}
        />

        {/* Error message */}
        {error && (
          <p
            id={`${id}-error`}
            className="mt-1 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Helper text */}
        {helperText && !error && (
          <p
            id={`${id}-helper`}
            className="mt-1 text-sm text-muted-foreground"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

// Set display name for React DevTools
Input.displayName = "Input";

export { Input };