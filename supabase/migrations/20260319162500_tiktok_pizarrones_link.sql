-- Migration: Add tiktok_video_id to brain_dumps
-- This allows linking brain dumps (pizarrones) to TikTok videos for contextual AI analysis.

ALTER TABLE public.brain_dumps 
ADD COLUMN IF NOT EXISTS tiktok_video_id uuid REFERENCES public.tiktok_videos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_brain_dumps_tiktok_video_id ON public.brain_dumps(tiktok_video_id);

-- Update RLS for brain_dumps to allow managing linked pizarrones
DROP POLICY IF EXISTS "Users can manage their own brain_dumps" ON public.brain_dumps;

CREATE POLICY "Users can manage their own brain_dumps"
ON public.brain_dumps
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);
