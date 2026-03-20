-- Migration: Add status column to notes for archiving
-- default 'main', can be 'history'

ALTER TABLE public.notes 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'main' NOT NULL;

-- Index for performance on tray/dashboard filtering
CREATE INDEX IF NOT EXISTS idx_notes_status ON public.notes(status);
