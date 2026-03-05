/**
 * src/lib/env.next.ts
 *
 * Next.js-only env wrapper.
 * Import this from Next.js route handlers / server components to ensure
 * the env module is never accidentally imported from a client component.
 */

import "server-only";
export { env } from "./env.server";
