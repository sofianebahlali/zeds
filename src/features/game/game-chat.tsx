"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, X } from "lucide-react";
import { useChatStore } from "@/stores/chat-store";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";

export function GameChat() {
  const messages = useChatStore((s) => s.messages);
  const isOpen = useChatStore((s) => s.isOpen);
  const unreadCount = useChatStore((s) => s.unreadCount);
  const setOpen = useChatStore((s) => s.setOpen);
  const { sendChatMessage, socket } = useSocket();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const myPlayerId = `player_${socket.id}`;

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [messages.length, isOpen]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendChatMessage(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat toggle button */}
      <button
        onClick={() => setOpen(!isOpen)}
        className={cn(
          "fixed bottom-20 right-4 z-30 w-12 h-12 rounded-full flex items-center justify-center",
          "bg-surface-800 border border-surface-700 shadow-lg",
          "hover:bg-surface-700 transition-colors",
          isOpen && "bg-brand-500 border-brand-400 hover:bg-brand-600"
        )}
      >
        {isOpen ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <>
            <MessageCircle className="w-5 h-5 text-surface-200" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-36 right-4 z-30 w-72 max-h-80 rounded-xl bg-surface-900 border border-surface-700 shadow-xl flex flex-col overflow-hidden"
          >
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px] max-h-[220px]">
              {messages.length === 0 && (
                <p className="text-center text-surface-500 text-xs py-4">
                  Aucun message
                </p>
              )}
              {messages.map((msg) => {
                const isMe = msg.playerId === myPlayerId;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex gap-1.5", isMe && "flex-row-reverse")}
                  >
                    <span className="text-base shrink-0">{msg.playerAvatar}</span>
                    <div
                      className={cn(
                        "px-2.5 py-1.5 rounded-xl max-w-[180px]",
                        isMe
                          ? "bg-brand-500/20 border border-brand-500/30"
                          : "bg-surface-800 border border-surface-700"
                      )}
                    >
                      {!isMe && (
                        <p className="text-[10px] text-surface-400 font-medium mb-0.5">
                          {msg.playerName}
                        </p>
                      )}
                      <p className="text-xs text-surface-100 break-words">
                        {msg.message}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-surface-700 p-2 flex gap-2">
              <button
                onClick={() => sendChatMessage("😂")}
                className="w-8 h-8 rounded-lg bg-surface-800 border border-surface-700 flex items-center justify-center hover:bg-surface-700 transition-colors shrink-0 text-base"
                title="Réaction rire"
              >
                😂
              </button>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message..."
                maxLength={200}
                className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-xs text-surface-100 placeholder-surface-500 outline-none focus:border-brand-500/50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center disabled:opacity-40 hover:bg-brand-600 transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
