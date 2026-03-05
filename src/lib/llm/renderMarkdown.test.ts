import { describe, it, expect } from 'vitest';
import { renderNotesMarkdown } from './renderMarkdown';
import { NotesAndQuiz } from './types';

describe('renderNotesMarkdown', () => {
    const mockData: NotesAndQuiz = {
        tldr: 'Summary text',
        outline: ['Item 1', 'Item 2'],
        sections: [
            {
                title: 'Section 1',
                content: ['Paragraph 1'],
                definitions: [{ term: 'Term', definition: 'Def' }],
                examples: ['Ex 1']
            }
        ],
        quiz: {
            mcq: [
                {
                    question: 'Q1',
                    choices: ['A', 'B', 'C', 'D'],
                    correctAnswer: 'A',
                    explanation: 'E1'
                }
            ],
            tf: [],
            short: []
        }
    };

    it('renders TL;DR, Outline, and Sections', () => {
        const result = renderNotesMarkdown(mockData);
        expect(result).toContain('## TL;DR');
        expect(result).toContain('Summary text');
        expect(result).toContain('## Outline');
        expect(result).toContain('Item 1');
        expect(result).toContain('### Section 1');
        expect(result).toContain('Paragraph 1');
        expect(result).toContain('**Key Terms:**');
        expect(result).toContain('**Examples:**');
    });

    it('strictly excludes quiz content', () => {
        const result = renderNotesMarkdown(mockData);
        expect(result).not.toContain('## Quiz');
        expect(result).not.toContain('Multiple Choice');
        expect(result).not.toContain('Q1');
        expect(result).not.toContain('Reveal Answer');
        expect(result).not.toContain('Correct Answer:');
    });
});
