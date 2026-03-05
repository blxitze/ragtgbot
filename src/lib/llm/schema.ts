import { z } from 'zod';

const mcqSchema = z.object({
    question: z.string().min(1),
    choices: z.array(z.string().min(1)).length(4),
    correctAnswer: z.string().min(1),
    explanation: z.string().min(1),
});

const tfSchema = z.object({
    question: z.string().min(1),
    correctAnswer: z.boolean(),
    explanation: z.string().min(1),
});

const shortQSchema = z.object({
    question: z.string().min(1),
    suggestedAnswer: z.string().min(1),
});

const quizSchema = z.object({
    mcq: z.array(mcqSchema).length(5),
    tf: z.array(tfSchema).length(5),
    short: z.array(shortQSchema).length(3),
});

const definitionSchema = z.object({
    term: z.string().min(1),
    definition: z.string().min(1),
});

const sectionSchema = z.object({
    title: z.string().min(1),
    content: z.array(z.string().min(1)).min(1),
    definitions: z.array(definitionSchema).optional(),
    examples: z.array(z.string().min(1)).optional(),
});

export const notesAndQuizSchema = z.object({
    tldr: z.string().min(1),
    outline: z.array(z.string().min(1)).min(1),
    sections: z.array(sectionSchema).min(1),
    quiz: quizSchema,
});
