# Architecture Overview

## High-Level Flow

User → Telegram → Webhook → Job Queue → Worker → Supabase → Telegram

---

## Detailed Flow

### 1. User Interaction

User sends a YouTube link to the Telegram bot.

---

### 2. Telegram Webhook

Telegram sends a POST request to:

/api/telegram/webhook

The webhook:

* Validates secret header
* Extracts chat_id and message
* Detects YouTube link
* Creates a processing job in Supabase
* Immediately responds 200 OK
* Sends "Processing..." message to user

Important:
Webhook must return quickly (< 3 seconds).

---

### 3. Job Queue (Supabase table: jobs)

When a YouTube link is received:

* Insert job with status = "pending"
* Store youtube_id and chat_id

Schema example:

jobs:

* id (uuid)
* youtube_id (text)
* chat_id (bigint)
* status ("pending" | "processing" | "completed" | "failed")
* error_message (nullable)
* created_at

---

### 4. Worker Process

A background worker:

* Polls Supabase for pending jobs
* Sets job to "processing"
* Fetches transcript
* Generates notes + quiz via LLM
* Saves results
* Sends final message to Telegram
* Sets job to "completed"

---

### 5. Supabase Storage

Tables:

* videos
* transcripts
* notes
* quizzes
* jobs

Future:

* transcript_chunks (with pgvector embeddings)
* similarity search (RAG)

---

## Future Enhancements

* Embeddings + pgvector
* Retrieval-Augmented Generation (RAG)
* Rate limiting
* Stripe subscription
* Caching repeated YouTube links
* Inline Telegram buttons
* Message chunking for long responses

---

## Security Considerations

* Validate Telegram secret header
* Never log tokens
* Never expose service role key
* Limit transcript size
* Sanitize user input

---

## Deployment Model

* Next.js on Vercel
* Supabase Postgres
* Ngrok for local development
* Server-only environment variables
