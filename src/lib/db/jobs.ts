import { supabase } from '../supabase/serverClient';
import { upsertVideoByYoutubeId } from './videos';
import { getResultByYoutubeId } from './results';

export async function enqueueJob(
    chatId: number,
    youtubeId: string
): Promise<{ jobId: string; status: 'enqueued' | 'already_processing' | 'already_completed' }> {
    // a) Upsert the video row
    const video = await upsertVideoByYoutubeId(youtubeId);

    // b) Check if result already exists
    const existingResult = await getResultByYoutubeId(youtubeId);
    if (existingResult) {
        return { jobId: '', status: 'already_completed' };
    }

    // c) Else create the job with dedupe_key (handled by database schema). 
    // But we need to insert manually to capture the job ID
    const { data, error } = await supabase
        .from('jobs')
        .insert({
            video_id: video.id,
            youtube_id: youtubeId,
            chat_id: chatId,
            status: 'pending'
        })
        .select('id')
        .single();

    // Handle unique constraint conflict (error 23505)
    if (error) {
        if (error.code === '23505') {
            // Meaning a job already exists for this chat_id + youtube_id
            // Check if it's failed to allow retrying
            const { data: existingJob } = await supabase
                .from('jobs')
                .select('id, status')
                .eq('chat_id', chatId)
                .eq('youtube_id', youtubeId)
                .single();

            if (existingJob?.status === 'failed') {
                const { error: updateErr } = await supabase
                    .from('jobs')
                    .update({
                        status: 'pending',
                        attempt_count: 0,
                        error_message: null
                    })
                    .eq('id', existingJob.id);

                if (!updateErr) return { jobId: existingJob.id, status: 'enqueued' };
            }

            return { jobId: '', status: 'already_processing' };
        }
        throw new Error(`Failed to enqueue job: ${error.message}`);
    }

    return { jobId: data.id, status: 'enqueued' };
}

export async function claimNextPendingJob(): Promise<{ jobId: string; youtubeId: string; chatId: number } | null> {
    const { data, error } = await supabase.rpc('claim_next_job');

    if (error) {
        throw new Error(`Failed to claim next job: ${error.message}`);
    }

    // Data will be an array of objects representing the returned table from PL/pgSQL
    if (!data || data.length === 0) {
        return null;
    }

    const job = data[0];
    return {
        jobId: job.id,
        youtubeId: job.youtube_id,
        chatId: job.chat_id
    };
}

export async function markJobCompleted(jobId: string): Promise<void> {
    const { error } = await supabase
        .from('jobs')
        .update({ status: 'completed' })
        .eq('id', jobId);

    if (error) {
        throw new Error(`Failed to mark job completed: ${error.message}`);
    }
}

export async function markJobFailed(jobId: string, errorMessage: string): Promise<void> {
    const { error } = await supabase
        .from('jobs')
        .update({
            status: 'failed',
            error_message: errorMessage
        })
        .eq('id', jobId);

    if (error) {
        throw new Error(`Failed to mark job failed: ${error.message}`);
    }
}
