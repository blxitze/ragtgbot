/**
 * src/lib/env.ts
 *
 * Re-exports the Node-safe env module.
 * This file exists for backward compatibility so existing imports
 * (`from "@/lib/env"` or `from "../env"`) continue to work in both
 * Next.js and standalone Node runtimes.
 */

export { env } from "./env.server";
