import { describe, it, expect } from 'vitest';
import { splitTelegramMessage } from './telegramSplit';

describe('splitTelegramMessage', () => {
    it('returns empty array for empty string', () => {
        expect(splitTelegramMessage('')).toEqual([]);
    });

    it('does not split if under maxLen', () => {
        expect(splitTelegramMessage('hello', 10)).toEqual(['hello']);
    });

    it('splits on double newline', () => {
        const text = 'first part\n\nsecond part';
        const chunks = splitTelegramMessage(text, 15);
        expect(chunks).toEqual(['first part', 'second part']);
    });

    it('splits on single newline if no double newline', () => {
        const text = 'first part\nsecond part';
        const chunks = splitTelegramMessage(text, 15);
        expect(chunks).toEqual(['first part', 'second part']);
    });

    it('splits on space if no newlines', () => {
        const text = 'first part second part';
        const chunks = splitTelegramMessage(text, 15);
        expect(chunks).toEqual(['first part', 'second part']);
    });

    it('forces split if no spaces or newlines', () => {
        const text = '12345678901234567890';
        const chunks = splitTelegramMessage(text, 10);
        expect(chunks).toEqual(['1234567890', '1234567890']);
    });

    it('skips empty chunks', () => {
        const text = 'hello\n\n\nworld';
        const chunks = splitTelegramMessage(text, 10);
        expect(chunks).toEqual(['hello\n', 'world']);
    });
});
