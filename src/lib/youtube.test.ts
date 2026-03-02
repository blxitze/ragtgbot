/**
 * src/lib/youtube.test.ts
 *
 * Vitest test suite for parseYouTubeId and isYouTubeUrl.
 */

import { describe, it, expect } from "vitest";
import { parseYouTubeId, isYouTubeUrl } from "./youtube";

// A known-good 11-character video ID used across multiple tests.
const VALID_ID = "dQw4w9WgXcQ";

describe("parseYouTubeId", () => {
    // ── Valid formats ──────────────────────────────────────────────────────

    it("parses a standard watch URL", () => {
        expect(parseYouTubeId(`https://www.youtube.com/watch?v=${VALID_ID}`)).toBe(VALID_ID);
    });

    it("parses a youtu.be short link", () => {
        expect(parseYouTubeId(`https://youtu.be/${VALID_ID}`)).toBe(VALID_ID);
    });

    it("parses a Shorts URL", () => {
        expect(parseYouTubeId(`https://youtube.com/shorts/${VALID_ID}`)).toBe(VALID_ID);
    });

    it("parses a www Shorts URL", () => {
        expect(parseYouTubeId(`https://www.youtube.com/shorts/${VALID_ID}`)).toBe(VALID_ID);
    });

    it("parses an embed URL", () => {
        expect(parseYouTubeId(`https://www.youtube.com/embed/${VALID_ID}`)).toBe(VALID_ID);
    });

    // ── Extra query parameters (must be ignored) ───────────────────────────

    it("ignores &t= timestamp param on watch URL", () => {
        expect(parseYouTubeId(`https://www.youtube.com/watch?v=${VALID_ID}&t=42`)).toBe(VALID_ID);
    });

    it("ignores &si= tracking param on watch URL", () => {
        expect(parseYouTubeId(`https://www.youtube.com/watch?v=${VALID_ID}&si=abc123`)).toBe(VALID_ID);
    });

    it("ignores playlist params when v= is present", () => {
        expect(
            parseYouTubeId(
                `https://www.youtube.com/watch?v=${VALID_ID}&list=PLabc&index=3`
            )
        ).toBe(VALID_ID);
    });

    it("ignores ?t= param on youtu.be short link", () => {
        expect(parseYouTubeId(`https://youtu.be/${VALID_ID}?t=30`)).toBe(VALID_ID);
    });

    // ── Mobile domain ──────────────────────────────────────────────────────

    it("parses mobile m.youtube.com watch URL", () => {
        expect(parseYouTubeId(`https://m.youtube.com/watch?v=${VALID_ID}`)).toBe(VALID_ID);
    });

    // ── Invalid inputs ─────────────────────────────────────────────────────

    it("returns null for a non-YouTube domain", () => {
        expect(parseYouTubeId(`https://vimeo.com/watch?v=${VALID_ID}`)).toBeNull();
    });

    it("returns null for a watch URL with no v= param", () => {
        expect(parseYouTubeId("https://www.youtube.com/watch")).toBeNull();
    });

    it("returns null for a youtube.com URL with no recognised path", () => {
        expect(parseYouTubeId("https://www.youtube.com/channel/UCxxxxxx")).toBeNull();
    });

    it("returns null for a youtu.be link with a too-short ID", () => {
        expect(parseYouTubeId("https://youtu.be/abc")).toBeNull();
    });

    it("returns null for random plain text", () => {
        expect(parseYouTubeId("just some random text")).toBeNull();
    });

    it("returns null for an empty string", () => {
        expect(parseYouTubeId("")).toBeNull();
    });

    it("returns null for a lookalike phishing domain", () => {
        expect(parseYouTubeId(`https://www.youtube.com.evil.com/watch?v=${VALID_ID}`)).toBeNull();
    });
});

describe("isYouTubeUrl", () => {
    it("returns true for a valid YouTube watch URL", () => {
        expect(isYouTubeUrl(`https://www.youtube.com/watch?v=${VALID_ID}`)).toBe(true);
    });

    it("returns false for a non-YouTube URL", () => {
        expect(isYouTubeUrl("https://vimeo.com/123456")).toBe(false);
    });

    it("returns false for plain text", () => {
        expect(isYouTubeUrl("not a url")).toBe(false);
    });
});
