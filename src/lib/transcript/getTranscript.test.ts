import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTranscript } from './getTranscript';
import { TranscriptNotFoundError } from './errors';
import type { TranscriptResult } from './types';

vi.mock('./youtubeTranscript', () => ({
    getYouTubeTranscript: vi.fn(),
}));
import { getYouTubeTranscript } from './youtubeTranscript';

vi.mock('./whisperTranscript', () => ({
    getWhisperTranscript: vi.fn(),
}));
import { getWhisperTranscript } from './whisperTranscript';

const subtitleResult: TranscriptResult = {
    fullText: 'Subtitle transcript',
    segments: [{ start: 0, duration: 5, text: 'Subtitle transcript' }],
    language: 'en',
};

const whisperResult: TranscriptResult = {
    fullText: 'Whisper transcript',
    segments: [],
    language: undefined,
};

describe('getTranscript', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns YouTube subtitles when available', async () => {
        vi.mocked(getYouTubeTranscript).mockResolvedValue(subtitleResult);

        const result = await getTranscript('test_video_1');

        expect(result).toEqual(subtitleResult);
        expect(getYouTubeTranscript).toHaveBeenCalledWith('test_video_1');
        expect(getWhisperTranscript).not.toHaveBeenCalled();
    });

    it('falls back to Whisper when subtitles are not found', async () => {
        vi.mocked(getYouTubeTranscript).mockRejectedValue(
            new TranscriptNotFoundError('test_video_2')
        );
        vi.mocked(getWhisperTranscript).mockResolvedValue(whisperResult);

        const result = await getTranscript('test_video_2');

        expect(result).toEqual(whisperResult);
        expect(getYouTubeTranscript).toHaveBeenCalledWith('test_video_2');
        expect(getWhisperTranscript).toHaveBeenCalledWith('test_video_2');
    });

    it('re-throws non-TranscriptNotFoundError errors without calling Whisper', async () => {
        const networkError = new Error('Network failure');
        vi.mocked(getYouTubeTranscript).mockRejectedValue(networkError);

        await expect(getTranscript('test_video_3')).rejects.toThrow('Network failure');

        expect(getYouTubeTranscript).toHaveBeenCalledWith('test_video_3');
        expect(getWhisperTranscript).not.toHaveBeenCalled();
    });

    it('propagates Whisper errors if fallback also fails', async () => {
        vi.mocked(getYouTubeTranscript).mockRejectedValue(
            new TranscriptNotFoundError('test_video_4')
        );
        vi.mocked(getWhisperTranscript).mockRejectedValue(
            new Error('yt-dlp not installed')
        );

        await expect(getTranscript('test_video_4')).rejects.toThrow('yt-dlp not installed');
    });
});
