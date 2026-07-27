import { describe, it, expect, vi, afterEach } from "vitest";
import { saveSessionRoom, loadSessionRoom, clearSessionRoom } from "../../src/lib/session";

const KEY = "quizz-arena-session";

describe("session room persistence", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("remembers the room across a reload", () => {
    saveSessionRoom("AB12");
    expect(loadSessionRoom()).toBe("AB12");
  });

  it("returns null when nothing was stored", () => {
    expect(loadSessionRoom()).toBeNull();
  });

  it("forgets the room on demand", () => {
    saveSessionRoom("AB12");
    clearSessionRoom();
    expect(loadSessionRoom()).toBeNull();
  });

  it("overwrites the previous room rather than stacking", () => {
    saveSessionRoom("AB12");
    saveSessionRoom("CD34");
    expect(loadSessionRoom()).toBe("CD34");
  });

  it("expires a stale room instead of walking into a game that is long gone", () => {
    vi.useFakeTimers();
    saveSessionRoom("AB12");

    vi.advanceTimersByTime(19 * 60 * 1000);
    expect(loadSessionRoom()).toBe("AB12");

    vi.advanceTimersByTime(2 * 60 * 1000); // past the 20-minute TTL
    expect(loadSessionRoom()).toBeNull();
    // …and cleans up after itself.
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("discards a corrupt entry", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(loadSessionRoom()).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("discards an entry with the wrong shape", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ roomCode: 42 }));
    expect(loadSessionRoom()).toBeNull();

    window.localStorage.setItem(KEY, JSON.stringify({ roomCode: "AB12" })); // no savedAt
    expect(loadSessionRoom()).toBeNull();
  });

  it("survives a storage that refuses to write (private mode)", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => saveSessionRoom("AB12")).not.toThrow();
    setItem.mockRestore();
  });

  it("survives a storage that refuses to read", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(loadSessionRoom()).toBeNull();
    getItem.mockRestore();
  });
});
