-- 1. Add new columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allow_group_adds BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allow_group_invites BOOLEAN DEFAULT true;

-- 2. Add username to chats
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- 3. Create chat_invites table
CREATE TABLE IF NOT EXISTS public.chat_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  inviter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chat_id, invitee_id, status)
);

ALTER TABLE public.chat_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own invites" ON public.chat_invites FOR SELECT USING (auth.uid() = invitee_id OR auth.uid() = inviter_id);
CREATE POLICY "Users can insert invites" ON public.chat_invites FOR INSERT WITH CHECK (auth.uid() = inviter_id);
CREATE POLICY "Users can update their own invites" ON public.chat_invites FOR UPDATE USING (auth.uid() = invitee_id);

-- 4. Function for global search
CREATE OR REPLACE FUNCTION public.global_search(search_query TEXT)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  name TEXT,
  username TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    'user'::TEXT as entity_type,
    p.username as name,
    p.username,
    p.avatar_url,
    p.banner_url,
    p.bio as description
  FROM public.profiles p
  WHERE p.username ILIKE '%' || search_query || '%'
  
  UNION ALL
  
  SELECT
    c.id,
    c.type as entity_type,
    c.name,
    c.username,
    c.avatar_url,
    NULL as banner_url,
    c.description
  FROM public.chats c
  WHERE c.type IN ('group', 'channel')
    AND (c.name ILIKE '%' || search_query || '%' OR c.username ILIKE '%' || search_query || '%');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
