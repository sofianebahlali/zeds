"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "rounded-2xl font-semibold",
    "transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950",
    "disabled:pointer-events-none disabled:opacity-50",
    "select-none",
    // Mobile-first: Minimum touch target
    "min-h-[48px] min-w-[48px]",
    "px-6 py-3",
    "text-base",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-gradient-to-r from-brand-500 to-brand-600",
          "text-white",
          "shadow-lg shadow-brand-500/25",
          "hover:shadow-xl hover:shadow-brand-500/30",
          "hover:from-brand-400 hover:to-brand-500",
          "active:scale-[0.98]",
        ],
        secondary: [
          "bg-surface-800",
          "text-white",
          "border border-surface-700",
          "hover:bg-surface-700",
          "hover:border-surface-600",
          "active:scale-[0.98]",
        ],
        accent: [
          "bg-gradient-to-r from-accent-500 to-accent-600",
          "text-white",
          "shadow-lg shadow-accent-500/25",
          "hover:shadow-xl hover:shadow-accent-500/30",
          "hover:from-accent-400 hover:to-accent-500",
          "active:scale-[0.98]",
        ],
        success: [
          "bg-gradient-to-r from-success-500 to-success-600",
          "text-white",
          "shadow-lg shadow-success-500/25",
          "hover:shadow-xl hover:shadow-success-500/30",
          "active:scale-[0.98]",
        ],
        danger: [
          "bg-gradient-to-r from-danger-500 to-danger-600",
          "text-white",
          "shadow-lg shadow-danger-500/25",
          "hover:shadow-xl hover:shadow-danger-500/30",
          "active:scale-[0.98]",
        ],
        ghost: [
          "bg-transparent",
          "text-surface-300",
          "hover:bg-surface-800",
          "hover:text-white",
          "active:scale-[0.98]",
        ],
        outline: [
          "bg-transparent",
          "text-brand-400",
          "border-2 border-brand-500",
          "hover:bg-brand-500/10",
          "active:scale-[0.98]",
        ],
        glass: [
          "bg-white/5 backdrop-blur-xl",
          "text-white",
          "border border-white/10",
          "hover:bg-white/10",
          "hover:border-white/20",
          "active:scale-[0.98]",
        ],
      },
      size: {
        sm: "h-10 min-h-[40px] px-4 py-2 text-sm rounded-xl",
        md: "h-12 min-h-[48px] px-6 py-3 text-base rounded-2xl",
        lg: "h-14 min-h-[56px] px-8 py-4 text-lg rounded-2xl",
        xl: "h-16 min-h-[64px] px-10 py-5 text-xl rounded-3xl",
        icon: "h-12 w-12 min-h-[48px] min-w-[48px] p-0 rounded-xl",
        "icon-sm": "h-10 w-10 min-h-[40px] min-w-[40px] p-0 rounded-lg",
        "icon-lg": "h-14 w-14 min-h-[56px] min-w-[56px] p-0 rounded-2xl",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "children">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, fullWidth, className }))}
          ref={ref as React.Ref<HTMLElement>}
          {...(props as React.HTMLAttributes<HTMLElement>)}
        >
          {children}
        </Slot>
      );
    }

    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        whileTap={{ scale: 0.98 }}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.1 }}
        {...props}
      >
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </motion.button>
    );
  }
);

Button.displayName = "Button";

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export { Button, buttonVariants };
