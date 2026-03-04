import { NotesAndQuiz } from './types';
import { notesAndQuizSchema } from './schema';
import { systemPrompt, singlePassPrompt, mapPrompt, reducePrompt } from './prompts';
import { callOpenAI } from './openaiClient';

const CHUNK_THRESHOLD = 12000;
const CHUNK_SIZE = 6000;
const CHUNK_OVERLAP = 1000;

export async function generateNotesAndQuiz(input: {
    title?: string;
    transcriptText: string;
}): Promise<NotesAndQuiz> {
    const { title, transcriptText } = input;

    let rawJsonOutput: string;

    if (transcriptText.length <= CHUNK_THRESHOLD) {
        // Single-pass generation
        const prompt = singlePassPrompt(title, transcriptText);
        rawJsonOutput = await callOpenAI(systemPrompt, prompt);
    } else {
        // Map-reduce generation
        const chunks = chunkText(transcriptText, CHUNK_SIZE, CHUNK_OVERLAP);
        const chunkSummaries: string[] = [];

        for (const chunk of chunks) {
            const cPrompt = mapPrompt(chunk);
            const res = await callOpenAI(systemPrompt, cPrompt);
            chunkSummaries.push(res);
        }

        // Reduce
        const combinedSummaries = chunkSummaries.map((s, i) => `Chunk ${i + 1}:\n${s}`).join('\n\n');
        const rPrompt = reducePrompt(title, combinedSummaries);
        rawJsonOutput = await callOpenAI(systemPrompt, rPrompt);
    }

    // Parse and validate
    try {
        const cleanJson = rawJsonOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        const validated = notesAndQuizSchema.parse(parsed) as NotesAndQuiz;
        return validated;
    } catch (error) {
        throw new Error(`Failed to generate valid NotesAndQuiz JSON from transcript. Validation error: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function chunkText(text: string, size: number, overlap: number): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + size));
        i += size - overlap;
    }
    return chunks;
}
