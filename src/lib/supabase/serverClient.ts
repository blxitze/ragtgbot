import { createClient } from '@supabase/supabase-js';
import { env } from '../env';

// This file should strictly only run on the server
import 'server-only';

// Initialize the single Supabase client for all DB operations using the service_role key
export const supabase = createClient(
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
