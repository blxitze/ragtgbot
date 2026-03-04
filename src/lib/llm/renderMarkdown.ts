import { NotesAndQuiz } from './types';

export function renderNotesAndQuizMarkdown(data: NotesAndQuiz): string {
    const { tldr, outline, sections, quiz } = data;

    let md = '';

    // TL;DR
    md += `## TL;DR\n${tldr}\n\n`;

    // Outline
    md += `## Outline\n`;
    for (const item of outline) {
        md += `- ${item}\n`;
    }
    md += '\n';

    // Sections
    for (const sec of sections) {
        md += `### ${sec.title}\n\n`;
        for (const p of sec.content) {
            md += `- ${p}\n`;
        }

        if (sec.definitions && sec.definitions.length > 0) {
            md += `\n**Key Terms:**\n`;
            for (const def of sec.definitions) {
                md += `- **${def.term}**: ${def.definition}\n`;
            }
        }

        if (sec.examples && sec.examples.length > 0) {
            md += `\n**Examples:**\n`;
            for (const ex of sec.examples) {
                md += `- ${ex}\n`;
            }
        }
        md += '\n';
    }

    // Quiz
    md += `## Quiz\n\n`;

    if (quiz.mcq && quiz.mcq.length > 0) {
        md += `### Multiple Choice\n`;
        quiz.mcq.forEach((q, i) => {
            md += `**Q${i + 1}. ${q.question}**\n`;
            q.choices.forEach((c, j) => {
                md += `  ${String.fromCharCode(65 + j)}. ${c}\n`;
            });
            md += `\n<details><summary>Reveal Answer</summary>\n\n**Correct Answer:** ${q.correctAnswer}\n\n**Explanation:** ${q.explanation}\n</details>\n\n`;
        });
    }

    if (quiz.tf && quiz.tf.length > 0) {
        md += `### True / False\n`;
        quiz.tf.forEach((q, i) => {
            md += `**Q${i + 1}. ${q.question}**\n`;
            md += `\n<details><summary>Reveal Answer</summary>\n\n**Correct Answer:** ${q.correctAnswer ? 'True' : 'False'}\n\n**Explanation:** ${q.explanation}\n</details>\n\n`;
        });
    }

    if (quiz.short && quiz.short.length > 0) {
        md += `### Short Answer\n`;
        quiz.short.forEach((q, i) => {
            md += `**Q${i + 1}. ${q.question}**\n`;
            md += `\n<details><summary>Reveal Answer</summary>\n\n**Suggested Answer:** ${q.suggestedAnswer}\n</details>\n\n`;
        });
    }

    return md.trim();
}
