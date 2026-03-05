/**
 * src/lib/transcript/getTranscript.ts
 *
 * Unified transcript fetcher with Whisper fallback.
 * Tries YouTube subtitles first; if unavailable, falls back to Whisper transcription.
 */

import { getYouTubeTranscript } from "./youtubeTranscript";
import { getWhisperTranscript } from "./whisperTranscript";
import { TranscriptNotFoundError } from "./errors";
import type { TranscriptResult } from "./types";

/**
 * Fetches a transcript for a YouTube video.
 *
 * Strategy:
 * 1. Try YouTube subtitles (fast, free).
 * 2. If subtitles are not found (TranscriptNotFoundError), fall back to Whisper.
 * 3. Any other error (network, etc.) is re-thrown immediately.
 *
 * @param videoId - An 11-character YouTube video ID.
 * @returns TranscriptResult with fullText, segments, and optional language.
 */
export async function getTranscript(videoId: string): Promise<TranscriptResult> {
    try {
        return await getYouTubeTranscript(videoId);
    } catch (error: unknown) {
        if (error instanceof TranscriptNotFoundError) {
            console.log("[getTranscript] Subtitles not found, falling back to Whisper for video:", videoId);
            return await getWhisperTranscript(videoId);
        }
        throw error;
    }
}
