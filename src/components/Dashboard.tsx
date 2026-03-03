import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import Settings from './Settings';
import Contacts from './Contacts';
import PublicProfileModal from './PublicProfileModal';
import { MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { parseMessageContent } from '../lib/messageUtils';

interface DashboardProps {
  session: any;
  user: any;
  onLogout: () => void;
  onUserUpdate: (user: any) => void;
}

export default function Dashboard({ session, user, onLogout, onUserUpdate }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts' | 'settings'>('chats');
  const [activeChat, setActiveChat] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedProfileEntity, setSelectedProfileEntity] = useState<any>(null);
  const [isPageVisible, setIsPageVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === 'visible' && document.hasFocus());
    };

    const handleFocus = () => setIsPageVisible(true);
    const handleBlur = () => setIsPageVisible(false);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Initial check
    handleVisibilityChange();

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    fetchChats();

    const chatSubscription = supabase
      .channel('public:chat_members')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members', filter: `user_id=eq.${user.id}` }, fetchChats)
      .subscribe();

    const globalMessageSubscription = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        // Don't notify for our own messages
        if (payload.new.sender_id === user.id) return;
        
        // Don't notify if we are currently looking at this chat AND the page is visible/focused
        if (activeChat?.id === payload.new.chat_id && isPageVisible) return;

        // Parse message content
        const parsed = parseMessageContent(payload.new.content);
        if (parsed.type !== 'message') return;

        // Increment unread count for the chat
        setChats(prevChats => prevChats.map(chat => 
          chat.id === payload.new.chat_id 
            ? { ...chat, unread_count: (chat.unread_count || 0) + 1 }
            : chat
        ));

        // Fetch sender info
        const { data: sender } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', payload.new.sender_id)
          .single();

        if (sender) {
          // Play sound
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(e => console.error("Error playing sound:", e));
          } catch (e) {}

          if (Notification.permission === 'granted') {
            const parsed = parseMessageContent(payload.new.content);
            if (parsed.type === 'message') {
              new Notification(`New message from ${sender.username}`, {
                body: parsed.text || payload.new.content,
                icon: '/vite.svg'
              });
            }
          }
        }
      })
      .subscribe();

    const presenceChannel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const online: Record<string, any> = {};
        for (const id in state) {
          online[id] = state[id][0]; // Take the first presence object for the user
        }
        setOnlineUsers(online);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        setOnlineUsers(prev => ({ ...prev, [key]: newPresences[0] }));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
            status: user.status || 'online',
          });
        }
      });

    return () => {
      supabase.removeChannel(chatSubscription);
      supabase.removeChannel(globalMessageSubscription);
      supabase.removeChannel(presenceChannel);
    };
  }, [user.id, user.status, activeChat?.id, isPageVisible]);

  const fetchChats = async () => {
    try {
      const { data: chatMembers, error: cmError } = await supabase
        .from('chat_members')
        .select('chat_id, last_read_at')
        .eq('user_id', user.id);

      if (cmError) throw cmError;

      if (chatMembers && chatMembers.length > 0) {
        const chatIds = chatMembers.map(cm => cm.chat_id);
        const { data: chatsData, error: chatsError } = await supabase
          .from('chats')
          .select('*')
          .in('id', chatIds)
          .order('created_at', { ascending: false });

        if (chatsError) throw chatsError;

        // Enrich direct chats with other user's info and unread counts
        if (chatsData) {
          const enrichedChats = await Promise.all(chatsData.map(async (chat) => {
            const memberInfo = chatMembers.find(cm => cm.chat_id === chat.id);
            const lastReadAt = memberInfo?.last_read_at || new Date(0).toISOString();

            const { count: unreadCount } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('chat_id', chat.id)
              .neq('sender_id', user.id)
              .gt('created_at', lastReadAt)
              .not('content', 'ilike', '{"type":"reaction"%')
              .not('content', 'ilike', '{"type":"delete"%');

            let enrichedChat = { ...chat, unread_count: unreadCount || 0 };

            if (chat.type === 'direct') {
              const { data: otherMember } = await supabase
                .from('chat_members')
                .select('user_id')
                .eq('chat_id', chat.id)
                .neq('user_id', user.id)
                .single();

              if (otherMember) {
                const { data: otherUser } = await supabase
                  .from('profiles')
                  .select('username, avatar_url')
                  .eq('id', otherMember.user_id)
                  .single();

                if (otherUser) {
                  enrichedChat = { ...enrichedChat, name: otherUser.username, avatar_url: otherUser.avatar_url, other_user_id: otherMember.user_id };
                }
              }
            }
            return enrichedChat;
          }));
          setChats(enrichedChats);
        }
        setFetchError(null);
      } else {
        setChats([]);
        setFetchError(null);
      }
    } catch (e: any) {
      console.error('Error fetching chats:', e);
      setFetchError(e.message || 'Failed to load chats');
    }
  };

  const handleChatSelect = (chat: any) => {
    setActiveChat(chat);
    // Reset unread count when selecting a chat
    setChats(prevChats => prevChats.map(c => 
      c.id === chat.id ? { ...c, unread_count: 0 } : c
    ));
  };

  const handleStartChat = async (targetUserId: string) => {
    try {
      // Check if direct chat already exists
      const { data: existingChats, error: existingError } = await supabase
        .rpc('get_direct_chat', { user1: user.id, user2: targetUserId });

      let chatId;

      if (existingChats && existingChats.length > 0) {
        chatId = existingChats[0].id;
      } else {
        // Create new direct chat
        const { data: newChat, error: createError } = await supabase
          .from('chats')
          .insert([{ type: 'direct' }])
          .select()
          .single();

        if (createError) throw createError;
        chatId = newChat.id;

        // Add members
        await supabase.from('chat_members').insert([
          { chat_id: chatId, user_id: user.id },
          { chat_id: chatId, user_id: targetUserId }
        ]);
      }

      await fetchChats();
      const chat = chats.find(c => c.id === chatId) || { id: chatId };
      setActiveTab('chats');
      handleChatSelect(chat);
    } catch (e) {
      console.error('Error starting chat:', e);
    }
  };

  const handleAvatarClick = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (data) {
        setSelectedProfileEntity({
          id: data.id,
          entity_type: 'user',
          name: data.username,
          username: data.username,
          avatar_url: data.avatar_url,
          banner_url: data.banner_url,
          description: data.bio
        });
      }
    } catch (e) {
      console.error('Error fetching user profile:', e);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <Sidebar 
        user={user} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        chats={chats}
        activeChat={activeChat}
        onChatSelect={handleChatSelect}
        onChatsUpdate={fetchChats}
        onlineUsers={onlineUsers}
        onAvatarClick={handleAvatarClick}
      />
      
      <main className="flex-1 flex flex-col relative min-w-0">
        {selectedProfileEntity && (
          <PublicProfileModal
            entity={selectedProfileEntity}
            currentUser={user}
            onClose={() => setSelectedProfileEntity(null)}
            onStartChat={handleStartChat}
            onJoinGroup={() => {}}
          />
        )}
        {fetchError && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-2 rounded-lg z-50">
            Error loading chats: {fetchError}
          </div>
        )}
        {activeTab === 'settings' ? (
          <Settings user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />
        ) : activeTab === 'contacts' ? (
          <Contacts user={user} onStartChat={handleStartChat} onlineUsers={onlineUsers} onAvatarClick={handleAvatarClick} />
        ) : activeChat ? (
          <ChatArea chat={activeChat} user={user} onlineUsers={onlineUsers} onAvatarClick={handleAvatarClick} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <MessageSquare size={64} className="mb-4 opacity-20" />
            <p className="text-lg">Select a chat to start messaging</p>
          </div>
        )}
      </main>
    </div>
  );
}
