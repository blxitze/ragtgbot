/**
 * src/lib/telegram.ts
 *
 * Utility for sending messages via the Telegram Bot API.
 * Safe for both Next.js server code and standalone Node scripts.
 */

import { env } from "./env";
import { splitTelegramMessage } from "./telegramSplit";

interface SendMessageParams {
    chatId: number;
    text: string;
    replyMarkup?: any;
}

interface TelegramApiResponse {
    ok: boolean;
    description?: string;
}

/**
 * Sends a text message to a Telegram chat.
 * Throws if the network request fails or the Telegram API returns ok: false.
 */
export async function sendTelegramMessage({
    chatId,
    text,
    replyMarkup,
}: SendMessageParams): Promise<void> {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                reply_markup: replyMarkup
            }),
        });
    } catch (cause) {
        throw new Error("[telegram] Network error while sending message", {
            cause,
        });
    }

    if (!response.ok) {
        throw new Error(
            `[telegram] HTTP error from Telegram API: ${response.status} ${response.statusText}`
        );
    }

    const data = (await response.json()) as TelegramApiResponse;

    if (!data.ok) {
        throw new Error(
            `[telegram] Telegram API returned ok: false — ${data.description ?? "no description"}`
        );
    }
}

/**
 * Splits a long text into chunks and sends them sequentially to a Telegram chat.
 * Adds a small delay between messages to avoid rate limits.
 */
export async function sendTelegramMessageChunks(
    chatId: number,
    text: string
): Promise<void> {
    const chunks = splitTelegramMessage(text);
    for (const chunk of chunks) {
        await sendTelegramMessage({ chatId, text: chunk });
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
}

/**
 * Sends a native Telegram quiz poll to a chat.
 */
export async function sendTelegramQuizPoll({
    chatId,
    question,
    options,
    correctOptionIndex,
    explanation,
}: {
    chatId: number;
    question: string;
    options: string[];
    correctOptionIndex: number;
    explanation?: string;
}): Promise<{ pollId: string }> {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPoll`;

    // Safe truncation
    const safeQuestion = question.slice(0, 300);
    const safeOptions = options.map(o => o.slice(0, 100));
    const safeExplanation = explanation?.slice(0, 200);

    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                question: safeQuestion,
                options: safeOptions,
                is_anonymous: false,
                type: "quiz",
                correct_option_id: correctOptionIndex,
                explanation: safeExplanation,
            }),
        });
    } catch (cause) {
        throw new Error("[telegram] Network error while sending poll", { cause });
    }

    if (!response.ok) {
        throw new Error(`[telegram] HTTP error from Telegram API (sendPoll): ${response.status}`);
    }

    const data = await response.json();
    if (!data.ok) {
        throw new Error(`[telegram] Telegram API (sendPoll) returned ok: false — ${data.description ?? "no description"}`);
    }

    const pollId = data.result.poll.id;
    console.log("[telegram] Quiz poll sent", { pollId, chat_id: chatId });

    return { pollId };
}

/**
 * Acknowledges a callback query from an inline keyboard button.
 */
export async function answerTelegramCallbackQuery(
    callbackQueryId: string,
    text?: string
): Promise<void> {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;

    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                callback_query_id: callbackQueryId,
                text,
            }),
        });
    } catch (cause) {
        throw new Error("[telegram] Network error while answering callback query", { cause });
    }

    if (!response.ok) {
        throw new Error(`[telegram] HTTP error from Telegram API (answerCallbackQuery): ${response.status}`);
    }

    const data = await response.json();
    if (!data.ok) {
        throw new Error(`[telegram] Telegram API (answerCallbackQuery) returned ok: false — ${data.description ?? "no description"}`);
    }
}
