import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Framer Motion animates with rAF and IntersectionObserver; jsdom has neither
// in a form the library is happy with.
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();

  // Installed unconditionally: jsdom ships a matchMedia without the legacy
  // addListener that Framer Motion reaches for on its first animated render.
  {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = "";
      thresholds = [];
    } as unknown as typeof window.IntersectionObserver;
  }

  // jsdom does not implement layout; Radix and the map both poke at it.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

afterEach(() => {
  cleanup();
});
