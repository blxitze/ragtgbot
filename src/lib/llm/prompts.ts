export const systemPrompt = `You are an expert educator and note-taker. Use strictly ONLY the provided transcript or chunks to generate your response. Do not include any outside information. Your output MUST be strictly valid JSON and match the requested schema exactly. Do not add markdown formatting like \`\`\`json around the output, return just the raw JSON string.`;

export const mapPrompt = (chunkText: string) => `Please summarize the following transcript chunk. Extract key points, important terms with their definitions, and main ideas.

Transcript chunk:
${chunkText}

Return a compact JSON object with exactly this structure:
{
  "summary": "A brief summary of this chunk",
  "keyPoints": ["bullet point 1", "bullet point 2"],
  "terms": [{"term": "concept name", "definition": "what it means"}]
}`;

export const reducePrompt = (title: string | undefined, summaries: string) => `We have a transcript${title ? ` titled "${title}"` : ''}. Here are the sequential summaries of its chunks:

${summaries}

Please synthesize these into a comprehensive and cohesive NotesAndQuiz JSON object. 
Make sure the output strictly adheres to the schema:
- tldr: A short overall summary of the entire transcript.
- outline: An array of main topics covered.
- sections: An array of detailed sections. Each section must have:
  - title: The section title.
  - content: An array of bullet points containing the details.
  - definitions: (Optional) Array of { "term": string, "definition": string }.
  - examples: (Optional) Array of example strings.
- quiz: A quiz covering all the chunks, containing:
  - mcq: Array of at least one multiple choice question { "question": string, "choices": [string, string, string, string], "correctAnswer": string, "explanation": string }. "choices" MUST have exactly 4 items.
  - tf: Array of at least one true/false question { "question": string, "correctAnswer": boolean, "explanation": string }.
  - short: Array of at least one short answer question { "question": string, "suggestedAnswer": string }.

Output valid JSON only.`;

export const singlePassPrompt = (title: string | undefined, transcriptText: string) => `We have a transcript${title ? ` titled "${title}"` : ''}. 

Transcript:
${transcriptText}

Please generate comprehensive notes and a quiz based strictly on this transcript. Return a NotesAndQuiz JSON object.
Make sure the output strictly adheres to the schema:
- tldr: A short overall summary of the entire transcript.
- outline: An array of main topics covered.
- sections: An array of detailed sections. Each section must have:
  - title: The section title.
  - content: An array of bullet points containing the details.
  - definitions: (Optional) Array of { "term": string, "definition": string }.
  - examples: (Optional) Array of example strings.
- quiz: A quiz containing:
  - mcq: Array of at least one multiple choice question { "question": string, "choices": [string, string, string, string], "correctAnswer": string, "explanation": string }. "choices" MUST have exactly 4 items.
  - tf: Array of at least one true/false question { "question": string, "correctAnswer": boolean, "explanation": string }.
  - short: Array of at least one short answer question { "question": string, "suggestedAnswer": string }.

Output valid JSON only.`;
