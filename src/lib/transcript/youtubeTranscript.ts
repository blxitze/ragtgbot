/**
 * src/lib/transcript/youtubeTranscript.ts
 *
 * Fetches and normalises YouTube video transcripts.
 * Safe for both Next.js server code and standalone Node scripts.
 */

import { YoutubeTranscript, YoutubeTranscriptError } from "youtube-transcript";
import type { TranscriptResponse } from "youtube-transcript";
import type { TranscriptResult, TranscriptSegment } from "./types";
import { TranscriptFetchError, TranscriptNotFoundError } from "./errors";

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Error message substrings from youtube-transcript that indicate the video
 * has no transcript available (as opposed to a network / infra failure).
 */
const NOT_FOUND_SIGNALS = [
    "disabled",
    "not available",
    "unavailable",
    "Could not get",
    "no transcript",
] as const;

function isNotFoundSignal(message: string): boolean {
    const lower = message.toLowerCase();
    return NOT_FOUND_SIGNALS.some((signal) => lower.includes(signal.toLowerCase()));
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetches the transcript for a YouTube video by its ID.
 *
 * @param videoId - An 11-character YouTube video ID (e.g. "dQw4w9WgXcQ").
 * @returns Normalised transcript with fullText, segments, and optional language.
 * @throws {TranscriptFetchError} If videoId is empty or an unexpected error occurs.
 * @throws {TranscriptNotFoundError} If the video has no available transcript.
 */
export async function getYouTubeTranscript(videoId: string): Promise<TranscriptResult> {
    if (!videoId.trim()) {
        throw new TranscriptFetchError(videoId, new Error("videoId must be a non-empty string"));
    }

    let rawSegments: TranscriptResponse[];

    try {
        rawSegments = await YoutubeTranscript.fetchTranscript(videoId);
    } catch (cause) {
        // Classify the error: not-found vs unexpected.
        if (cause instanceof YoutubeTranscriptError) {
            const msg = cause.message ?? "";
            if (isNotFoundSignal(msg)) {
                throw new TranscriptNotFoundError(videoId, cause);
            }
            throw new TranscriptFetchError(videoId, cause);
        }
        // Unknown / non-library error.
        throw new TranscriptFetchError(videoId, cause);
    }

    // Normalise segments: trim text, drop empties, map offset → start.
    const segments: TranscriptSegment[] = rawSegments
        .map((s: TranscriptResponse) => ({
            start: s.offset,
            duration: s.duration,
            text: s.text.trim(),
        }))
        .filter((s: TranscriptSegment) => s.text.length > 0);

    if (segments.length === 0) {
        throw new TranscriptNotFoundError(videoId, new Error("Transcript contained no usable text"));
    }

    const fullText = segments.map((s) => s.text).join(" ");

    // Derive language from the first segment if the library provides it.
    const firstRaw = rawSegments[0];
    const language: string | undefined =
        firstRaw !== undefined && "lang" in firstRaw && typeof firstRaw.lang === "string"
            ? firstRaw.lang
            : undefined;

    return { fullText, segments, language };
}
