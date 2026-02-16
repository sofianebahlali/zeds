"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "rounded-xl font-semibold",
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950",
    "disabled:pointer-events-none disabled:opacity-40",
    "select-none",
    "min-h-[48px] min-w-[48px]",
    "px-6 py-3",
    "text-base",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-brand-500",
          "text-white",
          "hover:bg-brand-600",
          "active:bg-brand-700",
        ],
        secondary: [
          "bg-surface-800",
          "text-surface-100",
          "border border-surface-700",
          "hover:bg-surface-700",
        ],
        accent: [
          "bg-accent-500",
          "text-white",
          "hover:bg-accent-600",
          "active:bg-accent-700",
        ],
        success: [
          "bg-success-500",
          "text-white",
          "hover:bg-success-600",
          "active:bg-success-700",
        ],
        danger: [
          "bg-danger-500",
          "text-white",
          "hover:bg-danger-600",
        ],
        ghost: [
          "bg-transparent",
          "text-surface-400",
          "hover:bg-surface-800/50",
          "hover:text-surface-100",
        ],
        outline: [
          "bg-transparent",
          "text-surface-300",
          "border-2 border-surface-700",
          "hover:border-surface-500",
          "hover:text-surface-100",
        ],
        glass: [
          "bg-surface-800/60",
          "text-surface-100",
          "border border-surface-700",
          "hover:bg-surface-700/60",
        ],
      },
      size: {
        sm: "h-10 min-h-[40px] px-4 py-2 text-sm rounded-lg",
        md: "h-12 min-h-[48px] px-6 py-3 text-base rounded-xl",
        lg: "h-14 min-h-[56px] px-8 py-4 text-lg rounded-xl",
        xl: "h-16 min-h-[64px] px-10 py-5 text-xl rounded-xl",
        icon: "h-12 w-12 min-h-[48px] min-w-[48px] p-0 rounded-xl",
        "icon-sm": "h-10 w-10 min-h-[40px] min-w-[40px] p-0 rounded-lg",
        "icon-lg": "h-14 w-14 min-h-[56px] min-w-[56px] p-0 rounded-xl",
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
        whileTap={{ scale: 0.97 }}
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
