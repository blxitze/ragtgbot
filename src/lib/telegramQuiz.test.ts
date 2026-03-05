import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/telegram/webhook/route';
import { NextRequest } from 'next/server';
import { sendTelegramMessage, sendTelegramQuizPoll } from '@/lib/telegram';
import { getResultByYoutubeId } from '@/lib/db/results';
import { createQuizSession, getQuizSession, setQuizSessionIndex, mapPollToSession, getPollMapping } from '@/lib/db/quizSessions';

// Mock dependencies
vi.mock('@/lib/telegram', () => ({
    sendTelegramMessage: vi.fn().mockResolvedValue(undefined),
    sendTelegramMessageChunks: vi.fn().mockResolvedValue(undefined),
    sendTelegramQuizPoll: vi.fn(),
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
    mapPollToSession: vi.fn(),
    getPollMapping: vi.fn(),
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
            quiz_json: { mcq: [mcq] }
        });
        vi.mocked(createQuizSession).mockResolvedValue('session-1');
        vi.mocked(sendTelegramQuizPoll).mockResolvedValue({ pollId: 'poll-1' });

        const req = createRequest({
            update_id: 1,
            callback_query: {
                id: 'cb-1',
                from: { id: 123 },
                data: 'quiz:start:youtube-1'
            }
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

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
        vi.mocked(getQuizSession).mockResolvedValue({ id: 'session-1', chat_id: 123, youtube_id: 'youtube-1' });
        vi.mocked(getResultByYoutubeId).mockResolvedValue({
            markdown: '# Notes',
            quiz_json: { mcq: [mcq1, mcq2] }
        });
        vi.mocked(sendTelegramQuizPoll).mockResolvedValue({ pollId: 'poll-2' });

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
        expect(setQuizSessionIndex).toHaveBeenCalledWith('session-1', 1);
        expect(mapPollToSession).toHaveBeenCalledWith('poll-2', 'session-1', 1);
    });

    it('completes the quiz on final poll_answer', async () => {
        const mcq1 = { question: 'Q1', choices: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'E1' };

        vi.mocked(getPollMapping).mockResolvedValue({ session_id: 'session-1', question_index: 0 });
        vi.mocked(getQuizSession).mockResolvedValue({ id: 'session-1', chat_id: 123, youtube_id: 'youtube-1' });
        vi.mocked(getResultByYoutubeId).mockResolvedValue({
            markdown: '# Notes',
            quiz_json: { mcq: [mcq1] }
        });

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

        expect(sendTelegramQuizPoll).not.toHaveBeenCalled();
        expect(sendTelegramMessage).toHaveBeenCalledWith({
            chatId: 123,
            text: 'Quiz complete! ✅ Great job.'
        });
    });
});
