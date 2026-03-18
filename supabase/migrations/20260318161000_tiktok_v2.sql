-- TikTok v2 Migration: schema update and Realtime activation

ALTER TABLE public.tiktok_videos
  ADD COLUMN IF NOT EXISTS content      text DEFAULT '',
  ADD COLUMN IF NOT EXISTS scratchpad   text DEFAULT '',
  ADD COLUMN IF NOT EXISTS status       text DEFAULT 'inbox',
  ADD COLUMN IF NOT EXISTS ai_summary_status text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS description  text;

-- Ensure status is one of the allowed values
-- ALTER TABLE public.tiktok_videos ADD CONSTRAINT status_check CHECK (status IN ('inbox', 'active', 'archived'));
-- ALTER TABLE public.tiktok_videos ADD CONSTRAINT ai_summary_status_check CHECK (ai_summary_status IN ('idle', 'queued', 'processing', 'done', 'error'));

-- Habilitar Realtime
-- Note: In Supabase, you add tables to the 'supabase_realtime' publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'tiktok_videos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tiktok_videos;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'tiktok_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tiktok_queue;
  END IF;
END $$;
