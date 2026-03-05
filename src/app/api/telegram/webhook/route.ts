/**
 * src/app/api/telegram/webhook/route.ts
 *
 * Next.js App Router route handler for the Telegram webhook.
 * POST /api/telegram/webhook
 *
 * Security: validates X-Telegram-Bot-Api-Secret-Token BEFORE reading the body.
 */

import { type NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage, sendTelegramMessageChunks, sendTelegramQuizPoll } from "@/lib/telegram";
import { enqueueJob } from "@/lib/db/jobs";
import { getResultByYoutubeId } from "@/lib/db/results";
import { parseYouTubeId } from "@/lib/youtube";
import { createQuizSession, getQuizSession, setQuizSessionIndex, mapPollToSession, getPollMapping } from "@/lib/db/quizSessions";
import type { MCQ } from "@/lib/llm/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TelegramMessage {
    chat: { id: number };
    text?: string;
}

interface TelegramCallbackQuery {
    id: string;
    from: { id: number };
    message?: TelegramMessage;
    data?: string;
}

interface TelegramPollAnswer {
    poll_id: string;
    user: { id: number };
    option_ids: number[];
}

interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
    callback_query?: TelegramCallbackQuery;
    poll_answer?: TelegramPollAnswer;
}

function isTelegramUpdate(value: unknown): value is TelegramUpdate {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    return typeof v["update_id"] === "number";
}

async function answerCallbackQuery(callbackQueryId: string) {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackQueryId }),
    }).catch(console.error);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
    const telegramSecret = process.env.TELEGRAM_SECRET;

    if (!telegramSecret) {
        console.error("[webhook] System misconfigured, TELEGRAM_SECRET is missing");
        return NextResponse.json({ ok: false }, { status: 500 });
    }

    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    if (secretHeader !== telegramSecret) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

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

    // 1. Handle callback_query (Start Quiz)
    if (update.callback_query) {
        const cb = update.callback_query;
        const chatId = cb.from.id;
        const queryData = cb.data ?? "";

        if (queryData.startsWith("quiz:start:")) {
            const youtubeId = queryData.replace("quiz:start:", "");
            console.log("[webhook] Start Quiz requested", { chat_id: chatId, youtube_id: youtubeId });

            const result = await getResultByYoutubeId(youtubeId);
            if (!result || !result.quiz_json?.mcq?.length) {
                await sendTelegramMessage({ chatId, text: "Sorry, quiz not found for this video." });
            } else {
                const sessionId = await createQuizSession(chatId, youtubeId);
                const firstMcq = result.quiz_json.mcq[0] as MCQ;

                const { pollId } = await sendTelegramQuizPoll({
                    chatId,
                    question: firstMcq.question,
                    options: firstMcq.choices,
                    correctOptionIndex: firstMcq.choices.indexOf(firstMcq.correctAnswer),
                    explanation: firstMcq.explanation
                });

                await mapPollToSession(pollId, sessionId, 0);
            }
            await answerCallbackQuery(cb.id);
        }
        return NextResponse.json({ ok: true });
    }

    // 2. Handle poll_answer (Next Question)
    if (update.poll_answer) {
        const answer = update.poll_answer;
        const mapping = await getPollMapping(answer.poll_id);

        if (mapping) {
            const session = await getQuizSession(mapping.session_id);

            // Race condition check: Only send next poll if session hasn't advanced past this question
            if (session.current_index > mapping.question_index) {
                console.log("[webhook] Skipping poll_answer; next question already sent.", { poll_id: answer.poll_id });
                return NextResponse.json({ ok: true });
            }

            const result = await getResultByYoutubeId(session.youtube_id);

            if (result && result.quiz_json?.mcq) {
                const mcqs = result.quiz_json.mcq as MCQ[];
                const nextIndex = mapping.question_index + 1;

                if (nextIndex < mcqs.length) {
                    const nextMcq = mcqs[nextIndex];
                    const { pollId } = await sendTelegramQuizPoll({
                        chatId: session.chat_id,
                        question: nextMcq.question,
                        options: nextMcq.choices,
                        correctOptionIndex: nextMcq.choices.indexOf(nextMcq.correctAnswer),
                        explanation: nextMcq.explanation
                    });

                    await setQuizSessionIndex(session.id, nextIndex);
                    await mapPollToSession(pollId, session.id, nextIndex);
                } else {
                    await sendTelegramMessage({
                        chatId: session.chat_id,
                        text: "Quiz complete! ✅ Great job."
                    });
                }
            }
        }
        return NextResponse.json({ ok: true });
    }

    // 3. Handle message (Original flow)
    const updateId: number = update.update_id;
    const message = update.message;
    const chatId: number | undefined = message?.chat.id;
    const text: string | undefined = message?.text;
    const hasText: boolean = typeof text === "string" && text.length > 0;

    let youtubeId: string | null = null;

    if (hasText && text) {
        youtubeId = parseYouTubeId(text);
    }
    const hasYouTubeId = youtubeId !== null;

    console.log("[webhook]", { update_id: updateId, chat_id: chatId, hasText, hasYouTubeId });

    if (chatId !== undefined) {
        if (!hasText) return NextResponse.json({ ok: true });

        if (!youtubeId) {
            await sendTelegramMessage({
                chatId,
                text: "Please send me a valid YouTube video link.",
            }).catch(console.error);
            return NextResponse.json({ ok: true });
        }

        try {
            const result = await enqueueJob(chatId, youtubeId);

            if (result.status === 'already_completed') {
                const existing = await getResultByYoutubeId(youtubeId);
                if (existing) {
                    await sendTelegramMessageChunks(chatId, existing.markdown);
                    await sendTelegramMessage({
                        chatId,
                        text: "Ready to test your knowledge?",
                        replyMarkup: {
                            inline_keyboard: [[
                                { text: "🚀 Start Quiz", callback_data: `quiz:start:${youtubeId}` }
                            ]]
                        }
                    });
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
            await sendTelegramMessage({ chatId, text: "An error occurred while queueing the video." }).catch(console.error);
        }
    }

    return NextResponse.json({ ok: true });
}
