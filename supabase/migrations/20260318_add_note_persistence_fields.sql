-- Migration: Add scratchpad and is_open fields to notes for persistence
ALTER TABLE public.notes 
ADD COLUMN IF NOT EXISTS scratchpad text,
ADD COLUMN IF NOT EXISTS is_open boolean DEFAULT false;

-- Update RLS or other constraints if needed (optional for now as existing policies cover all columns)
