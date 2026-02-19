-- Add is_pinned and last_accessed_at columns to groups table

-- 1. Add is_pinned column
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- 2. Add last_accessed_at column
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Update existing rows to have a valid last_accessed_at (using created_at or now)
-- This ensures sorting logic works immediately
UPDATE groups 
SET last_accessed_atCOALESCE(created_at, NOW()) 
WHERE last_accessed_at IS NULL;
