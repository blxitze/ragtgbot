import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processJob } from './processJob';

// Mock dependencies
vi.mock('../transcript/getTranscript', () => ({
    getTranscript: vi.fn(),
}));
import { getTranscript } from '../transcript/getTranscript';

vi.mock('../llm/generateNotesAndQuiz', () => ({
    generateNotesAndQuiz: vi.fn(),
}));
import { generateNotesAndQuiz } from '../llm/generateNotesAndQuiz';

vi.mock('../llm/renderMarkdown', () => ({
    renderNotesAndQuizMarkdown: vi.fn(),
}));
import { renderNotesAndQuizMarkdown } from '../llm/renderMarkdown';

vi.mock('../db/videos', () => ({
    upsertVideoByYoutubeId: vi.fn(),
}));
import { upsertVideoByYoutubeId } from '../db/videos';

vi.mock('../db/transcripts', () => ({
    upsertTranscript: vi.fn(),
}));
import { upsertTranscript } from '../db/transcripts';

vi.mock('../db/results', () => ({
    upsertResult: vi.fn(),
}));
import { upsertResult } from '../db/results';

vi.mock('../db/jobs', () => ({
    markJobCompleted: vi.fn(),
    markJobFailed: vi.fn(),
}));
import { markJobCompleted, markJobFailed } from '../db/jobs';

vi.mock('../telegram', () => ({
    sendTelegramMessage: vi.fn(),
    sendTelegramMessageChunks: vi.fn(),
}));
import { sendTelegramMessage, sendTelegramMessageChunks } from '../telegram';

describe('processJob', () => {
    const defaultJob = { jobId: 'job-1', youtubeId: '12345678901', chatId: 999 };

    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default successful mock implementations
        vi.mocked(getTranscript).mockResolvedValue({ language: 'en', fullText: 'Hello world transcript', segments: [] });
        vi.mocked(upsertVideoByYoutubeId).mockResolvedValue({ id: 'video-1' } as any);
        vi.mocked(upsertTranscript).mockResolvedValue(true as any);
        vi.mocked(generateNotesAndQuiz).mockResolvedValue({ tldr: 'Test tldr', outline: ['Test outline'], sections: [], quiz: { mcq: [], tf: [], short: [] } } as any);
        vi.mocked(renderNotesAndQuizMarkdown).mockReturnValue('# Test Markdown');
        vi.mocked(upsertResult).mockResolvedValue(true as any);
        vi.mocked(markJobCompleted).mockResolvedValue(true as any);
        vi.mocked(sendTelegramMessage).mockResolvedValue(undefined);
        vi.mocked(sendTelegramMessageChunks).mockResolvedValue(undefined);
    });

    it('processes a job successfully end-to-end', async () => {
        await processJob(defaultJob);

        expect(sendTelegramMessage).toHaveBeenCalledWith({ chatId: 999, text: 'Fetching transcript…' });
        expect(getTranscript).toHaveBeenCalledWith('12345678901');
        expect(upsertVideoByYoutubeId).toHaveBeenCalledWith('12345678901');
        expect(upsertTranscript).toHaveBeenCalledWith('video-1', 'youtube_subtitles', 'en', 'Hello world transcript');

        expect(sendTelegramMessage).toHaveBeenCalledWith({ chatId: 999, text: 'Generating notes and quiz…' });
        expect(generateNotesAndQuiz).toHaveBeenCalledWith({ transcriptText: 'Hello world transcript' });
        expect(renderNotesAndQuizMarkdown).toHaveBeenCalledWith({
            tldr: 'Test tldr', outline: ['Test outline'], sections: [], quiz: { mcq: [], tf: [], short: [] }
        });

        expect(upsertResult).toHaveBeenCalledWith('video-1', { tldr: 'Test tldr', outline: ['Test outline'], sections: [], quiz: { mcq: [], tf: [], short: [] } }, { mcq: [], tf: [], short: [] }, '# Test Markdown');
        expect(sendTelegramMessageChunks).toHaveBeenCalledWith(999, '# Test Markdown');
        expect(markJobCompleted).toHaveBeenCalledWith('job-1');
    });

    it('handles transcript not found gracefully', async () => {
        const notFoundError = new Error('Transcript not found');
        notFoundError.name = 'TranscriptNotFoundError';
        vi.mocked(getTranscript).mockRejectedValueOnce(notFoundError);

        await processJob(defaultJob);

        expect(markJobFailed).toHaveBeenCalledWith('job-1', 'Transcript not found');
        expect(sendTelegramMessage).toHaveBeenCalledWith({ chatId: 999, text: 'Sorry, I couldn\'t find a transcript for this video.' });
        expect(generateNotesAndQuiz).not.toHaveBeenCalled();
    });

    it('handles other errors cleanly', async () => {
        const error = new Error('Some API error');
        vi.mocked(generateNotesAndQuiz).mockRejectedValueOnce(error);

        await processJob(defaultJob);

        expect(markJobFailed).toHaveBeenCalledWith('job-1', 'Some API error');
        expect(sendTelegramMessage).toHaveBeenCalledWith({ chatId: 999, text: 'An error occurred while processing the video.' });
        expect(upsertResult).not.toHaveBeenCalled();
    });
});
