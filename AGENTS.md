# AGENTS.md — Project Rules for AI Agent

## Project Overview

Telegram bot:
User sends a YouTube link → system processes transcript → generates detailed notes + quiz → sends result back to Telegram.

Stack:

* Next.js (App Router)
* TypeScript
* Server runtime only for bot logic
* Supabase (Postgres) for storage
* Deployed on Vercel
* Local dev via ngrok

---

## Security Rules (CRITICAL)

1. Never commit `.env*` files.
2. Never log secrets (tokens, keys).
3. Never log full transcripts.
4. `SUPABASE_SERVICE_ROLE_KEY` must only be used in server code.
5. No secret usage inside client components.
6. Validate all required environment variables at server startup.
7. Webhook must validate `X-Telegram-Bot-Api-Secret-Token` header BEFORE processing body.

---

## Code Style

* Strict TypeScript
* No `any`
* Explicit return types
* Small pure functions
* Separate:

  * `/lib` for utilities
  * `/lib/server` for server-only logic
  * `/app/api` for route handlers

---

## Logging Rules

Allowed:

* update_id
* chat_id
* hasText boolean

Forbidden:

* message text
* transcript content
* tokens
* keys

---

## Development Flow

Every feature must follow:

1. Implementation
2. Security review prompt
3. Fix issues
4. Manual test

No large refactors without explanation.
