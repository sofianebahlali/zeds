import { create } from "zustand";
import type { ChatMessage, AnswerReaction } from "@/types";

interface ChatState {
  messages: ChatMessage[];
  reactions: AnswerReaction[];
  isOpen: boolean;
  unreadCount: number;
  addMessage: (message: ChatMessage) => void;
  addReaction: (reaction: AnswerReaction) => void;
  setOpen: (isOpen: boolean) => void;
  clearUnread: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  reactions: [],
  isOpen: false,
  unreadCount: 0,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages.slice(-99), message],
      unreadCount: state.isOpen ? 0 : state.unreadCount + 1,
    })),

  addReaction: (reaction) =>
    set((state) => ({
      reactions: [...state.reactions.slice(-49), reaction],
    })),

  setOpen: (isOpen) =>
    set({ isOpen, unreadCount: isOpen ? 0 : get().unreadCount }),

  clearUnread: () => set({ unreadCount: 0 }),

  reset: () => set({ messages: [], reactions: [], isOpen: false, unreadCount: 0 }),
}));
