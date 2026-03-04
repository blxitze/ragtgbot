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

export async function getResultByYoutubeId(youtubeId: string): Promise<{ markdown: string } | null> {
    // We need to join over to `videos` table to query by youtube_id
    const { data, error } = await supabase
        .from('videos')
        .select(`
      id,
      youtube_id,
      results (
        markdown
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

    // Supabase returns related table as an array if it's a one-to-many, 
    // but since our fk is ON DELETE CASCADE UNIQUE it might return exactly object or array depending on PostgREST type generation. 
    // We'll safely parse the array if PostgREST interprets it as an array or object.
    const resultRelation = data?.results;
    if (!resultRelation) {
        return null;
    }

    if (Array.isArray(resultRelation)) {
        if (resultRelation.length === 0) return null;
        return { markdown: resultRelation[0].markdown };
    } else {
        // PostgREST single
        return { markdown: (resultRelation as { markdown: string }).markdown };
    }
}
