"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications, useUIStore } from "@/stores";
import type { Notification } from "@/types";

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colorMap = {
  success: "bg-success-500/20 border-success-500/30 text-success-400",
  error: "bg-danger-500/20 border-danger-500/30 text-danger-400",
  info: "bg-brand-500/20 border-brand-500/30 text-brand-400",
  warning: "bg-warning-500/20 border-warning-500/30 text-warning-400",
};

function NotificationItem({ notification }: { notification: Notification }) {
  const removeNotification = useUIStore((s) => s.removeNotification);
  const Icon = iconMap[notification.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-center gap-3",
        "px-4 py-3",
        "rounded-xl",
        "border",
        "backdrop-blur-xl",
        "shadow-lg",
        colorMap[notification.type]
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <p className="text-sm font-medium flex-1">{notification.message}</p>
      <button
        onClick={() => removeNotification(notification.id)}
        className="p-1 hover:bg-white/10 rounded-lg transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

export function NotificationContainer() {
  const notifications = useNotifications();

  return (
    <div className="fixed top-4 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <div className="max-w-md mx-auto w-full space-y-2 pointer-events-auto">
        <AnimatePresence mode="popLayout">
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
