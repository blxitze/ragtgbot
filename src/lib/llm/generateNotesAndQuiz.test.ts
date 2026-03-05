import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateNotesAndQuiz } from './generateNotesAndQuiz';
import * as openaiClient from './openaiClient';

vi.mock('./openaiClient', () => ({
    callOpenAI: vi.fn(),
}));

describe('generateNotesAndQuiz', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return valid NotesAndQuiz for short transcript', async () => {
        const validJson = JSON.stringify({
            tldr: "Short test tldr",
            outline: ["Topic 1"],
            sections: [{ title: "Topic 1", content: ["Detail 1"] }],
            quiz: {
                mcq: Array(5).fill({ question: "Q1", choices: ["A", "B", "C", "D"], correctAnswer: "A", explanation: "Exp" }),
                tf: Array(5).fill({ question: "True?", correctAnswer: true, explanation: "Exp 2" }),
                short: Array(3).fill({ question: "Short Q?", suggestedAnswer: "Ans" })
            }
        });

        vi.mocked(openaiClient.callOpenAI).mockResolvedValue(validJson);

        const result = await generateNotesAndQuiz({ transcriptText: 'A short test text' });
        expect(result.tldr).toBe('Short test tldr');
        expect(openaiClient.callOpenAI).toHaveBeenCalledTimes(1);
    });

    it('should throw Error if OpenAI returns invalid JSON schema', async () => {
        const invalidJson = JSON.stringify({
            tldr: "Short test tldr",
            outline: [], // invalid, needs at least 1 item
            sections: [], // invalid
            quiz: {} // invalid
        });

        vi.mocked(openaiClient.callOpenAI).mockResolvedValue(invalidJson);

        await expect(generateNotesAndQuiz({ transcriptText: 'A short test text' }))
            .rejects
            .toThrow(/Failed to generate valid NotesAndQuiz JSON/);
    });

    it('should use map-reduce for long transcripts over chunk threshold', async () => {
        const validJson = JSON.stringify({
            tldr: "Long test tldr",
            outline: ["Topic 1"],
            sections: [{ title: "Topic 1", content: ["Detail 1"] }],
            quiz: {
                mcq: Array(5).fill({ question: "Q1", choices: ["A", "B", "C", "D"], correctAnswer: "A", explanation: "Exp" }),
                tf: Array(5).fill({ question: "True?", correctAnswer: true, explanation: "Exp 2" }),
                short: Array(3).fill({ question: "Short Q?", suggestedAnswer: "Ans" })
            }
        });

        // 13000 chars text. Chunks: 0-6000, 5000-11000, 10000-16000
        // => 3 map calls, 1 reduce call
        const longText = 'A'.repeat(13000);

        vi.mocked(openaiClient.callOpenAI).mockImplementation(async (sys: string, prompt: string) => {
            if (prompt.includes('summarize the following transcript chunk')) {
                return JSON.stringify({ summary: "chunk sum", keyPoints: [], terms: [] });
            }
            if (prompt.includes('Here are the sequential summaries')) {
                return validJson;
            }
            return validJson; // fallback
        });

        const result = await generateNotesAndQuiz({ transcriptText: longText });

        expect(result.tldr).toBe("Long test tldr");
        expect(openaiClient.callOpenAI).toHaveBeenCalledTimes(4); // 3 maps + 1 reduce
    });

    it('should retry generation up to 2 times if validation fails (quantity)', async () => {
        const invalidJson = JSON.stringify({
            tldr: "T",
            outline: ["O"],
            sections: [{ title: "S", content: ["C"] }],
            quiz: {
                mcq: [], // Invalid: too few
                tf: [],
                short: []
            }
        });

        const validJson = JSON.stringify({
            tldr: "Success",
            outline: ["O"],
            sections: [{ title: "S", content: ["C"] }],
            quiz: {
                mcq: Array(5).fill({ question: "Q", choices: ["1", "2", "3", "4"], correctAnswer: "1", explanation: "Exp" }),
                tf: Array(5).fill({ question: "T", correctAnswer: true, explanation: "Exp" }),
                short: Array(3).fill({ question: "S", suggestedAnswer: "Ans" })
            }
        });

        // 1st attempt fails, 2nd attempt succeeds
        vi.mocked(openaiClient.callOpenAI)
            .mockResolvedValueOnce(invalidJson)
            .mockResolvedValueOnce(validJson);

        const result = await generateNotesAndQuiz({ transcriptText: 'Short text' });

        expect(result.tldr).toBe('Success');
        expect(openaiClient.callOpenAI).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries exhausted', async () => {
        const invalidJson = JSON.stringify({
            tldr: "T",
            outline: ["O"],
            sections: [{ title: "S", content: ["C"] }],
            quiz: { mcq: [], tf: [], short: [] }
        });

        vi.mocked(openaiClient.callOpenAI).mockResolvedValue(invalidJson);

        await expect(generateNotesAndQuiz({ transcriptText: 'Short text' }))
            .rejects
            .toThrow(/after 3 attempts/); // 0, 1, 2 makes it 3 total attempts

        expect(openaiClient.callOpenAI).toHaveBeenCalledTimes(3);
    });
});
