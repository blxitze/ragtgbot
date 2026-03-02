/**
 * src/lib/transcript/youtubeTranscript.test.ts
 *
 * Vitest tests for getYouTubeTranscript.
 * The youtube-transcript library is fully mocked — no network calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getYouTubeTranscript } from "./youtubeTranscript";
import { TranscriptNotFoundError, TranscriptFetchError } from "./errors";

// vi.hoisted ensures this variable exists before vi.mock is hoisted to the
// top of the file, making it available inside the factory function.
const { mockFetchTranscript } = vi.hoisted(() => ({
    mockFetchTranscript: vi.fn(),
}));

// Keep real error classes intact (needed for instanceof checks in production
// code) and only replace YoutubeTranscript.fetchTranscript.
vi.mock("youtube-transcript", async (importActual) => {
    const actual = await importActual<typeof import("youtube-transcript")>();
    return {
        ...actual,
        YoutubeTranscript: {
            fetchTranscript: mockFetchTranscript,
        },
    };
});

import { YoutubeTranscriptError } from "youtube-transcript";

// Convenience factory matching the library's return shape.
function makeRawSegment(text: string, offset: number, duration: number, lang = "en") {
    return { text, offset, duration, lang };
}

beforeEach(() => {
    vi.resetAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────

describe("getYouTubeTranscript", () => {

    // ── Happy path ──────────────────────────────────────────────────────────

    it("returns normalised fullText and segments for a valid transcript", async () => {
        mockFetchTranscript.mockResolvedValueOnce([
            makeRawSegment("  Hello world  ", 0, 2.5),
            makeRawSegment("  This is a test.  ", 2.5, 3.0),
            makeRawSegment("  Goodbye.  ", 5.5, 2.0),
        ]);

        const result = await getYouTubeTranscript("dQw4w9WgXcQ");

        expect(result.segments).toHaveLength(3);
        expect(result.segments[0]).toEqual({ start: 0, duration: 2.5, text: "Hello world" });
        expect(result.segments[1]).toEqual({ start: 2.5, duration: 3.0, text: "This is a test." });
        expect(result.segments[2]).toEqual({ start: 5.5, duration: 2.0, text: "Goodbye." });
        expect(result.fullText).toBe("Hello world This is a test. Goodbye.");
        expect(result.language).toBe("en");
    });

    it("strips empty segments after trimming", async () => {
        mockFetchTranscript.mockResolvedValueOnce([
            makeRawSegment("Hello", 0, 1.0),
            makeRawSegment("   ", 1.0, 0.5),   // whitespace-only → should be removed
            makeRawSegment("World", 1.5, 1.0),
        ]);

        const result = await getYouTubeTranscript("dQw4w9WgXcQ");

        expect(result.segments).toHaveLength(2);
        expect(result.fullText).toBe("Hello World");
    });

    it("sets language from the first segment lang field", async () => {
        mockFetchTranscript.mockResolvedValueOnce([
            makeRawSegment("Hallo", 0, 1.0, "de"),
        ]);

        const result = await getYouTubeTranscript("dQw4w9WgXcQ");

        expect(result.language).toBe("de");
    });

    // ── Transcript not found ────────────────────────────────────────────────

    it("throws TranscriptNotFoundError when library says subtitles are disabled", async () => {
        mockFetchTranscript.mockRejectedValueOnce(
            new YoutubeTranscriptError("Transcript is disabled for this video")
        );

        await expect(getYouTubeTranscript("dQw4w9WgXcQ")).rejects.toBeInstanceOf(
            TranscriptNotFoundError
        );
    });

    it("throws TranscriptNotFoundError when transcript is not available", async () => {
        mockFetchTranscript.mockRejectedValueOnce(
            new YoutubeTranscriptError("Could not get transcript")
        );

        await expect(getYouTubeTranscript("dQw4w9WgXcQ")).rejects.toBeInstanceOf(
            TranscriptNotFoundError
        );
    });

    it("throws TranscriptNotFoundError when all segments are empty after trimming", async () => {
        mockFetchTranscript.mockResolvedValueOnce([
            makeRawSegment("  ", 0, 1.0),
            makeRawSegment("\n", 1.0, 1.0),
        ]);

        await expect(getYouTubeTranscript("dQw4w9WgXcQ")).rejects.toBeInstanceOf(
            TranscriptNotFoundError
        );
    });

    // ── Generic / unexpected errors ─────────────────────────────────────────

    it("throws TranscriptFetchError for a non-library / network error", async () => {
        mockFetchTranscript.mockRejectedValueOnce(new TypeError("Failed to fetch"));

        await expect(getYouTubeTranscript("dQw4w9WgXcQ")).rejects.toBeInstanceOf(
            TranscriptFetchError
        );
    });

    it("throws TranscriptFetchError for a library error that is not a not-found signal", async () => {
        mockFetchTranscript.mockRejectedValueOnce(
            new YoutubeTranscriptError("Rate limit exceeded")
        );

        await expect(getYouTubeTranscript("dQw4w9WgXcQ")).rejects.toBeInstanceOf(
            TranscriptFetchError
        );
    });

    // ── Input validation ────────────────────────────────────────────────────

    it("throws TranscriptFetchError for an empty videoId", async () => {
        await expect(getYouTubeTranscript("")).rejects.toBeInstanceOf(TranscriptFetchError);
        expect(mockFetchTranscript).not.toHaveBeenCalled();
    });

    it("throws TranscriptFetchError for a whitespace-only videoId", async () => {
        await expect(getYouTubeTranscript("   ")).rejects.toBeInstanceOf(TranscriptFetchError);
        expect(mockFetchTranscript).not.toHaveBeenCalled();
    });

    // ── Error message safety ────────────────────────────────────────────────

    it("error messages do not contain the transcript text", async () => {
        mockFetchTranscript.mockRejectedValueOnce(
            new YoutubeTranscriptError("Transcript is disabled for this video")
        );

        let caughtError: unknown;
        try {
            await getYouTubeTranscript("dQw4w9WgXcQ");
        } catch (e) {
            caughtError = e;
        }

        expect(caughtError).toBeInstanceOf(TranscriptNotFoundError);
        const err = caughtError as TranscriptNotFoundError;
        // The videoId appears in the message (fine), but no raw transcript content.
        expect(err.message).toContain("dQw4w9WgXcQ");
        expect(err.message).not.toContain("Transcript is disabled"); // cause, not message
    });
});
