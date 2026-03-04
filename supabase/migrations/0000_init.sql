-- SQL schema
-- A) videos
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youtube_id TEXT NOT NULL UNIQUE,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B) transcripts
CREATE TABLE transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    language TEXT,
    full_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(video_id, source)
);

-- C) results
CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE UNIQUE,
    notes_json JSONB NOT NULL,
    quiz_json JSONB NOT NULL,
    markdown TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- D) jobs
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    youtube_id TEXT NOT NULL,
    chat_id BIGINT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempt_count INT NOT NULL DEFAULT 0,
    locked_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    dedupe_key TEXT GENERATED ALWAYS AS (chat_id::TEXT || ':' || youtube_id) STORED UNIQUE
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_results_modtime
    BEFORE UPDATE ON results
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_jobs_modtime
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- RPC for claimNextPendingJob
CREATE OR REPLACE FUNCTION claim_next_job()
RETURNS TABLE (
    id UUID,
    video_id UUID,
    youtube_id TEXT,
    chat_id BIGINT,
    status TEXT,
    attempt_count INT,
    locked_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    dedupe_key TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    claimed_job_id UUID;
BEGIN
    SELECT jobs.id INTO claimed_job_id
    FROM jobs
    WHERE jobs.status = 'pending'
    ORDER BY jobs.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF claimed_job_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    UPDATE jobs
    SET 
        status = 'processing',
        locked_at = now(),
        attempt_count = jobs.attempt_count + 1,
        updated_at = now()
    WHERE jobs.id = claimed_job_id
    RETURNING 
        jobs.id,
        jobs.video_id,
        jobs.youtube_id,
        jobs.chat_id,
        jobs.status,
        jobs.attempt_count,
        jobs.locked_at,
        jobs.error_message,
        jobs.created_at,
        jobs.updated_at,
        jobs.dedupe_key;
END;
$$;

-- Index to optimize job polling
CREATE INDEX idx_jobs_pending ON jobs (created_at) WHERE status = 'pending';
