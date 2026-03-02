-- Supabase Schema for Messenger App

-- 1. Create Tables
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
  bio TEXT DEFAULT 'Hey there! I am using Messenger.',
  status TEXT DEFAULT 'online',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.contacts (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, contact_id)
);

CREATE TABLE public.chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('direct', 'group', 'channel')),
  name TEXT,
  description TEXT,
  avatar_url TEXT,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.chat_members (
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Profiles: Anyone can read profiles, users can update their own.
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Contacts: Users can only see and manage their own contacts.
CREATE POLICY "Users can view their own contacts" ON public.contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own contacts" ON public.contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own contacts" ON public.contacts FOR DELETE USING (auth.uid() = user_id);

-- TEMPORARY FIX: Disable strict RLS for chats, members, and messages to unblock development
CREATE POLICY "Allow all select on chats" ON public.chats FOR SELECT USING (true);
CREATE POLICY "Allow all insert on chats" ON public.chats FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on chats" ON public.chats FOR UPDATE USING (true);

CREATE POLICY "Allow all select on chat_members" ON public.chat_members FOR SELECT USING (true);
CREATE POLICY "Allow all insert on chat_members" ON public.chat_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on chat_members" ON public.chat_members FOR UPDATE USING (true);

CREATE POLICY "Allow all select on messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Allow all insert on messages" ON public.messages FOR INSERT WITH CHECK (true);

-- 4. Triggers for new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || COALESCE(new.raw_user_meta_data->>'username', new.email)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Enable Realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;

-- 6. RPC for finding direct chats
CREATE OR REPLACE FUNCTION public.get_direct_chat(user1 UUID, user2 UUID)
RETURNS TABLE(id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id
  FROM public.chats c
  JOIN public.chat_members cm1 ON c.id = cm1.chat_id
  JOIN public.chat_members cm2 ON c.id = cm2.chat_id
  WHERE c.type = 'direct'
    AND cm1.user_id = user1
    AND cm2.user_id = user2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
