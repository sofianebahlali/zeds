import { describe, it, expect, vi, afterEach } from "vitest";
import {
  cn,
  generateRoomCode,
  generatePlayerId,
  formatTime,
  debounce,
  createClickGuard,
  getOrdinalSuffix,
  shuffleArray,
  clamp,
  sleep,
  isMobile,
  vibrate,
} from "../../src/lib/utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("lets the later Tailwind class win", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });
});

describe("generateRoomCode", () => {
  it("produces 4 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(4);
      // No I/O/0/1 — codes get read out loud.
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    }
  });

  it("does not return the same code every time", () => {
    const codes = new Set(Array.from({ length: 100 }, generateRoomCode));
    expect(codes.size).toBeGreaterThan(50);
  });
});

describe("generatePlayerId", () => {
  it("is unique across many calls", () => {
    const ids = new Set(Array.from({ length: 1000 }, generatePlayerId));
    expect(ids.size).toBe(1000);
  });

  it("is not empty", () => {
    expect(generatePlayerId().length).toBeGreaterThan(0);
  });
});

describe("formatTime", () => {
  it("always reads as m:ss, zero-padded", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(45)).toBe("0:45");
  });

  it("rolls over into minutes", () => {
    expect(formatTime(60)).toBe("1:00");
    expect(formatTime(90)).toBe("1:30");
    expect(formatTime(605)).toBe("10:05");
  });
});

describe("getOrdinalSuffix", () => {
  it("uses 1er for first and Nème after", () => {
    expect(getOrdinalSuffix(1)).toBe("1er");
    expect(getOrdinalSuffix(2)).toBe("2ème");
    expect(getOrdinalSuffix(11)).toBe("11ème");
  });
});

describe("clamp", () => {
  it("keeps a value inside its bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
    expect(clamp(0, 0, 0)).toBe(0);
  });
});

describe("shuffleArray", () => {
  it("returns a new array with the same members", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffleArray(input);

    expect(out).not.toBe(input);
    expect(input).toEqual([1, 2, 3, 4, 5]); // untouched
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("actually changes the order sometimes", () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const orders = new Set(
      Array.from({ length: 20 }, () => shuffleArray(input).join(","))
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("handles the empty and single-element cases", () => {
    expect(shuffleArray([])).toEqual([]);
    expect(shuffleArray(["only"])).toEqual(["only"]);
  });
});

describe("debounce", () => {
  afterEach(() => vi.useRealTimers());

  it("only runs once for a burst of calls", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("passes the latest arguments through", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("premier");
    debounced("dernier");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith("dernier");
  });
});

describe("createClickGuard", () => {
  afterEach(() => vi.useRealTimers());

  it("swallows a double tap inside the cooldown", () => {
    vi.useFakeTimers();
    const guard = createClickGuard(500);

    expect(guard()).toBe(true);
    expect(guard()).toBe(false);

    vi.advanceTimersByTime(500);
    expect(guard()).toBe(true);
  });
});

describe("sleep", () => {
  afterEach(() => vi.useRealTimers());

  it("resolves after the delay", async () => {
    vi.useFakeTimers();
    const done = vi.fn();
    sleep(100).then(done);

    await vi.advanceTimersByTimeAsync(99);
    expect(done).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalled();
  });
});

describe("device helpers", () => {
  it("reads mobile-ness off the user agent", () => {
    expect(typeof isMobile()).toBe("boolean");
  });

  it("vibrates when the device can, and stays quiet when it cannot", () => {
    const vibrateSpy = vi.fn();
    Object.defineProperty(window.navigator, "vibrate", {
      value: vibrateSpy,
      configurable: true,
    });

    vibrate(50);
    expect(vibrateSpy).toHaveBeenCalledWith(50);

    // No vibrate API at all must not throw.
    Object.defineProperty(window.navigator, "vibrate", {
      value: undefined,
      configurable: true,
    });
    expect(() => vibrate(50)).not.toThrow();
  });
});
