-- Fix meals table to support text-only entries
ALTER TABLE public.meals 
ALTER COLUMN image_url DROP NOT NULL;

-- Ensure user_comment column exists
ALTER TABLE public.meals 
ADD COLUMN IF NOT EXISTS user_comment TEXT;
