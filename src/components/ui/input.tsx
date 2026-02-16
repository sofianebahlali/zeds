"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: "default" | "ghost" | "glass";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      variant = "default",
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full space-y-2">
        {label && (
          <label className="block text-sm font-medium text-surface-300">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              "flex w-full rounded-xl",
              "border border-surface-700 bg-surface-800",
              "transition-colors duration-150",
              "text-surface-100 placeholder:text-surface-500",
              "focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30",
              "h-14 min-h-[56px]",
              "px-4 py-4",
              "text-base",
              leftIcon && "pl-12",
              rightIcon && "pr-12",
              error && "border-danger-500 focus:border-danger-500 focus:ring-danger-500/30",
              disabled && "opacity-40 cursor-not-allowed",
              className
            )}
            ref={ref}
            disabled={disabled}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-500">
              {rightIcon}
            </div>
          )}
        </div>
        {(error || hint) && (
          <p
            className={cn(
              "text-sm",
              error ? "text-danger-400" : "text-surface-500"
            )}
          >
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
