-- Add hierarchy support to tiktok_videos
ALTER TABLE public.tiktok_videos
  ADD COLUMN IF NOT EXISTS parent_id         uuid REFERENCES public.tiktok_videos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS generation_level integer DEFAULT 0;

ALTER TABLE public.tiktok_queue
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.tiktok_videos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tiktok_videos_parent ON public.tiktok_videos(parent_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_queue_parent  ON public.tiktok_queue(parent_id);
