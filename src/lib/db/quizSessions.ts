/**
 * src/lib/db/quizSessions.ts
 *
 * DB helpers for managing Telegram quiz sessions and poll mappings.
 */

import { supabase } from '../supabase/serverClient';

export async function createQuizSession(chatId: number, youtubeId: string): Promise<string> {
    const { data, error } = await supabase
        .from('quiz_sessions')
        .insert({
            chat_id: chatId,
            youtube_id: youtubeId,
            current_index: 0
        })
        .select('id')
        .single();

    if (error) {
        throw new Error(`[db] Failed to create quiz session: ${error.message}`);
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
