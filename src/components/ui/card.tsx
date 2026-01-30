"use client";

import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLMotionProps<"div"> {
  variant?: "default" | "glass" | "elevated" | "interactive" | "gradient";
  padding?: "none" | "sm" | "md" | "lg";
  gradient?: string;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = "default",
      padding = "md",
      gradient,
      children,
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      default: "bg-surface-900 border border-surface-800",
      glass: "bg-white/5 backdrop-blur-xl border border-white/10",
      elevated: "bg-surface-900 border border-surface-800 shadow-card",
      interactive:
        "bg-surface-900 border border-surface-800 hover:border-surface-700 hover:shadow-card-hover transition-all duration-200 cursor-pointer",
      gradient: gradient
        ? `bg-gradient-to-br ${gradient} border-0`
        : "bg-gradient-to-br from-brand-500/20 to-accent-500/20 border border-white/10",
    };

    const paddingStyles = {
      none: "",
      sm: "p-4",
      md: "p-5 sm:p-6",
      lg: "p-6 sm:p-8",
    };

    const isInteractive = variant === "interactive";

    return (
      <motion.div
        ref={ref}
        className={cn(
          "rounded-2xl",
          variantStyles[variant],
          paddingStyles[padding],
          className
        )}
        whileHover={isInteractive ? { scale: 1.02, y: -2 } : undefined}
        whileTap={isInteractive ? { scale: 0.98 } : undefined}
        transition={{ duration: 0.2 }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-bold leading-none tracking-tight text-white",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-surface-400", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
