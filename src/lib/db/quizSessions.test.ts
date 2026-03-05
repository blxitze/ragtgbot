import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createQuizSession } from './quizSessions';
import { supabase } from '../supabase/serverClient';

vi.mock('../supabase/serverClient', () => ({
    supabase: {
        from: vi.fn(),
    }
}));

describe('createQuizSession', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses upsert to be idempotent and targets chat_id,youtube_id', async () => {
        const mockUpsert = {
            upsert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'session-123' }, error: null })
        };
        vi.mocked(supabase.from).mockReturnValue(mockUpsert as any);

        const id = await createQuizSession(123, 'vid-1');

        expect(id).toBe('session-123');
        expect(supabase.from).toHaveBeenCalledWith('quiz_sessions');
        expect(mockUpsert.upsert).toHaveBeenCalledWith(
            { chat_id: 123, youtube_id: 'vid-1', current_index: 0 },
            { onConflict: 'chat_id,youtube_id' }
        );
    });

    it('throws error if upsert fails', async () => {
        const mockUpsert = {
            upsert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } })
        };
        vi.mocked(supabase.from).mockReturnValue(mockUpsert as any);

        await expect(createQuizSession(123, 'vid-1')).rejects.toThrow('[db] Failed to create or update quiz session: DB Error');
    });
});
