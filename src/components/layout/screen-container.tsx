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
        padded && "px-4 py-6 safe-area",
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
      {backAction && (
        <button
          onClick={backAction}
          className="absolute left-4 top-4 p-2 text-surface-400 hover:text-white transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
        </button>
      )}
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl sm:text-4xl font-bold text-white"
      >
        {title}
      </motion.h1>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-surface-400 mt-2 text-base sm:text-lg"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
