/**
 * src/lib/db/quizSessions.ts
 *
 * DB helpers for managing Telegram quiz sessions and poll mappings.
 */

import { supabase } from '../supabase/serverClient';

export async function createQuizSession(chatId: number, youtubeId: string): Promise<string> {
    // Upsert to reuse session if it already exists for this chat and video
    const { data, error } = await supabase
        .from('quiz_sessions')
        .upsert(
            { chat_id: chatId, youtube_id: youtubeId, current_index: 0 },
            { onConflict: 'chat_id,youtube_id' }
        )
        .select('id')
        .single();

    if (error) {
        throw new Error(`[db] Failed to create or update quiz session: ${error.message}`);
    }

    return data.id;
}

export async function getQuizSession(sessionId: string) {
    const { data, error } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

    if (error) {
        throw new Error(`[db] Failed to get quiz session: ${error.message}`);
    }

    return data;
}

export async function setQuizSessionIndex(sessionId: string, nextIndex: number): Promise<void> {
    const { error } = await supabase
        .from('quiz_sessions')
        .update({ current_index: nextIndex })
        .eq('id', sessionId);

    if (error) {
        throw new Error(`[db] Failed to update quiz session index: ${error.message}`);
    }
}

/**
 * Atomically advances the session index only if it matches expectedIndex.
 * Returns true if the update was successful (atomic lock acquired).
 */
export async function advanceQuizSession(sessionId: string, expectedIndex: number, nextIndex: number): Promise<boolean> {
    const { data, error } = await supabase
        .from('quiz_sessions')
        .update({ current_index: nextIndex })
        .match({ id: sessionId, current_index: expectedIndex })
        .select('id');

    if (error) {
        throw new Error(`[db] Failed to advance quiz session: ${error.message}`);
    }

    return (data?.length ?? 0) > 0;
}

export async function mapPollToSession(pollId: string, sessionId: string, questionIndex: number): Promise<void> {
    const { error } = await supabase
        .from('quiz_polls')
        .insert({
            poll_id: pollId,
            session_id: sessionId,
            question_index: questionIndex
        });

    if (error) {
        throw new Error(`[db] Failed to map poll to session: ${error.message}`);
    }
}

export async function getPollMapping(pollId: string) {
    const { data, error } = await supabase
        .from('quiz_polls')
        .select('session_id, question_index')
        .eq('poll_id', pollId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(`[db] Failed to get poll mapping: ${error.message}`);
    }

    return data;
}
