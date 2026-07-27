"use client";

/**
 * The room the player is currently in, remembered across page loads.
 *
 * The room store lives in memory only, so a reload — or an iOS webview the OS
 * decided to kill — used to drop the player straight back on the home screen
 * with no way back into a game that is still running. Persisting just the room
 * code is enough: the player id already survives in localStorage, and the two
 * together let the socket handshake re-attach us server-side.
 *
 * Kept short-lived on purpose. The server reaps a room once it has been
 * abandoned for 15 minutes, so a code older than that can only produce a
 * "cette partie n'existe plus".
 */
const STORAGE_KEY = "quizz-arena-session";
const SESSION_TTL_MS = 20 * 60 * 1000;

interface StoredSession {
  roomCode: string;
  savedAt: number;
}

export function saveSessionRoom(roomCode: string): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredSession = { roomCode, savedAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private mode / storage full — losing the resume hint is not fatal.
  }
}

export function clearSessionRoom(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function loadSessionRoom(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed?.roomCode !== "string" || typeof parsed?.savedAt !== "number") {
      clearSessionRoom();
      return null;
    }
    if (Date.now() - parsed.savedAt > SESSION_TTL_MS) {
      clearSessionRoom();
      return null;
    }
    return parsed.roomCode;
  } catch {
    clearSessionRoom();
    return null;
  }
}
