/*
  supabase/migrations/0002_quiz_flow.sql
*/

CREATE TABLE IF NOT EXISTS quiz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id BIGINT NOT NULL,
    youtube_id TEXT NOT NULL,
    current_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_polls (
    poll_id TEXT PRIMARY KEY,
    session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    question_index INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_quiz_sessions_chat_youtube ON quiz_sessions(chat_id, youtube_id);
CREATE INDEX idx_quiz_polls_session ON quiz_polls(session_id);
