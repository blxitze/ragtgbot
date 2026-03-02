/**
 * vitest.config.ts
 *
 * Vitest configuration.
 * Mirrors the `@/` path alias used in tsconfig so imports resolve in tests.
 */

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
