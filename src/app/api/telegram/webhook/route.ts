/**
 * src/app/api/telegram/webhook/route.ts
 *
 * Next.js App Router route handler for the Telegram webhook.
 * POST /api/telegram/webhook
 *
 * Security: validates X-Telegram-Bot-Api-Secret-Token BEFORE reading the body.
 */

import { type NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage, sendTelegramMessageChunks, sendTelegramQuizPoll, answerTelegramCallbackQuery } from "@/lib/telegram";
import { enqueueJob } from "@/lib/db/jobs";
import { getResultByYoutubeId } from "@/lib/db/results";
import { parseYouTubeId } from "@/lib/youtube";
import { createQuizSession, getQuizSession, setQuizSessionIndex, advanceQuizSession, mapPollToSession, getPollMapping } from "@/lib/db/quizSessions";
import type { MCQ } from "@/lib/llm/types";
import { renderNotesMarkdown } from "@/lib/llm/renderMarkdown";

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

// Removed redundant answerCallbackQuery helper

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
        const queryData = cb.data ?? "";
        const chatId = cb.message?.chat?.id;

        if (queryData.startsWith("quiz:start:") && chatId) {
            const youtubeId = queryData.replace("quiz:start:", "");
            console.log("[webhook] callback_query", { chat_id: chatId, data: queryData.slice(0, 20) });

            // Acknowledge immediately to remove spinner
            await answerTelegramCallbackQuery(cb.id, "Starting quiz…").catch(console.error);

            const result = await getResultByYoutubeId(youtubeId);
            const mcqs = result?.quiz_json?.mcq as MCQ[] | undefined;

            if (!mcqs || mcqs.length === 0) {
                await sendTelegramMessage({ chatId, text: "Sorry, no quiz questions found for this video." });
            } else {
                const sessionId = await createQuizSession(chatId, youtubeId);
                const firstMcq = mcqs[0];

                const correctIndex = firstMcq.choices.indexOf(firstMcq.correctAnswer);
                if (correctIndex === -1) {
                    console.error("[webhook] MCQ correct answer not in choices", { youtube_id: youtubeId });
                    await sendTelegramMessage({ chatId, text: "Sorry, there was an error with the quiz data." });
                } else {
                    const { pollId } = await sendTelegramQuizPoll({
                        chatId,
                        question: firstMcq.question,
                        options: firstMcq.choices,
                        correctOptionIndex: correctIndex,
                        explanation: firstMcq.explanation
                    });

                    await mapPollToSession(pollId, sessionId, 0);
                }
            }
        } else {
            // Always answer even if unhandled to avoid permanent loading UI
            await answerTelegramCallbackQuery(cb.id).catch(console.error);
        }
        return NextResponse.json({ ok: true });
    }

    // 2. Handle poll_answer (Next Question)
    if (update.poll_answer) {
        const answer = update.poll_answer;
        const mapping = await getPollMapping(answer.poll_id);

        if (mapping) {
            const session = await getQuizSession(mapping.session_id);
            const nextIndex = mapping.question_index + 1;

            // Strict progression check: If the session has already moved past this question, ignore.
            // This is our primary idempotency guard before we even try the DB update.
            if (session.current_index > mapping.question_index) {
                console.log("[webhook] poll_answer already processed", {
                    poll_id: answer.poll_id.slice(-8),
                    session_index: session.current_index,
                    mapping_index: mapping.question_index
                });
                return NextResponse.json({ ok: true });
            }

            const result = await getResultByYoutubeId(session.youtube_id);
            const mcqs = result?.quiz_json?.mcq as MCQ[] | undefined;
            const mcqCount = Array.isArray(mcqs) ? mcqs.length : 0;

            console.log("[webhook] poll_answer", {
                session_id: session.id.slice(0, 8),
                chat_id: session.chat_id,
                question_index: mapping.question_index,
                nextIndex,
                mcqCount,
                hasMcqs: mcqCount > 0
            });

            if (nextIndex < mcqCount && mcqs) {
                const nextMcq = mcqs[nextIndex];
                const correctIndex = nextMcq.choices.indexOf(nextMcq.correctAnswer);

                if (correctIndex === -1) {
                    console.error("[webhook] MCQ correct answer not in choices", { session_id: session.id });
                    return NextResponse.json({ ok: true });
                }

                // Atomic advancement: ensures only one 'next' poll is sent if multiple answers arrive.
                // We advance from the specific index we just answered.
                const advanced = await advanceQuizSession(session.id, mapping.question_index, nextIndex);
                if (!advanced) {
                    // Fetch current state for better debug logs
                    const freshSession = await getQuizSession(session.id);
                    console.log("[webhook] Quiz already advanced (CAS failed).", {
                        session_id: session.id.slice(0, 8),
                        expected: mapping.question_index,
                        actual: freshSession.current_index
                    });
                    return NextResponse.json({ ok: true });
                }

                const { pollId } = await sendTelegramQuizPoll({
                    chatId: session.chat_id,
                    question: nextMcq.question,
                    options: nextMcq.choices,
                    correctOptionIndex: correctIndex,
                    explanation: nextMcq.explanation
                });

                await mapPollToSession(pollId, session.id, nextIndex);
            } else if (nextIndex >= mcqCount) {
                // If this specific answer triggers completion, we also need to guard it
                const advanced = await advanceQuizSession(session.id, mapping.question_index, nextIndex);
                if (advanced) {
                    await sendTelegramMessage({
                        chatId: session.chat_id,
                        text: "Quiz complete! ✅ Great job."
                    });
                } else {
                    console.log("[webhook] Completion already processed (CAS failed).", { session_id: session.id.slice(0, 8) });
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
                    // Send notes-only markdown
                    const notesMarkdown = renderNotesMarkdown({
                        tldr: existing.notes_json.tldr,
                        outline: existing.notes_json.outline,
                        sections: existing.notes_json.sections,
                        quiz: existing.quiz_json
                    });

                    await sendTelegramMessageChunks(chatId, notesMarkdown);
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
