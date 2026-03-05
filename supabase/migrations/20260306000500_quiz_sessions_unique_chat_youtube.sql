-- Add unique constraint to quiz_sessions for reliable upsert
ALTER TABLE public.quiz_sessions
ADD CONSTRAINT quiz_sessions_chat_youtube_unique UNIQUE (chat_id, youtube_id);
