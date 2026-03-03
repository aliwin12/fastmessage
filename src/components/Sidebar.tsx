import React, { useState } from 'react';
import { MessageSquare, Users, Settings as SettingsIcon, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import GlobalSearch from './GlobalSearch';
import PublicProfileModal from './PublicProfileModal';

export default function Sidebar({ user, activeTab, setActiveTab, chats, activeChat, onChatSelect, onChatsUpdate, onlineUsers }: any) {
  const [showCreate, setShowCreate] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [newChatUsername, setNewChatUsername] = useState('');
  const [newChatDesc, setNewChatDesc] = useState('');
  const [newChatType, setNewChatType] = useState('group');
  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  const handleCreateChat = async (e: any) => {
    e.preventDefault();
    try {
      const avatar_url = `https://api.dicebear.com/7.x/identicon/svg?seed=${newChatName}`;
      
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert([{ 
          type: newChatType, 
          name: newChatName, 
          username: newChatUsername || null,
          description: newChatDesc, 
          avatar_url, 
          owner_id: user.id 
        }])
        .select()
        .single();

      if (chatError) throw chatError;

      const { error: memberError } = await supabase
        .from('chat_members')
        .insert([{ chat_id: chat.id, user_id: user.id, role: 'admin' }]);

      if (memberError) throw memberError;

      setShowCreate(false);
      setNewChatName('');
      setNewChatUsername('');
      setNewChatDesc('');
      onChatsUpdate();
    } catch (err) {
      console.error('Error creating chat:', err);
    }
  };

  const handleStartChat = async (targetUserId: string) => {
    try {
      const { data: existingChats } = await supabase
        .rpc('get_direct_chat', { user1: user.id, user2: targetUserId });

      let chatId;
      if (existingChats && existingChats.length > 0) {
        chatId = existingChats[0].id;
      } else {
        const { data: newChat } = await supabase
          .from('chats')
          .insert([{ type: 'direct' }])
          .select()
          .single();
        if (newChat) {
          chatId = newChat.id;
          await supabase.from('chat_members').insert([
            { chat_id: chatId, user_id: user.id },
            { chat_id: chatId, user_id: targetUserId }
          ]);
        }
      }
      onChatsUpdate();
      setActiveTab('chats');
    } catch (e) {
      console.error('Error starting chat:', e);
    }
  };

  const handleJoinGroup = async (chatId: string) => {
    try {
      await supabase.from('chat_members').insert([
        { chat_id: chatId, user_id: user.id }
      ]);
      onChatsUpdate();
      setActiveTab('chats');
    } catch (e) {
      console.error('Error joining group:', e);
    }
  };

  return (
    <div className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full relative">
      {selectedEntity && (
        <PublicProfileModal
          entity={selectedEntity}
          currentUser={user}
          onClose={() => setSelectedEntity(null)}
          onStartChat={handleStartChat}
          onJoinGroup={handleJoinGroup}
        />
      )}

      {/* User Profile Summary */}
      <div className="p-4 border-b border-zinc-800 flex items-center gap-3">
        <img src={user.avatar_url} alt="avatar" className="w-10 h-10 rounded-full bg-zinc-800" />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">{user.username}</h2>
          <p className="text-xs text-zinc-400 truncate">{user.bio}</p>
        </div>
      </div>

      <GlobalSearch onSelectResult={setSelectedEntity} />

      {/* Tabs */}
      <div className="flex p-2 gap-1 border-b border-zinc-800">
        <button 
          onClick={() => setActiveTab('chats')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'chats' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50'}`}
        >
          <MessageSquare size={16} className="mx-auto mb-1" />
          Chats
        </button>
        <button 
          onClick={() => setActiveTab('contacts')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'contacts' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50'}`}
        >
          <Users size={16} className="mx-auto mb-1" />
          Contacts
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50'}`}
        >
          <SettingsIcon size={16} className="mx-auto mb-1" />
          Settings
        </button>
      </div>

      {/* Chat List */}
      {activeTab === 'chats' && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 flex justify-between items-center">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Recent Chats</span>
            <button onClick={() => setShowCreate(!showCreate)} className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-800">
              <Plus size={16} />
            </button>
          </div>

          {showCreate && (
            <form onSubmit={handleCreateChat} className="p-3 bg-zinc-800/50 border-y border-zinc-800">
              <input 
                type="text" placeholder="Name" value={newChatName} onChange={e => setNewChatName(e.target.value)} required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm mb-2 text-white focus:outline-none focus:border-indigo-500"
              />
              <input 
                type="text" placeholder="Username (optional)" value={newChatUsername} onChange={e => setNewChatUsername(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm mb-2 text-white focus:outline-none focus:border-indigo-500"
              />
              <input 
                type="text" placeholder="Description" value={newChatDesc} onChange={e => setNewChatDesc(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm mb-2 text-white focus:outline-none focus:border-indigo-500"
              />
              <select 
                value={newChatType} onChange={e => setNewChatType(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm mb-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="group">Group</option>
                <option value="channel">Channel</option>
              </select>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="text-xs text-zinc-400 hover:text-white">Cancel</button>
                <button type="submit" className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md">Create</button>
              </div>
            </form>
          )}

          <div className="space-y-1 p-2">
            {chats.map((chat: any) => {
              const isOnline = chat.type === 'direct' && onlineUsers[chat.other_user_id];
              return (
                <button
                  key={chat.id}
                  onClick={() => onChatSelect(chat)}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors text-left ${activeChat?.id === chat.id ? 'bg-indigo-600/10 border border-indigo-500/20' : 'hover:bg-zinc-800 border border-transparent'}`}
                >
                  <div className="relative">
                    <img src={chat.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${chat.id}`} alt="chat" className="w-10 h-10 rounded-full bg-zinc-800" />
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-zinc-900 rounded-full"></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-white truncate">{chat.name || 'Chat'}</h3>
                    <p className="text-xs text-zinc-400 truncate capitalize">
                      {chat.type === 'direct' && isOnline ? onlineUsers[chat.other_user_id].status || 'Online' : chat.type}
                    </p>
                  </div>
                </button>
              );
            })}
            {chats.length === 0 && !showCreate && (
              <p className="text-center text-zinc-500 text-sm py-4">No chats yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
