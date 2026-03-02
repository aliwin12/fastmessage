import React, { useState, useEffect, useRef } from 'react';
import { Send, Hash, Users, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ChatArea({ chat, user, onlineUsers }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [otherUserLastRead, setOtherUserLastRead] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingChannelRef = useRef<any>(null);

  useEffect(() => {
    if (!chat) return;
    
    fetchMessages();
    setTypingUsers(new Set());

    // Update our last read
    supabase.from('chat_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('chat_id', chat.id)
      .eq('user_id', user.id)
      .then();

    // Fetch other user's last read if direct chat
    if (chat.type === 'direct' && chat.other_user_id) {
      supabase.from('chat_members')
        .select('last_read_at')
        .eq('chat_id', chat.id)
        .eq('user_id', chat.other_user_id)
        .single()
        .then(({ data }) => {
          if (data) setOtherUserLastRead(data.last_read_at);
        });
    }

    const messageSubscription = supabase
      .channel(`public:messages:chat_id=${chat.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chat.id}` }, payload => {
        setMessages(prev => {
          if (prev.some(msg => msg.id === payload.new.id)) return prev;
          
          // Fetch sender info for the new message
          supabase.from('profiles').select('username, avatar_url').eq('id', payload.new.sender_id).single().then(({ data }) => {
            setMessages(current => {
              if (current.some(msg => msg.id === payload.new.id)) return current;
              return [...current, { ...payload.new, ...data }];
            });
          });
          
          // Update our last read since we are looking at the chat
          supabase.from('chat_members')
            .update({ last_read_at: new Date().toISOString() })
            .eq('chat_id', chat.id)
            .eq('user_id', user.id)
            .then();
            
          return prev;
        });
      })
      .subscribe();

    const membersSubscription = supabase
      .channel(`public:chat_members:chat_id=${chat.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_members', filter: `chat_id=eq.${chat.id}` }, payload => {
        if (payload.new.user_id !== user.id) {
          setOtherUserLastRead(payload.new.last_read_at);
        }
      })
      .subscribe();

    const typingChannel = supabase.channel(`typing:${chat.id}`, {
      config: {
        broadcast: { ack: false },
      },
    });

    typingChannel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== user.id) {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            if (payload.isTyping) {
              newSet.add(payload.username);
            } else {
              newSet.delete(payload.username);
            }
            return newSet;
          });
        }
      })
      .subscribe();

    typingChannelRef.current = typingChannel;

    return () => {
      supabase.removeChannel(messageSubscription);
      supabase.removeChannel(membersSubscription);
      supabase.removeChannel(typingChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [chat.id]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (typingChannelRef.current) {
      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, username: user.username, isTyping: true }
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        typingChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: user.id, username: user.username, isTyping: false }
        });
      }, 2000);
    }
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(username, avatar_url)')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      // Flatten the profiles object into the message object for easier rendering
      const formattedMessages = data.map((msg: any) => ({
        ...msg,
        username: msg.profiles?.username,
        avatar_url: msg.profiles?.avatar_url
      }));
      setMessages(formattedMessages);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      const content = newMessage;
      setNewMessage('');
      
      const tempId = `temp-${Date.now()}`;
      const tempMessage = {
        id: tempId,
        chat_id: chat.id,
        sender_id: user.id,
        content,
        created_at: new Date().toISOString(),
        username: user.username,
        avatar_url: user.avatar_url,
        isTemp: true
      };
      
      setMessages(prev => [...prev, tempMessage]);

      const { data, error } = await supabase.from('messages').insert([
        { chat_id: chat.id, sender_id: user.id, content }
      ]).select('*, profiles(username, avatar_url)').single();

      if (!error && data) {
        const formattedMsg = {
          ...data,
          username: data.profiles?.username,
          avatar_url: data.profiles?.avatar_url
        };
        setMessages(prev => prev.map(msg => msg.id === tempId ? formattedMsg : msg));
      } else {
        // Remove temp message on error
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
      }
    }
  };

  if (!chat) return null;

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 flex items-center px-6 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <img src={chat.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${chat.id}`} alt="chat" className="w-10 h-10 rounded-full bg-zinc-800" />
          <div>
            <h2 className="font-semibold text-lg text-white flex items-center gap-2">
              {chat.type === 'channel' ? <Hash size={16} className="text-zinc-400" /> : chat.type === 'group' ? <Users size={16} className="text-zinc-400" /> : <MessageCircle size={16} className="text-zinc-400" />}
              {chat.name || 'Chat'}
            </h2>
            {chat.description && <p className="text-xs text-zinc-400">{chat.description}</p>}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, idx) => {
          const isMe = msg.sender_id === user.id;
          const showAvatar = !isMe && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id);
          const isRead = isMe && otherUserLastRead && new Date(msg.created_at) <= new Date(otherUserLastRead);
          
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-3`}>
              {!isMe && (
                <div className="w-8 flex-shrink-0">
                  {showAvatar && <img src={msg.avatar_url} alt="avatar" className="w-8 h-8 rounded-full bg-zinc-800" />}
                </div>
              )}
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%]`}>
                {!isMe && showAvatar && <span className="text-xs font-medium text-zinc-400 mb-1 ml-1">{msg.username}</span>}
                <div className={`px-4 py-2.5 rounded-2xl ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-zinc-800 text-zinc-100 rounded-tl-sm'} ${msg.isTemp ? 'opacity-70' : ''}`}>
                  <p className="break-words text-sm leading-relaxed">{msg.content}</p>
                </div>
                <div className="flex items-center gap-1 mt-1 mx-1">
                  <span className="text-[10px] text-zinc-500">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMe && !msg.isTemp && (
                    <span className={`text-[10px] ${isRead ? 'text-indigo-400' : 'text-zinc-600'}`}>
                      {isRead ? 'Read' : 'Sent'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {typingUsers.size > 0 && (
          <div className="flex justify-start gap-3">
            <div className="w-8 flex-shrink-0"></div>
            <div className="flex flex-col items-start max-w-[70%]">
              <div className="px-4 py-3 rounded-2xl bg-zinc-800 text-zinc-100 rounded-tl-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              <span className="text-[10px] text-zinc-500 mt-1 mx-1">
                {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-zinc-900 border-t border-zinc-800">
        <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            placeholder="Write a message..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-full px-6 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white w-12 h-12 rounded-full flex items-center justify-center transition-colors"
          >
            <Send size={18} className="ml-1" />
          </button>
        </form>
      </div>
    </div>
  );
}
