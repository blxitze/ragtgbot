/**
 * src/lib/transcript/types.ts
 *
 * Shared types for the YouTube transcript module.
 */

/** A single captioned segment of a YouTube video. */
export type TranscriptSegment = {
    /** Start time in seconds from the beginning of the video. */
    start: number;
    /** Length of the segment in seconds. */
    duration: number;
    /** Trimmed caption text for this segment. */
    text: string;
};

/** The fully normalised transcript returned by getYouTubeTranscript(). */
export type TranscriptResult = {
    /** All segment texts joined with single spaces. */
    fullText: string;
    /** Ordered array of transcript segments. */
    segments: TranscriptSegment[];
    /** BCP-47 language code of the fetched transcript, if available. */
    language?: string;
};
