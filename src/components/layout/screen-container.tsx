"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScreenContainerProps {
  children: React.ReactNode;
  className?: string;
  centered?: boolean;
  padded?: boolean;
}

export function ScreenContainer({
  children,
  className,
  centered = true,
  padded = true,
}: ScreenContainerProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "min-h-screen-safe w-full",
        "flex flex-col",
        centered && "items-center justify-center",
        padded && "px-5 py-6 safe-area",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backAction?: () => void;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  backAction,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("text-center mb-8", className)}>
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl sm:text-4xl font-display font-bold text-surface-100"
      >
        {title}
      </motion.h1>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-surface-400 mt-2 text-base"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
