/**
 * src/lib/telegramSplit.ts
 *
 * Utility for splitting long Telegram messages.
 * Telegram has a limit of ~4096 characters. We use 3800 for safety.
 */

export function splitTelegramMessage(text: string, maxLen = 3800): string[] {
    if (!text) return [];

    if (text.length <= maxLen) {
        return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxLen) {
            chunks.push(remaining);
            break;
        }

        let splitIndex = -1;
        let nextStart = -1;

        // 1. Prefer double newlines
        const doubleNewlineIndex = remaining.lastIndexOf('\n\n', maxLen);
        if (doubleNewlineIndex !== -1) {
            splitIndex = doubleNewlineIndex;
            nextStart = doubleNewlineIndex + 2; // skip \n\n
        } else {
            // 2. Fallback to single newline
            const singleNewlineIndex = remaining.lastIndexOf('\n', maxLen);
            if (singleNewlineIndex !== -1) {
                splitIndex = singleNewlineIndex;
                nextStart = singleNewlineIndex + 1; // skip \n
            } else {
                // 3. Fallback to space
                const spaceIndex = remaining.lastIndexOf(' ', maxLen);
                if (spaceIndex !== -1) {
                    splitIndex = spaceIndex;
                    nextStart = spaceIndex + 1; // skip space
                } else {
                    // 4. Force split at maxLen if no good breaks found
                    splitIndex = maxLen;
                    nextStart = maxLen;
                }
            }
        }

        const chunk = remaining.slice(0, splitIndex);
        if (chunk.length > 0) {
            chunks.push(chunk);
        }
        remaining = remaining.slice(nextStart);
    }

    return chunks;
}
