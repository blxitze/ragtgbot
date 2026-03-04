import { supabase } from '../supabase/serverClient';

export async function upsertTranscript(
    videoId: string,
    source: string,
    language: string | null,
    fullText: string
): Promise<void> {
    const { error } = await supabase
        .from('transcripts')
        .upsert(
            {
                video_id: videoId,
                source: source,
                language: language,
                full_text: fullText
            },
            { onConflict: 'video_id,source' }
        );

    if (error) {
        throw new Error(`Failed to upsert transcript: ${error.message}`);
    }
}
