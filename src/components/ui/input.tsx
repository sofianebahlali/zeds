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
    const variantStyles = {
      default: [
        "bg-surface-900",
        "border-surface-700",
        "focus:border-brand-500",
        "focus:ring-brand-500/20",
      ],
      ghost: [
        "bg-transparent",
        "border-transparent",
        "focus:bg-surface-900",
        "focus:border-brand-500",
      ],
      glass: [
        "bg-white/5",
        "backdrop-blur-xl",
        "border-white/10",
        "focus:border-brand-500",
        "focus:ring-brand-500/20",
      ],
    };

    return (
      <div className="w-full space-y-2">
        {label && (
          <label className="block text-sm font-medium text-surface-300">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              // Base styles
              "flex w-full rounded-xl",
              "border-2 transition-all duration-200",
              "text-white placeholder:text-surface-500",
              "focus:outline-none focus:ring-4",
              // Mobile-first sizing
              "h-14 min-h-[56px]",
              "px-4 py-4",
              "text-base",
              // Variant styles
              variantStyles[variant],
              // Icon padding
              leftIcon && "pl-12",
              rightIcon && "pr-12",
              // Error state
              error && "border-danger-500 focus:border-danger-500 focus:ring-danger-500/20",
              // Disabled state
              disabled && "opacity-50 cursor-not-allowed",
              className
            )}
            ref={ref}
            disabled={disabled}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400">
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
