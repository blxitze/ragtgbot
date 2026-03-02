/**
 * src/lib/youtube.ts
 *
 * Production-grade YouTube URL parser.
 * Uses the WHATWG URL API (new URL()) for parsing — no regex-only magic.
 * Returns null for anything that isn't a recognisable YouTube video link.
 */

/** Hostnames that are considered YouTube domains. */
const YOUTUBE_HOSTS = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
]);

/**
 * YouTube video IDs are always exactly 11 characters:
 * alphanumeric plus `-` and `_`.
 */
function isValidVideoId(id: string): boolean {
    return /^[A-Za-z0-9_-]{11}$/.test(id);
}

/**
 * Extracts a YouTube video ID from the given input string.
 *
 * Supported URL formats:
 *   - https://www.youtube.com/watch?v=VIDEOID
 *   - https://youtu.be/VIDEOID
 *   - https://youtube.com/shorts/VIDEOID
 *   - https://www.youtube.com/embed/VIDEOID
 *   - All of the above with extra query params (&t=, &si=, playlists, etc.)
 *
 * @returns The 11-character video ID, or `null` if the input is not a
 *          recognisable YouTube video URL.
 */
export function parseYouTubeId(input: string): string | null {
    // Reject obviously non-URL inputs quickly.
    if (!input || typeof input !== "string") return null;

    let url: URL;
    try {
        url = new URL(input.trim());
    } catch {
        // input is not a valid URL at all
        return null;
    }

    // Only accept http / https schemes.
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;

    const host = url.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.has(host)) return null;

    // ── youtu.be/<id> ───────────────────────────────────────────────────────
    if (host === "youtu.be") {
        // pathname is "/<id>" — strip leading slash and any trailing segments
        const id = url.pathname.slice(1).split("/")[0] ?? "";
        return isValidVideoId(id) ? id : null;
    }

    // ── youtube.com/watch?v=<id> ─────────────────────────────────────────────
    if (url.pathname === "/watch") {
        const id = url.searchParams.get("v") ?? "";
        return isValidVideoId(id) ? id : null;
    }

    // ── youtube.com/shorts/<id> ──────────────────────────────────────────────
    const shortsMatch = /^\/shorts\/([^/?#]+)/.exec(url.pathname);
    if (shortsMatch !== null) {
        const id = shortsMatch[1] ?? "";
        return isValidVideoId(id) ? id : null;
    }

    // ── youtube.com/embed/<id> ───────────────────────────────────────────────
    const embedMatch = /^\/embed\/([^/?#]+)/.exec(url.pathname);
    if (embedMatch !== null) {
        const id = embedMatch[1] ?? "";
        return isValidVideoId(id) ? id : null;
    }

    return null;
}

/**
 * Returns `true` if the input is a YouTube URL that contains a valid video ID.
 */
export function isYouTubeUrl(input: string): boolean {
    return parseYouTubeId(input) !== null;
}
