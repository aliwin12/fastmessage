-- 1. Create blocks table
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blocks" ON public.blocks FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);
CREATE POLICY "Users can insert their own blocks" ON public.blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users can delete their own blocks" ON public.blocks FOR DELETE USING (auth.uid() = blocker_id);

-- 2. Add function to delete chat for all members
CREATE OR REPLACE FUNCTION public.delete_chat_for_all(chat_id_to_delete UUID)
RETURNS void AS $$
BEGIN
  -- Check if the user calling the function is a member of the chat
  IF EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_id = chat_id_to_delete AND user_id = auth.uid()
  ) THEN
    -- Delete the chat (this will cascade to messages and chat_members)
    DELETE FROM public.chats WHERE id = chat_id_to_delete;
  ELSE
    RAISE EXCEPTION 'Not authorized to delete this chat';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Add function to block user
CREATE OR REPLACE FUNCTION public.block_user(user_to_block UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO public.blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), user_to_block)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Add function to unblock user
CREATE OR REPLACE FUNCTION public.unblock_user(user_to_unblock UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM public.blocks 
  WHERE blocker_id = auth.uid() AND blocked_id = user_to_unblock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Add function to check if blocked
CREATE OR REPLACE FUNCTION public.is_blocked(user1 UUID, user2 UUID)
RETURNS BOOLEAN AS $$
DECLARE
  blocked BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.blocks 
    WHERE (blocker_id = user1 AND blocked_id = user2)
       OR (blocker_id = user2 AND blocked_id = user1)
  ) INTO blocked;
  RETURN blocked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
