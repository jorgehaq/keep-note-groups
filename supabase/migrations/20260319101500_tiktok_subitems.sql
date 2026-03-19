-- Migration: Add tiktok_video_id to summaries and notes
-- This allows TikTok videos to have child summaries and sub-notes, matching the Note Groups architecture.

-- 1. Update summaries table
ALTER TABLE public.summaries 
ADD COLUMN IF NOT EXISTS tiktok_video_id uuid REFERENCES public.tiktok_videos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_summaries_tiktok_video_id ON public.summaries(tiktok_video_id);

-- 2. Update notes table
ALTER TABLE public.notes ALTER COLUMN group_id DROP NOT NULL;

ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS tiktok_video_id uuid REFERENCES public.tiktok_videos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notes_tiktok_video_id ON public.notes(tiktok_video_id);

-- 3. Update RLS for summaries
DROP POLICY IF EXISTS "Users can manage summaries of their brain_dumps" ON public.summaries;

CREATE POLICY "Users can manage summaries of their own records"
ON public.summaries
FOR ALL
TO authenticated
USING (
  (EXISTS (SELECT 1 FROM public.notes WHERE notes.id = summaries.note_id AND notes.user_id = auth.uid())) 
  OR 
  (EXISTS (SELECT 1 FROM public.brain_dumps WHERE brain_dumps.id = summaries.brain_dump_id AND brain_dumps.user_id = auth.uid()))
  OR
  (EXISTS (SELECT 1 FROM public.tiktok_videos WHERE tiktok_videos.id = summaries.tiktok_video_id AND tiktok_videos.user_id = auth.uid()))
);

-- 4. Update RLS for notes (already exists, but check if we need to adjust for tiktok_video_id)
-- Usually notes_user_id_fkey and policies are based on auth.uid() = user_id, which is already there.
