/**
 * src/lib/supabase/serverClient.next.ts
 *
 * Next.js-only Supabase client wrapper.
 * Prevents accidental import from client components.
 */

import "server-only";
export { supabase } from "./serverClient.node";
