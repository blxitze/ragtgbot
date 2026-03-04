import { supabase } from '../supabase/serverClient';

export async function upsertVideoByYoutubeId(
    youtubeId: string,
    title?: string
): Promise<{ id: string }> {
    const { data, error } = await supabase
        .from('videos')
        .upsert({ youtube_id: youtubeId, title: title ?? null }, { onConflict: 'youtube_id' })
        .select('id')
        .single();

    if (error) {
        throw new Error(`Failed to upsert video: ${error.message}`);
    }

    return { id: data.id };
}
