import { defineConfig } from "vitest/config";
import path from "node:path";

const alias = { "@": path.resolve(__dirname, "./src") };

/**
 * Two projects, because the code under test lives in two worlds:
 *  - `node`   → the Express/Socket.IO server and the pure libs it shares
 *  - `jsdom`  → React components and the Zustand stores (localStorage, DOM)
 *
 * `esbuild.jsx: "automatic"` replaces @vitejs/plugin-react: tests need the JSX
 * transform, not fast refresh.
 */
export default defineConfig({
  resolve: { alias },
  esbuild: { jsx: "automatic" },
  test: {
    projects: [
      {
        resolve: { alias },
        esbuild: { jsx: "automatic" },
        test: {
          name: "node",
          environment: "node",
          include: ["tests/{unit,integration}/**/*.test.ts"],
          setupFiles: ["tests/setup-node.ts"],
          // Socket.IO integration tests each bind a port and drive timers;
          // running whole files in parallel keeps them isolated.
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },
      {
        resolve: { alias },
        esbuild: { jsx: "automatic" },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["tests/client/**/*.test.{ts,tsx}"],
          setupFiles: ["tests/setup-dom.ts"],
          restoreMocks: true,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["server/**/*.ts", "src/lib/**/*.ts", "src/stores/**/*.ts", "src/types/**/*.ts"],
      exclude: ["**/*.d.ts"],
    },
  },
});
