/**
 * src/lib/supabase/serverClient.ts
 *
 * Re-exports the Node-safe Supabase client.
 * Existing imports (`from '../supabase/serverClient'`) continue to work
 * in both Next.js and standalone Node runtimes.
 */

export { supabase } from "./serverClient.node";
