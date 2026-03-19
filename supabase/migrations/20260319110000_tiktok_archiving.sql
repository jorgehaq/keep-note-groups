-- Migration: Add status column to tiktok_videos for archiving
-- default 'active', can be 'archived'

ALTER TABLE public.tiktok_videos 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' NOT NULL;

-- Index for performance on tray filtering
CREATE INDEX IF NOT EXISTS idx_tiktok_videos_status ON public.tiktok_videos(status);

-- Update RLS (optional, existing policies are already based on user_id)
