-- Migration to add content column to tasks table
ALTER TABLE "public"."tasks" ADD COLUMN IF NOT EXISTS "content" TEXT;

-- Update existing tasks if needed (optional, depends on if we want to sync from summaries or brain_dumps, 
-- but since we are fixing a loss issue, existing tasks probably don't have this data anywhere else easily accessible in bulk)
