/**
 * src/lib/env.ts
 *
 * Validates all required environment variables at module load time.
 * Import this file from server-only code to get a strongly-typed env object.
 * Enforced at build time: will error if imported from a client component.
 */

import "server-only";

const REQUIRED_VARS = [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_SECRET",
    "OPENAI_API_KEY",
    "APP_URL",
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

type Env = Record<RequiredVar, string>;

function buildEnv(): Env {
    return {
        TELEGRAM_BOT_TOKEN: assertEnv("TELEGRAM_BOT_TOKEN"),
        TELEGRAM_SECRET: assertEnv("TELEGRAM_SECRET"),
        OPENAI_API_KEY: assertEnv("OPENAI_API_KEY"),
        APP_URL: assertEnv("APP_URL"),
    };
}

// Validated at module load time — will throw before the server accepts requests
// if any variable is absent.
export const env: Env = buildEnv();
