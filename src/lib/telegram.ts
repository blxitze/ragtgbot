/**
 * src/lib/telegram.ts
 *
 * Server-only utility for sending messages via the Telegram Bot API.
 * Enforced at build time: will error if imported from a client component.
 */

import "server-only";

import { env } from "@/lib/env";
import { splitTelegramMessage } from "./telegramSplit";

interface SendMessageParams {
    chatId: number;
    text: string;
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
}: SendMessageParams): Promise<void> {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text }),
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
