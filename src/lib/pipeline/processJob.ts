import { getYouTubeTranscript } from "../transcript/youtubeTranscript";
import { generateNotesAndQuiz } from "../llm/generateNotesAndQuiz";
import { renderNotesAndQuizMarkdown } from "../llm/renderMarkdown";
import { upsertVideoByYoutubeId } from "../db/videos";
import { upsertTranscript } from "../db/transcripts";
import { upsertResult } from "../db/results";
import { markJobCompleted, markJobFailed } from "../db/jobs";
import { sendTelegramMessage, sendTelegramMessageChunks } from "../telegram";

export async function processJob(job: { jobId: string; youtubeId: string; chatId: number }): Promise<void> {
    const { jobId, youtubeId, chatId } = job;
    try {
        await sendTelegramMessage({ chatId, text: "Fetching transcript…" });
        const transcript = await getYouTubeTranscript(youtubeId);

        const video = await upsertVideoByYoutubeId(youtubeId);
        await upsertTranscript(video.id, "youtube_subtitles", transcript.language || "en", transcript.fullText);

        await sendTelegramMessage({ chatId, text: "Generating notes and quiz…" });
        const result = await generateNotesAndQuiz({ transcriptText: transcript.fullText });

        const markdown = renderNotesAndQuizMarkdown(result);

        // Pass JSON as unknown/any correctly
        await upsertResult(video.id, result, result.quiz, markdown);

        await sendTelegramMessageChunks(chatId, markdown);

        await markJobCompleted(jobId);
    } catch (error: any) {
        // Checking instance of TranscriptNotFoundError generically
        if (error?.name === 'TranscriptNotFoundError' || error?.message?.includes('transcript') || error?.code === 'TRANSCRIPT_NOT_FOUND') {
            await markJobFailed(jobId, error.message);
            await sendTelegramMessage({ chatId, text: "Sorry, I couldn't find a transcript for this video." }).catch(console.error);
        } else {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await markJobFailed(jobId, errorMessage);
            await sendTelegramMessage({ chatId, text: "An error occurred while processing the video." }).catch(console.error);
        }
    }
}
