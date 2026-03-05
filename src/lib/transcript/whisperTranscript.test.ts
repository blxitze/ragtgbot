import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import OpenAI from 'openai';

// Shared mocks
const mockTranscriptionsCreate = vi.fn();
const mockOpenAIInstance = {
    audio: {
        transcriptions: {
            create: mockTranscriptionsCreate,
        },
    },
};

// Mock env.server before anything else
vi.mock('../env.server', () => ({
    env: {
        OPENAI_API_KEY: 'test-key',
    },
}));

// Mock child_process.execFile
vi.mock('node:child_process', () => ({
    execFile: vi.fn(),
}));

// Mock OpenAI
vi.mock('openai', () => ({
    default: vi.fn().mockImplementation(() => mockOpenAIInstance),
}));

// Mock fs
vi.mock('node:fs', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    return {
        ...actual,
        createReadStream: vi.fn().mockReturnValue('mock-stream'),
        promises: {
            ...actual.promises,
            access: vi.fn(),
            unlink: vi.fn(),
        },
    };
});

import { getWhisperTranscript } from './whisperTranscript';

describe('getWhisperTranscript', () => {
    const videoId = '8Oos6D4_Bjo';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('successfully transcribes audio', async () => {
        // Mock yt-dlp success
        (execFile as any).mockImplementation((_cmd: string, _args: string[], _opts: any, cb: any) => {
            cb(null, { stdout: 'success', stderr: '' });
        });

        // Mock fs.access success
        vi.mocked(fs.access).mockResolvedValue(undefined);

        // Mock OpenAI success
        mockTranscriptionsCreate.mockResolvedValue({ text: 'Transcibed text' });

        const result = await getWhisperTranscript(videoId);

        expect(result.fullText).toBe('Transcibed text');
        expect(fs.unlink).toHaveBeenCalled();
    });

    it('throws safe error when yt-dlp fails', async () => {
        const error: any = new Error('Command failed');
        error.code = 1;
        error.stderr = 'ERROR: Sign in to confirm your age';
        (execFile as any).mockImplementation((_cmd: string, _args: string[], _opts: any, cb: any) => {
            cb(error, { stdout: '', stderr: 'ERROR: Sign in to confirm your age' });
        });

        await expect(getWhisperTranscript(videoId)).rejects.toThrow(
            /\[whisper\] yt-dlp failed\. Name: Error, Code: 1\. Stderr: ERROR: Sign in to confirm your age/
        );
        expect(fs.unlink).toHaveBeenCalled();
    });

    it('throws safe error when OpenAI fails', async () => {
        // Mock yt-dlp success
        (execFile as any).mockImplementation((_cmd: string, _args: string[], _opts: any, cb: any) => {
            cb(null, { stdout: 'success', stderr: '' });
        });
        vi.mocked(fs.access).mockResolvedValue(undefined);

        // Mock OpenAI failure
        const apiError: any = new Error('Invalid API Key');
        apiError.status = 401;
        mockTranscriptionsCreate.mockRejectedValue(apiError);

        await expect(getWhisperTranscript(videoId)).rejects.toThrow(
            /\[whisper\] OpenAI transcription failed\. Status: 401\. Message: Invalid API Key/
        );
    });
});
