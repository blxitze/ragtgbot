/**
 * scripts/telegramWebhook.ts
 *
 * Sets the Telegram webhook to the configured APP_URL.
 */

// Load environment variables directly from process.env instead of importing src/lib/env
// to avoid "server-only" or Next.js specific errors during script execution.
import { loadEnvConfig } from '@next/env';
const projectDir = process.cwd();
loadEnvConfig(projectDir);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_SECRET = process.env.TELEGRAM_SECRET;
const APP_URL = process.env.APP_URL;

interface TelegramApiResponse {
    ok: boolean;
    description?: string;
}

interface WebhookInfo {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
}

interface WebhookInfoResponse extends TelegramApiResponse {
    result?: WebhookInfo;
}

async function run() {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_SECRET || !APP_URL) {
        console.error("Missing required environment variables in your .env file:");
        if (!TELEGRAM_BOT_TOKEN) console.error(" - TELEGRAM_BOT_TOKEN");
        if (!TELEGRAM_SECRET) console.error(" - TELEGRAM_SECRET");
        if (!APP_URL) console.error(" - APP_URL");
        process.exit(1);
    }

    const command = process.argv[2];

    if (command === '--info') {
        await getWebhookInfo();
    } else {
        await setWebhook();
        await getWebhookInfo();
    }
}

async function setWebhook() {
    const url = `${APP_URL}/api/telegram/webhook`;
    console.log(`Setting webhook to: ${url}`);

    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url,
                secret_token: TELEGRAM_SECRET,
            }),
            signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        const data = (await response.json()) as TelegramApiResponse;
        if (!response.ok || !data.ok) {
            console.error("Failed to set webhook:", data.description || response.statusText);
            process.exit(1);
        }

        console.log("✅ Webhook set successfully.");
    } catch (error) {
        console.error("Error setting webhook:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

async function getWebhookInfo() {
    console.log("\nFetching webhook info...");
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`, {
            signal: AbortSignal.timeout(5000),
        });

        const data = (await response.json()) as WebhookInfoResponse;
        if (!response.ok || !data.ok) {
            console.error("Failed to get webhook info:", data.description || response.statusText);
            process.exit(1);
        }

        const info = data.result;
        if (!info) {
            console.error("Webhook info result is empty.");
            process.exit(1);
        }
        console.log("----------------------------------------");
        console.log(`URL: ${info.url}`);
        console.log(`Has Custom Certificate: ${info.has_custom_certificate}`);
        console.log(`Pending Update Count: ${info.pending_update_count}`);
        if (info.last_error_date) {
            console.log(`Last Error Date: ${new Date(info.last_error_date * 1000).toISOString()}`);
        }
        if (info.last_error_message) {
            console.log(`Last Error Message: ${info.last_error_message}`);
        }
        console.log("----------------------------------------");

    } catch (error) {
        console.error("Error getting webhook info:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

run().catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
});
