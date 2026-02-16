"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center",
    "rounded-lg",
    "font-semibold",
    "transition-colors duration-150",
    "select-none",
  ],
  {
    variants: {
      variant: {
        default: "bg-surface-800 text-surface-300",
        primary: "bg-brand-500/15 text-brand-400",
        accent: "bg-accent-500/15 text-accent-400",
        success: "bg-success-500/15 text-success-400",
        warning: "bg-accent-500/15 text-accent-400",
        danger: "bg-danger-500/15 text-danger-400",
        solid: "bg-brand-500 text-white",
        "solid-accent": "bg-accent-500 text-white",
        "solid-success": "bg-success-500 text-white",
        outline: "bg-transparent text-surface-300 border border-surface-700",
      },
      size: {
        sm: "h-5 px-2 text-xs gap-1",
        md: "h-6 px-2.5 text-xs gap-1.5",
        lg: "h-7 px-3 text-sm gap-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  animate?: boolean;
  icon?: React.ReactNode;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, animate = false, icon, children, ...props }, ref) => {
    if (animate) {
      return (
        <motion.span
          ref={ref}
          className={cn(badgeVariants({ variant, size }), className)}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
        >
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
        </motion.span>
      );
    }

    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

interface StatusBadgeProps {
  status: "waiting" | "ready" | "playing" | "answered" | "correct" | "wrong";
  className?: string;
}

const statusConfig = {
  waiting: { label: "En attente", variant: "default" as const },
  ready: { label: "Prêt", variant: "success" as const },
  playing: { label: "En jeu", variant: "primary" as const },
  answered: { label: "Répondu", variant: "primary" as const },
  correct: { label: "Correct", variant: "solid-success" as const },
  wrong: { label: "Faux", variant: "danger" as const },
};

const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant}
      size="sm"
      animate
      className={className}
    >
      {status === "ready" && (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      )}
      {config.label}
    </Badge>
  );
};

export { Badge, badgeVariants, StatusBadge };
