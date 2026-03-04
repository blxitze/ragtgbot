/**
 * src/app/api/telegram/webhook/route.ts
 *
 * Next.js App Router route handler for the Telegram webhook.
 * POST /api/telegram/webhook
 *
 * Security: validates X-Telegram-Bot-Api-Secret-Token BEFORE reading the body.
 */

import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sendTelegramMessage, sendTelegramMessageChunks } from "@/lib/telegram";
import { enqueueJob } from "@/lib/db/jobs";
import { getResultByYoutubeId } from "@/lib/db/results";
import { parseYouTubeId } from "@/lib/youtube";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TelegramMessage {
    chat: { id: number };
    text?: string;
}

interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
}

function isTelegramUpdate(value: unknown): value is TelegramUpdate {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    return typeof v["update_id"] === "number";
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
    // 1. Validate secret header BEFORE touching the body.
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    if (secretHeader !== env.TELEGRAM_SECRET) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    // 2. Parse the update.
    let update: TelegramUpdate;
    try {
        const body: unknown = await req.json();
        if (!isTelegramUpdate(body)) {
            return NextResponse.json({ ok: false, error: "Unexpected payload" }, { status: 400 });
        }
        update = body;
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    // 3. Extract fields.
    const updateId: number = update.update_id;
    const chatId: number | undefined = update.message?.chat.id;
    const text: string | undefined = update.message?.text;
    const hasText: boolean = typeof text === "string" && text.length > 0;

    let youtubeId: string | null = null;
    let enqueueStatus: string | null = null;

    if (hasText && text) {
        youtubeId = parseYouTubeId(text);
    }
    const hasYouTubeId = youtubeId !== null;

    // 4. Log ONLY allowed fields — no message content, no secrets.
    console.log("[webhook]", { update_id: updateId, chat_id: chatId, hasText, hasYouTubeId });

    // 5. Reply if text is present.
    if (chatId !== undefined) {
        if (!hasText) {
            return NextResponse.json({ ok: true });
        }

        if (!youtubeId) {
            try {
                await sendTelegramMessage({
                    chatId,
                    text: "Please send me a valid YouTube video link.",
                });
            } catch (err) {
                console.error("[webhook] Failed to send reply:", err);
            }
            return NextResponse.json({ ok: true });
        }

        try {
            const result = await enqueueJob(chatId, youtubeId);
            enqueueStatus = result.status;

            console.log("[webhook]", { update_id: updateId, chat_id: chatId, hasText, hasYouTubeId, enqueueStatus });

            if (result.status === 'already_completed') {
                const existing = await getResultByYoutubeId(youtubeId);
                if (existing) {
                    await sendTelegramMessageChunks(chatId, existing.markdown);
                } else {
                    await sendTelegramMessage({ chatId, text: "Result completed but not found. Please try again later." });
                }
            } else if (result.status === 'already_processing') {
                await sendTelegramMessage({ chatId, text: "Already processing this video. I will send the result soon." });
            } else if (result.status === 'enqueued') {
                await sendTelegramMessage({ chatId, text: "Queued. Generating notes and quiz…" });
            }
        } catch (err) {
            console.error("[webhook] Failed to process job:", err);
            try {
                await sendTelegramMessage({ chatId, text: "An error occurred while queueing the video." });
            } catch (sendErr) {
                console.error("[webhook] Failed to send error reply:", sendErr);
            }
        }
    }

    // 6. Always return 200 so Telegram doesn't retry.
    return NextResponse.json({ ok: true });
}
