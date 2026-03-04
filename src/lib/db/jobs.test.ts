import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enqueueJob } from './jobs';
import * as videosDb from './videos';
import * as resultsDb from './results';
import { supabase } from '../supabase/serverClient';

vi.mock('./videos');
vi.mock('./results');
vi.mock('../supabase/serverClient', () => ({
    supabase: {
        from: vi.fn(),
    }
}));

describe('enqueueJob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const MOCK_YOUTUBE_ID = 'test-vid-123';
    const MOCK_CHAT_ID = 111222;
    const MOCK_DB_VIDEO_ID = '00000000-0000-0000-0000-000000000001';

    it('returns already_completed if result exists', async () => {
        vi.mocked(videosDb.upsertVideoByYoutubeId).mockResolvedValue({ id: MOCK_DB_VIDEO_ID });
        vi.mocked(resultsDb.getResultByYoutubeId).mockResolvedValue({ markdown: 'Some notes' });

        const result = await enqueueJob(MOCK_CHAT_ID, MOCK_YOUTUBE_ID);

        expect(result.status).toBe('already_completed');
        expect(result.jobId).toBe('');
        expect(videosDb.upsertVideoByYoutubeId).toHaveBeenCalledWith(MOCK_YOUTUBE_ID);
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('returns enqueued on successful job creation', async () => {
        vi.mocked(videosDb.upsertVideoByYoutubeId).mockResolvedValue({ id: MOCK_DB_VIDEO_ID });
        vi.mocked(resultsDb.getResultByYoutubeId).mockResolvedValue(null);

        const mockInsertSelectSingle = {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'job-123' }, error: null })
        };
        vi.mocked(supabase.from).mockReturnValue(mockInsertSelectSingle as unknown as ReturnType<typeof supabase.from>);

        const result = await enqueueJob(MOCK_CHAT_ID, MOCK_YOUTUBE_ID);

        expect(result.status).toBe('enqueued');
        expect(result.jobId).toBe('job-123');
    });

    it('returns already_processing on unique constraint violation (duplicate key) if job is processing', async () => {
        vi.mocked(videosDb.upsertVideoByYoutubeId).mockResolvedValue({ id: MOCK_DB_VIDEO_ID });
        vi.mocked(resultsDb.getResultByYoutubeId).mockResolvedValue(null);

        const mockError = { code: '23505', message: 'duplicate key value violates unique constraint' };

        // Setup a complex mock for insert vs select
        vi.mocked(supabase.from).mockImplementation((table: string) => {
            return {
                insert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
                    })
                }),
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: { id: 'existing-job', status: 'processing' }, error: null })
                        })
                    })
                })
            } as unknown as ReturnType<typeof supabase.from>;
        });

        const result = await enqueueJob(MOCK_CHAT_ID, MOCK_YOUTUBE_ID);

        expect(result.status).toBe('already_processing');
        expect(result.jobId).toBe('');
    });

    it('returns enqueued if unique constraint hit but job is failed (retries automatically)', async () => {
        vi.mocked(videosDb.upsertVideoByYoutubeId).mockResolvedValue({ id: MOCK_DB_VIDEO_ID });
        vi.mocked(resultsDb.getResultByYoutubeId).mockResolvedValue(null);

        const mockError = { code: '23505', message: 'duplicate key value violates unique constraint' };

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            return {
                insert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
                    })
                }),
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: { id: 'failed-job', status: 'failed' }, error: null })
                        })
                    })
                }),
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null })
                })
            } as unknown as ReturnType<typeof supabase.from>;
        });

        const result = await enqueueJob(MOCK_CHAT_ID, MOCK_YOUTUBE_ID);

        expect(result.status).toBe('enqueued');
        expect(result.jobId).toBe('failed-job');
    });

    it('throws an Error if insert fails with unknown error', async () => {
        vi.mocked(videosDb.upsertVideoByYoutubeId).mockResolvedValue({ id: MOCK_DB_VIDEO_ID });
        vi.mocked(resultsDb.getResultByYoutubeId).mockResolvedValue(null);

        const mockError = { code: '50000', message: 'Internal Server Error' };
        const mockInsertSelectSingle = {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: mockError })
        };
        vi.mocked(supabase.from).mockReturnValue(mockInsertSelectSingle as unknown as ReturnType<typeof supabase.from>);

        await expect(enqueueJob(MOCK_CHAT_ID, MOCK_YOUTUBE_ID))
            .rejects
            .toThrow(/Failed to enqueue job: Internal Server Error/);
    });
});
