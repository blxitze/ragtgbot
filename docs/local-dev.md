# Local Development Workflow

This guide covers how to set up and test the Telegram webhook locally using ngrok.

## Prerequisites
- Node.js and npm installed.
- Supabase local/remote database running.
- Valid `.env.local` containing `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SECRET`, and `OPENAI_API_KEY`.
- `ngrok` installed.

## Step-by-Step

### 1. Start the Next.js Dev Server
In your first terminal:
```bash
npm run dev
```
Make sure it indicates the server is running on `http://localhost:3000`.

### 2. Start ngrok
In a second terminal, expose your local port 3000 to the public internet:
```bash
ngrok http 3000
```
Wait for it to say `Online` and note the `Forwarding` HTTPS URL (e.g. `https://1234abcd.ngrok-free.app`).

### 3. Update Environment Variables
In your `.env.local` file (or `.env`), set `APP_URL` to the ngrok forwarding URL you just acquired.
```env
APP_URL=https://1234abcd.ngrok-free.app
```

### 4. Verify Local Reachability
Confirm the Next.js server is publicly reachable through ngrok by visiting the health endpoint in your browser, or using `curl`:
```bash
curl https://1234abcd.ngrok-free.app/api/health
```
You should expect an output like:
```json
{"ok":true,"name":"yt-notes-bot","time":"2026-03-04T18:00:00.000Z"}
```

### 5. Register the Webhook
In a third terminal instance, register your ngrok URL with Telegram API:
```bash
npm run webhook:set
```
**Expected Output:**
```
Setting webhook to: https://1234abcd.ngrok-free.app/api/telegram/webhook
✅ Webhook set successfully.

Fetching webhook info...
----------------------------------------
URL: https://1234abcd.ngrok-free.app/api/telegram/webhook
Has Custom Certificate: false
Pending Update Count: 0
----------------------------------------
```

### 6. Start the Worker (Job Pipeline)
Keep this terminal open alongside the Next.js instance so it can process queued videos:
```bash
npm run worker
```

### 7. Smoke Test
Send a YouTube link (e.g. `https://www.youtube.com/watch?v=dQw4w9WgXcQ`) to your bot inside the Telegram App.
1. The Telegram platform hits your ngrok URL which relays it safely to Next.js.
2. The bot responds instantly: `Queued. Generating notes and quiz…`
3. The Next.js dev server terminal logs `[webhook] { update_id: ..., chat_id: ..., hasText: true, hasYouTubeId: true, enqueueStatus: 'enqueued' }`.
4. The worker terminal picks it up: `[Worker] Claimed job ... for video ...`
5. After several seconds, the bot pushes down the finalized Notes & Quiz in Markdown.
