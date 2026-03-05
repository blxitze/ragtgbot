import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/telegram/webhook/route';
import { NextRequest } from 'next/server';
import { sendTelegramMessage, sendTelegramQuizPoll, sendTelegramMessageChunks, answerTelegramCallbackQuery } from '@/lib/telegram';
import { getResultByYoutubeId } from '@/lib/db/results';
import { createQuizSession, getQuizSession, setQuizSessionIndex, advanceQuizSession, mapPollToSession, getPollMapping } from '@/lib/db/quizSessions';
import { renderNotesMarkdown } from '@/lib/llm/renderMarkdown';

// Mock dependencies
vi.mock('@/lib/telegram', () => ({
    sendTelegramMessage: vi.fn().mockResolvedValue(undefined),
    sendTelegramMessageChunks: vi.fn().mockResolvedValue(undefined),
    sendTelegramQuizPoll: vi.fn(),
    answerTelegramCallbackQuery: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db/jobs', () => ({
    enqueueJob: vi.fn(),
}));

vi.mock('@/lib/db/results', () => ({
    getResultByYoutubeId: vi.fn(),
}));

vi.mock('@/lib/db/quizSessions', () => ({
    createQuizSession: vi.fn(),
    getQuizSession: vi.fn(),
    setQuizSessionIndex: vi.fn(),
    advanceQuizSession: vi.fn(),
    mapPollToSession: vi.fn(),
    getPollMapping: vi.fn(),
}));

vi.mock('@/lib/llm/renderMarkdown', () => ({
    renderNotesMarkdown: vi.fn().mockReturnValue('mock-notes'),
}));

// Mock process.env
const TELEGRAM_SECRET = 'test_secret';
process.env.TELEGRAM_SECRET = TELEGRAM_SECRET;
process.env.TELEGRAM_BOT_TOKEN = 'test_token';

describe('Telegram Quiz Webhook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function createRequest(body: any) {
        return new NextRequest('http://localhost/api/telegram/webhook', {
            method: 'POST',
            headers: {
                'x-telegram-bot-api-secret-token': TELEGRAM_SECRET,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
    }

    it('starts a quiz session on callback_query', async () => {
        const mcq = {
            question: 'What is 2+2?',
            choices: ['3', '4', '5', '6'],
            correctAnswer: '4',
            explanation: 'Basic math.'
        };

        vi.mocked(getResultByYoutubeId).mockResolvedValue({
            markdown: '# Notes',
            quiz_json: { mcq: [mcq] },
            notes_json: {}
        });
        vi.mocked(createQuizSession).mockResolvedValue('session-1');
        vi.mocked(sendTelegramQuizPoll).mockResolvedValue({ pollId: 'poll-1' });

        const req = createRequest({
            update_id: 1,
            callback_query: {
                id: 'cb-1',
                from: { id: 123 },
                message: { chat: { id: 123 } },
                data: 'quiz:start:youtube-1'
            }
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        expect(answerTelegramCallbackQuery).toHaveBeenCalledWith('cb-1', 'Starting quiz…');
        expect(createQuizSession).toHaveBeenCalledWith(123, 'youtube-1');
        expect(sendTelegramQuizPoll).toHaveBeenCalledWith({
            chatId: 123,
            question: mcq.question,
            options: mcq.choices,
            correctOptionIndex: 1,
            explanation: mcq.explanation
        });
        expect(mapPollToSession).toHaveBeenCalledWith('poll-1', 'session-1', 0);
    });

    it('handles poll_answer and sends next question', async () => {
        const mcq1 = { question: 'Q1', choices: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'E1' };
        const mcq2 = { question: 'Q2', choices: ['X', 'Y', 'Z', 'W'], correctAnswer: 'X', explanation: 'E2' };

        vi.mocked(getPollMapping).mockResolvedValue({ session_id: 'session-1', question_index: 0 });
        vi.mocked(getQuizSession).mockResolvedValue({ id: 'session-1', chat_id: 123, youtube_id: 'youtube-1', current_index: 0 });
        vi.mocked(getResultByYoutubeId).mockResolvedValue({
            markdown: '# Notes',
            quiz_json: { mcq: [mcq1, mcq2] },
            notes_json: {}
        });
        vi.mocked(sendTelegramQuizPoll).mockResolvedValue({ pollId: 'poll-2' });
        vi.mocked(advanceQuizSession).mockResolvedValue(true);

        const req = createRequest({
            update_id: 2,
            poll_answer: {
                poll_id: 'poll-1',
                user: { id: 123 },
                option_ids: [0]
            }
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        expect(sendTelegramQuizPoll).toHaveBeenCalledWith({
            chatId: 123,
            question: 'Q2',
            options: ['X', 'Y', 'Z', 'W'],
            correctOptionIndex: 0,
            explanation: 'E2'
        });
        expect(advanceQuizSession).toHaveBeenCalledWith('session-1', 0, 1);
        expect(mapPollToSession).toHaveBeenCalledWith('poll-2', 'session-1', 1);
    });

    it('ignores duplicate poll_answer for already advanced session', async () => {
        vi.mocked(getPollMapping).mockResolvedValue({ session_id: 'session-1', question_index: 0 });
        vi.mocked(getQuizSession).mockResolvedValue({ id: 'session-1', chat_id: 123, youtube_id: 'youtube-1', current_index: 1 });

        const req = createRequest({
            update_id: 4,
            poll_answer: {
                poll_id: 'poll-1',
                user: { id: 123 },
                option_ids: [0]
            }
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(sendTelegramQuizPoll).not.toHaveBeenCalled();
        expect(getResultByYoutubeId).not.toHaveBeenCalled();
    });

    it('completes the quiz on final poll_answer', async () => {
        const mcq1 = { question: 'Q1', choices: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'E1' };

        vi.mocked(getPollMapping).mockResolvedValue({ session_id: 'session-1', question_index: 0 });
        vi.mocked(getQuizSession).mockResolvedValue({ id: 'session-1', chat_id: 123, youtube_id: 'youtube-1', current_index: 0 });
        vi.mocked(getResultByYoutubeId).mockResolvedValue({
            markdown: '# Notes',
            quiz_json: { mcq: [mcq1] },
            notes_json: {}
        });
        vi.mocked(advanceQuizSession).mockResolvedValue(true);

        const req = createRequest({
            update_id: 3,
            poll_answer: {
                poll_id: 'poll-1',
                user: { id: 123 },
                option_ids: [0]
            }
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        expect(sendTelegramMessage).toHaveBeenCalledWith({
            chatId: 123,
            text: 'Quiz complete! ✅ Great job.'
        });
        expect(advanceQuizSession).toHaveBeenCalledWith('session-1', 0, 1);
    });

    it('ignores duplicate poll_answer if advanceQuizSession fails (CAS)', async () => {
        vi.mocked(getPollMapping).mockResolvedValue({ session_id: 'sess-123', question_index: 0 });
        vi.mocked(getQuizSession).mockResolvedValue({ id: 'sess-123', chat_id: 456, youtube_id: 'vid-1', current_index: 0 });
        vi.mocked(getResultByYoutubeId).mockResolvedValue({
            markdown: '# Notes',
            quiz_json: { mcq: [{ question: 'Q0', choices: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'E0' }] },
            notes_json: {}
        });

        // Simulate CAS failure (already advanced)
        vi.mocked(advanceQuizSession).mockResolvedValue(false);

        await POST(createRequest({
            update_id: 200,
            poll_answer: { poll_id: 'poll-0', user: { id: 456 }, option_ids: [0] }
        }));

        expect(sendTelegramQuizPoll).not.toHaveBeenCalled();
        expect(sendTelegramMessage).not.toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('Quiz complete') }));
    });

    it('handles a 3-question quiz sequence completely', async () => {
        const q0 = { question: 'Q0', choices: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'E0' };
        const q1 = { question: 'Q1', choices: ['X', 'Y', 'Z', 'W'], correctAnswer: 'X', explanation: 'E1' };
        const q2 = { question: 'Q2', choices: ['1', '2', '3', '4'], correctAnswer: '1', explanation: 'E2' };
        const mcqs = [q0, q1, q2];

        vi.mocked(getResultByYoutubeId).mockResolvedValue({
            markdown: '# Notes',
            quiz_json: { mcq: mcqs },
            notes_json: {}
        });
        vi.mocked(advanceQuizSession).mockResolvedValue(true);

        // 1. Answer Q0 -> trigger Q1
        vi.mocked(getPollMapping).mockResolvedValue({ session_id: 'sess-123', question_index: 0 });
        vi.mocked(getQuizSession).mockResolvedValue({ id: 'sess-123', chat_id: 456, youtube_id: 'vid-1', current_index: 0 });
        vi.mocked(sendTelegramQuizPoll).mockResolvedValue({ pollId: 'poll-q1' });

        await POST(createRequest({
            update_id: 101,
            poll_answer: { poll_id: 'poll-q0', user: { id: 456 }, option_ids: [0] }
        }));

        expect(sendTelegramQuizPoll).toHaveBeenCalledWith(expect.objectContaining({ question: 'Q1' }));
        expect(advanceQuizSession).toHaveBeenCalledWith('sess-123', 0, 1);

        // 2. Answer Q1 -> trigger Q2
        vi.mocked(getPollMapping).mockResolvedValue({ session_id: 'sess-123', question_index: 1 });
        vi.mocked(getQuizSession).mockResolvedValue({ id: 'sess-123', chat_id: 456, youtube_id: 'vid-1', current_index: 1 });
        vi.mocked(sendTelegramQuizPoll).mockResolvedValue({ pollId: 'poll-q2' });

        await POST(createRequest({
            update_id: 102,
            poll_answer: { poll_id: 'poll-q1', user: { id: 456 }, option_ids: [0] }
        }));

        expect(sendTelegramQuizPoll).toHaveBeenCalledWith(expect.objectContaining({ question: 'Q2' }));
        expect(advanceQuizSession).toHaveBeenCalledWith('sess-123', 1, 2);

        // 3. Answer Q2 -> trigger Finish
        vi.mocked(getPollMapping).mockResolvedValue({ session_id: 'sess-123', question_index: 2 });
        vi.mocked(getQuizSession).mockResolvedValue({ id: 'sess-123', chat_id: 456, youtube_id: 'vid-1', current_index: 2 });

        await POST(createRequest({
            update_id: 103,
            poll_answer: { poll_id: 'poll-q2', user: { id: 456 }, option_ids: [0] }
        }));

        expect(sendTelegramMessage).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('Quiz complete') }));
        expect(advanceQuizSession).toHaveBeenCalledWith('sess-123', 2, 3);
    });

    it('uses renderNotesMarkdown for already_completed message', async () => {
        const { enqueueJob } = await import('@/lib/db/jobs');
        vi.mocked(enqueueJob).mockResolvedValue({ jobId: '', status: 'already_completed' });
        vi.mocked(getResultByYoutubeId).mockResolvedValue({
            markdown: '# Full Markdown',
            quiz_json: { mcq: [] },
            notes_json: { tldr: 'T', outline: [], sections: [] }
        });

        const req = createRequest({
            update_id: 10,
            message: { chat: { id: 123 }, text: 'https://youtube.com/watch?v=dQw4w9WgXcQ' }
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(renderNotesMarkdown).toHaveBeenCalled();
        expect(sendTelegramMessageChunks).toHaveBeenCalledWith(123, 'mock-notes');
    });
});
