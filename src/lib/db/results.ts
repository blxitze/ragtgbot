import { supabase } from '../supabase/serverClient';

export async function upsertResult(
    videoId: string,
    notesJson: unknown,
    quizJson: unknown,
    markdown: string
): Promise<void> {
    const { error } = await supabase
        .from('results')
        .upsert(
            {
                video_id: videoId,
                notes_json: notesJson,
                quiz_json: quizJson,
                markdown: markdown
            },
            { onConflict: 'video_id' }
        );

    if (error) {
        throw new Error(`Failed to upsert result: ${error.message}`);
    }
}

export async function getResultByYoutubeId(youtubeId: string): Promise<{ markdown: string; quiz_json: any } | null> {
    // We need to join over to `videos` table to query by youtube_id
    const { data, error } = await supabase
        .from('videos')
        .select(`
      id,
      youtube_id,
      results (
        markdown,
        quiz_json
      )
    `)
        .eq('youtube_id', youtubeId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null;
        }
        throw new Error(`Error fetching result: ${error.message}`);
    }

    const resultRelation = data?.results;
    if (!resultRelation) {
        return null;
    }

    const res = Array.isArray(resultRelation) ? resultRelation[0] : resultRelation;
    if (!res) return null;

    return {
        markdown: (res as any).markdown,
        quiz_json: (res as any).quiz_json
    };
}
