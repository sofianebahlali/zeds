"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  size?: "sm" | "md" | "lg" | "xl";
  status?: "online" | "offline" | "ready" | "answering" | "answered";
  emoji?: string;
}

const sizeStyles = {
  sm: "h-8 w-8 text-lg",
  md: "h-12 w-12 text-2xl",
  lg: "h-16 w-16 text-3xl",
  xl: "h-20 w-20 text-4xl",
};

const statusColors = {
  online: "bg-success-500",
  offline: "bg-surface-500",
  ready: "bg-success-500",
  answering: "bg-warning-500 animate-pulse",
  answered: "bg-brand-500",
};

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size = "md", status, emoji, children, ...props }, ref) => (
  <div className="relative inline-flex">
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full",
        "bg-gradient-to-br from-surface-800 to-surface-900",
        "border-2 border-surface-700",
        "items-center justify-center",
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {emoji ? (
        <span className="select-none">{emoji}</span>
      ) : (
        children
      )}
    </AvatarPrimitive.Root>
    {status && (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={cn(
          "absolute bottom-0 right-0",
          "rounded-full border-2 border-surface-950",
          size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5",
          statusColors[status]
        )}
      />
    )}
  </div>
));
Avatar.displayName = "Avatar";

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
));
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-surface-800",
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = "AvatarFallback";

// Avatar selector grid for choosing emoji avatars
interface AvatarSelectorProps {
  avatars: readonly string[];
  selected: string;
  onSelect: (avatar: string) => void;
  className?: string;
}

const AvatarSelector = ({
  avatars,
  selected,
  onSelect,
  className,
}: AvatarSelectorProps) => {
  return (
    <div
      className={cn(
        "grid grid-cols-6 gap-2 sm:grid-cols-8",
        className
      )}
    >
      {avatars.map((avatar) => (
        <motion.button
          key={avatar}
          type="button"
          onClick={() => onSelect(avatar)}
          className={cn(
            "flex items-center justify-center",
            "h-12 w-12 rounded-xl",
            "text-2xl",
            "transition-all duration-200",
            selected === avatar
              ? "bg-brand-500/20 border-2 border-brand-500 scale-110"
              : "bg-surface-800 border-2 border-transparent hover:border-surface-600"
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {avatar}
        </motion.button>
      ))}
    </div>
  );
};

export { Avatar, AvatarImage, AvatarFallback, AvatarSelector };
