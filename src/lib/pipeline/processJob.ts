import { getTranscript } from "../transcript/getTranscript";
import { generateNotesAndQuiz } from "../llm/generateNotesAndQuiz";
import { renderNotesAndQuizMarkdown, renderNotesMarkdown } from "../llm/renderMarkdown";
import { upsertVideoByYoutubeId } from "../db/videos";
import { upsertTranscript } from "../db/transcripts";
import { upsertResult } from "../db/results";
import { markJobCompleted, markJobFailed } from "../db/jobs";
import { sendTelegramMessage, sendTelegramMessageChunks } from "../telegram";

export async function processJob(job: { jobId: string; youtubeId: string; chatId: number }): Promise<void> {
    const { jobId, youtubeId, chatId } = job;
    try {
        await sendTelegramMessage({ chatId, text: "Fetching transcript…" });
        const transcript = await getTranscript(youtubeId);

        const video = await upsertVideoByYoutubeId(youtubeId);
        await upsertTranscript(video.id, "youtube_subtitles", transcript.language || "en", transcript.fullText);

        await sendTelegramMessage({ chatId, text: "Generating notes and quiz…" });
        const result = await generateNotesAndQuiz({ transcriptText: transcript.fullText });

        const fullMarkdown = renderNotesAndQuizMarkdown(result);
        const notesMarkdown = renderNotesMarkdown(result);

        await upsertResult(video.id, result, result.quiz, fullMarkdown);

        await sendTelegramMessageChunks(chatId, notesMarkdown);

        // Send a dedicated message with the "Start Quiz" button
        await sendTelegramMessage({
            chatId,
            text: "Ready to test your knowledge?",
            replyMarkup: {
                inline_keyboard: [[
                    { text: "🚀 Start Quiz", callback_data: `quiz:start:${youtubeId}` }
                ]]
            }
        });

        await markJobCompleted(jobId);
    } catch (error: unknown) {
        const isError = error instanceof Error;
        const errorName = isError ? error.name : "UnknownError";
        const rawMessage = isError ? error.message : String(error);
        const safeMessage = rawMessage.slice(0, 500);

        console.error("[processJob] Failed:", { jobId, youtubeId, errorName, safeMessage });

        if (isError && (error.name === 'TranscriptNotFoundError' || rawMessage.toLowerCase().includes('transcript'))) {
            await markJobFailed(jobId, safeMessage);
            await sendTelegramMessage({ chatId, text: "Sorry, I couldn't find a transcript for this video." }).catch(console.error);
        } else {
            await markJobFailed(jobId, safeMessage);
            await sendTelegramMessage({ chatId, text: "An error occurred while processing the video." }).catch(console.error);
        }
    }
}
