/**
 * src/lib/transcript/errors.ts
 *
 * Domain-specific errors for the YouTube transcript module.
 * Never include secrets, tokens, or transcript content in error messages.
 */

/**
 * Thrown when a transcript exists for a video but cannot be fetched —
 * e.g. the video has no subtitles, subtitles are disabled, or the video
 * is unavailable/private.
 */
export class TranscriptNotFoundError extends Error {
    override readonly name = "TranscriptNotFoundError";

    constructor(videoId: string, cause?: unknown) {
        super(
            `No transcript available for video "${videoId}". ` +
            `The video may have subtitles disabled, be private, or not exist.`
        );
        if (cause !== undefined) {
            this.cause = cause;
        }
    }
}

/**
 * Thrown when an unexpected error occurs while fetching or processing a
 * transcript — e.g. a network failure or a malformed API response.
 */
export class TranscriptFetchError extends Error {
    override readonly name = "TranscriptFetchError";

    constructor(videoId: string, cause?: unknown) {
        super(
            `Failed to fetch transcript for video "${videoId}". ` +
            `Check network connectivity and try again.`
        );
        if (cause !== undefined) {
            this.cause = cause;
        }
    }
}
