/**
 * src/lib/supabase/serverClient.node.ts
 *
 * Node-safe Supabase client.
 * Safe to import from both Next.js server code and standalone Node scripts.
 * Does NOT import "server-only".
 *
 * Uses lazy initialization so standalone scripts can call loadEnvConfig()
 * before the first database access.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env.server';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
    if (!_client) {
        _client = createClient(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            }
        );
    }
    return _client;
}

/**
 * Lazily initialized Supabase admin client.
 * First property access triggers creation with validated env vars.
 */
export const supabase = new Proxy({} as SupabaseClient, {
    get(_, prop: string) {
        const client = getClient();
        const value = client[prop as keyof SupabaseClient];
        if (typeof value === 'function') {
            return value.bind(client);
        }
        return value;
    },
});
