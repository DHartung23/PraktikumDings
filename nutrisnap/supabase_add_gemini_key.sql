-- NutriSnap AI: Add gemini_api_key to profiles table

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

-- Update RLS policies to allow users to update their own key
-- (The existing UPDATE policy on "profiles" should already cover it if it's set to "user_id = auth.uid()" or "id = auth.uid()")
