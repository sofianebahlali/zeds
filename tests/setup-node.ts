import { vi, beforeAll, afterAll } from "vitest";

/**
 * The room manager and socket handlers narrate every join, disconnect and
 * cleanup. Useful in production, deafening across a few hundred tests — so
 * they are muted, while warnings and errors still come through.
 */
let restore: (() => void) | null = null;

beforeAll(() => {
  const original = console.log;
  console.log = vi.fn();
  restore = () => {
    console.log = original;
  };
});

afterAll(() => {
  restore?.();
});
