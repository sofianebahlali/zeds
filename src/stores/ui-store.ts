import { create } from "zustand";
import type { Screen, Notification } from "@/types";

interface UIState {
  // Navigation
  currentScreen: Screen;

  // Loading states
  isLoading: boolean;
  loadingMessage: string | null;

  // Errors
  error: string | null;

  // Notifications
  notifications: Notification[];

  // Connection
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;

  // Actions
  setScreen: (screen: Screen) => void;
  setLoading: (isLoading: boolean, message?: string) => void;
  setError: (error: string | null) => void;
  addNotification: (notification: Omit<Notification, "id">) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  setConnected: (isConnected: boolean) => void;
  setReconnecting: (isReconnecting: boolean) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  reset: () => void;
}

let notificationId = 0;

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  currentScreen: "home",
  isLoading: false,
  loadingMessage: null,
  error: null,
  notifications: [],
  isConnected: false,
  isReconnecting: false,
  reconnectAttempts: 0,

  // Actions
  setScreen: (screen) => set({ currentScreen: screen, error: null }),

  setLoading: (isLoading, message) =>
    set({
      isLoading,
      loadingMessage: isLoading ? message || null : null,
    }),

  setError: (error) => {
    set({ error });
    if (error) {
      get().addNotification({
        type: "error",
        message: error,
        duration: 5000,
      });
    }
  },

  addNotification: (notification) => {
    const id = `notification_${++notificationId}`;
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration || 4000,
    };

    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    // Auto-remove after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, newNotification.duration);
    }
  },

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearNotifications: () => set({ notifications: [] }),

  setConnected: (isConnected) =>
    set({
      isConnected,
      isReconnecting: false,
      reconnectAttempts: isConnected ? 0 : get().reconnectAttempts,
    }),

  setReconnecting: (isReconnecting) => set({ isReconnecting }),

  incrementReconnectAttempts: () =>
    set((state) => ({
      reconnectAttempts: state.reconnectAttempts + 1,
    })),

  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),

  reset: () =>
    set({
      currentScreen: "home",
      isLoading: false,
      loadingMessage: null,
      error: null,
      notifications: [],
      isReconnecting: false,
      reconnectAttempts: 0,
    }),
}));

// Helper hooks for common patterns
export const useIsLoading = () => useUIStore((state) => state.isLoading);
export const useCurrentScreen = () => useUIStore((state) => state.currentScreen);
export const useNotifications = () => useUIStore((state) => state.notifications);
export const useConnectionStatus = () =>
  useUIStore((state) => ({
    isConnected: state.isConnected,
    isReconnecting: state.isReconnecting,
    reconnectAttempts: state.reconnectAttempts,
  }));
