"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  variant?: "default" | "brand" | "accent" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  animated?: boolean;
}

const variantStyles = {
  default: "bg-surface-500",
  brand: "bg-gradient-to-r from-brand-500 to-brand-400",
  accent: "bg-gradient-to-r from-accent-500 to-accent-400",
  success: "bg-gradient-to-r from-success-500 to-success-400",
  warning: "bg-gradient-to-r from-warning-500 to-warning-400",
  danger: "bg-gradient-to-r from-danger-500 to-danger-400",
};

const sizeStyles = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
};

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(
  (
    {
      className,
      value = 0,
      variant = "brand",
      size = "md",
      showValue = false,
      animated = true,
      ...props
    },
    ref
  ) => (
    <div className="w-full">
      {showValue && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm text-surface-400">Progression</span>
          <span className="text-sm font-medium text-white">{Math.round(value || 0)}%</span>
        </div>
      )}
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-surface-800",
          sizeStyles[size],
          className
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator asChild>
          <motion.div
            className={cn(
              "h-full rounded-full",
              variantStyles[variant],
              animated && "transition-all duration-300 ease-out"
            )}
            initial={animated ? { width: 0 } : false}
            animate={{ width: `${value}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </ProgressPrimitive.Indicator>
      </ProgressPrimitive.Root>
    </div>
  )
);

Progress.displayName = "Progress";

// Timer progress bar for game rounds
interface TimerProgressProps {
  timeRemaining: number;
  totalTime: number;
  className?: string;
  showTime?: boolean;
}

const TimerProgress = ({
  timeRemaining,
  totalTime,
  className,
  showTime = true,
}: TimerProgressProps) => {
  const percentage = (timeRemaining / totalTime) * 100;
  const isLow = percentage <= 25;
  const isCritical = percentage <= 10;

  return (
    <div className={cn("w-full", className)}>
      {showTime && (
        <div className="flex justify-center mb-2">
          <motion.span
            className={cn(
              "text-2xl font-bold tabular-nums",
              isCritical
                ? "text-danger-400"
                : isLow
                ? "text-warning-400"
                : "text-white"
            )}
            animate={isCritical ? { scale: [1, 1.1, 1] } : undefined}
            transition={{ duration: 0.5, repeat: isCritical ? Infinity : 0 }}
          >
            {timeRemaining}s
          </motion.span>
        </div>
      )}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-800">
        <motion.div
          className={cn(
            "h-full rounded-full",
            isCritical
              ? "bg-gradient-to-r from-danger-500 to-danger-400"
              : isLow
              ? "bg-gradient-to-r from-warning-500 to-warning-400"
              : "bg-gradient-to-r from-brand-500 to-brand-400"
          )}
          initial={{ width: "100%" }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3 }}
        />
        {isCritical && (
          <motion.div
            className="absolute inset-0 bg-danger-400/30"
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </div>
    </div>
  );
};

export { Progress, TimerProgress };
