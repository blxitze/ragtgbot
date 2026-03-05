/**
 * src/lib/env.server.ts
 *
 * Node-safe environment validation.
 * Safe to import from both Next.js server code and standalone Node scripts (worker, CLI).
 * Does NOT import "server-only".
 *
 * Uses lazy initialization so standalone scripts can call loadEnvConfig()
 * before the first property access.
 */

const REQUIRED_VARS = [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_SECRET",
    "OPENAI_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
] as const;

type RequiredVar = (typeof REQUIRED_VARS)[number];

function assertEnv(name: RequiredVar): string {
    const value = process.env[name];
    if (!value || value.trim() === "") {
        throw new Error(
            `[env] Missing required environment variable: "${name}". ` +
            `Ensure it is set in your .env file or deployment environment.`
        );
    }
    return value;
}

type Env = Record<RequiredVar, string> & { APP_URL?: string };

let _cached: Env | null = null;

function getEnv(): Env {
    if (!_cached) {
        _cached = {
            TELEGRAM_BOT_TOKEN: assertEnv("TELEGRAM_BOT_TOKEN"),
            TELEGRAM_SECRET: assertEnv("TELEGRAM_SECRET"),
            OPENAI_API_KEY: assertEnv("OPENAI_API_KEY"),
            APP_URL: process.env.APP_URL,
            SUPABASE_URL: assertEnv("SUPABASE_URL"),
            SUPABASE_SERVICE_ROLE_KEY: assertEnv("SUPABASE_SERVICE_ROLE_KEY"),
        };
    }
    return _cached;
}

/**
 * Lazily validated env object. The first property access triggers validation.
 * This allows standalone scripts to call `loadEnvConfig()` before importing
 * modules that depend on env vars.
 */
export const env: Env = new Proxy({} as Env, {
    get(_, prop: string) {
        return getEnv()[prop as keyof Env];
    },
});
