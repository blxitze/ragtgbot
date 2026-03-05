/**
 * src/lib/transcript/whisperTranscript.ts
 *
 * Fallback transcription using OpenAI Whisper when YouTube subtitles are unavailable.
 * Downloads audio via yt-dlp, transcribes with OpenAI, and cleans up temp files.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { env } from "../env.server";
import type { TranscriptResult } from "./types";

const execFileAsync = promisify(execFile);

/**
 * Downloads audio from a YouTube video and transcribes it using OpenAI Whisper.
 *
 * @param videoId - An 11-character YouTube video ID.
 * @returns TranscriptResult with fullText and empty segments array.
 * @throws Error if yt-dlp or OpenAI transcription fails.
 */
export async function getWhisperTranscript(videoId: string): Promise<TranscriptResult> {
    const audioFileName = `yt-audio-${randomUUID()}.mp3`;
    const audioPath = join(tmpdir(), audioFileName);

    try {
        // Step 1: Download audio via yt-dlp
        console.log("[whisper] Downloading audio for video:", videoId);

        try {
            await execFileAsync("yt-dlp", [
                "-f", "bestaudio",
                "--extract-audio",
                "--audio-format", "mp3",
                "-o", audioPath,
                `https://www.youtube.com/watch?v=${videoId}`,
            ], { timeout: 120_000 });
        } catch (error: any) {
            const stderr = error.stderr ? String(error.stderr).slice(-500) : "No stderr";
            throw new Error(
                `[whisper] yt-dlp failed. Name: ${error.name}, Code: ${error.code}. Stderr: ${stderr}`
            );
        }

        console.log("[whisper] Audio downloaded successfully for video:", videoId);

        // Step 2: Verify file exists
        await fs.access(audioPath);

        // Step 3: Transcribe with OpenAI
        console.log("[whisper] Transcribing audio for video:", videoId);

        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

        let transcription;
        try {
            transcription = await openai.audio.transcriptions.create({
                file: createReadStream(audioPath),
                model: "gpt-4o-mini-transcribe",
            });
        } catch (error: any) {
            const status = error.status || "Unknown status";
            const message = error.message ? String(error.message).slice(0, 300) : "No error message";
            throw new Error(
                `[whisper] OpenAI transcription failed. Status: ${status}. Message: ${message}`
            );
        }

        const fullText = transcription.text.trim();

        if (!fullText) {
            throw new Error(`Whisper returned empty transcription for video "${videoId}"`);
        }

        console.log("[whisper] Transcription successful for video:", videoId);

        return {
            fullText,
            segments: [],
            language: undefined,
        };
    } finally {
        // Step 4: Always clean up temp audio file
        try {
            await fs.unlink(audioPath);
        } catch {
            // File may not exist if download failed — ignore cleanup errors
        }
    }
}
