import React, { useState, useEffect } from 'react';
import { X, MessageSquare, UserPlus, Users, Hash } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PublicProfileModalProps {
  entity: any; // Result from global_search
  currentUser: any;
  onClose: () => void;
  onStartChat: (userId: string) => void;
  onJoinGroup: (chatId: string) => void;
}

export default function PublicProfileModal({ entity, currentUser, onClose, onStartChat, onJoinGroup }: PublicProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [isContact, setIsContact] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    if (entity.entity_type === 'user') {
      checkContactStatus();
      checkBlockStatus();
    }
  }, [entity]);

  const checkContactStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('contact_id', entity.id)
        .single();
      
      if (data) setIsContact(true);
    } catch (e) {
      // Not a contact or error
    }
  };

  const checkBlockStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('blocks')
        .select('*')
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', entity.id)
        .single();
      
      if (data) setIsBlocked(true);
    } catch (e) {
      // Not blocked or error
    }
  };

  const handleAddContact = async () => {
    setLoading(true);
    try {
      await supabase.from('contacts').insert([
        { user_id: currentUser.id, contact_id: entity.id }
      ]);
      setIsContact(true);
    } catch (e) {
      console.error('Error adding contact:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async () => {
    setLoading(true);
    try {
      if (isBlocked) {
        await supabase.rpc('unblock_user', { user_to_unblock: entity.id });
        setIsBlocked(false);
      } else {
        await supabase.rpc('block_user', { user_to_block: entity.id });
        setIsBlocked(true);
      }
    } catch (e) {
      console.error('Error toggling block status:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Banner */}
        <div className="h-32 bg-zinc-800 relative">
          {entity.banner_url ? (
            <img src={entity.banner_url} alt="banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-indigo-500 to-purple-600 opacity-50" />
          )}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors backdrop-blur-md"
          >
            <X size={16} />
          </button>
        </div>

        {/* Profile Info */}
        <div className="px-6 pb-6 relative">
          <div className="flex justify-between items-end -mt-12 mb-4">
            <img 
              src={entity.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${entity.id}`} 
              alt="avatar" 
              className="w-24 h-24 rounded-full border-4 border-zinc-900 bg-zinc-800 object-cover"
            />
            
            <div className="flex gap-2">
              {entity.entity_type === 'user' && entity.id !== currentUser.id && (
                <>
                  <button 
                    onClick={handleBlockUser}
                    disabled={loading}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      isBlocked 
                        ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                    }`}
                  >
                    {isBlocked ? 'Unblock' : 'Block'}
                  </button>
                  {!isContact && (
                    <button 
                      onClick={handleAddContact}
                      disabled={loading}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
                      title="Add to Contacts"
                    >
                      <UserPlus size={20} />
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      onStartChat(entity.id);
                      onClose();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
                  >
                    <MessageSquare size={18} />
                    Message
                  </button>
                </>
              )}

              {(entity.entity_type === 'group' || entity.entity_type === 'channel') && (
                <button 
                  onClick={() => {
                    onJoinGroup(entity.id);
                    onClose();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
                >
                  {entity.entity_type === 'group' ? <Users size={18} /> : <Hash size={18} />}
                  Join {entity.entity_type === 'group' ? 'Group' : 'Channel'}
                </button>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              {entity.name}
            </h2>
            {entity.username && (
              <p className="text-indigo-400 font-medium">@{entity.username}</p>
            )}
          </div>

          {entity.description && (
            <div className="mt-4 p-4 bg-zinc-800/50 rounded-xl border border-zinc-800/50">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">About</h3>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap">{entity.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
