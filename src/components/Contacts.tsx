import React, { useState, useEffect } from 'react';
import { Search, UserPlus, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Contacts({ user, onStartChat, onlineUsers = {} }: any) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('contact_id, profiles!contacts_contact_id_fkey(id, username, avatar_url, bio)')
        .eq('user_id', user.id);

      if (error) throw error;
      
      if (data) {
        setContacts(data.map(c => c.profiles));
      }
    } catch (e) {
      console.error('Error fetching contacts:', e);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, bio')
        .ilike('username', `%${searchQuery}%`)
        .neq('id', user.id)
        .limit(20);

      if (error) throw error;
      if (data) setSearchResults(data);
    } catch (e) {
      console.error('Error searching users:', e);
    }
  };

  const handleAddContact = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .insert([{ user_id: user.id, contact_id: userId }]);

      if (error) throw error;
      
      fetchContacts();
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    } catch (e) {
      console.error('Error adding contact:', e);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-950 p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Search */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Search className="text-indigo-500" /> Find People
          </h2>
          <form onSubmit={handleSearch} className="flex gap-3 mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by username..."
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium transition-colors">
              Search
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Results</h3>
              {searchResults.map(result => (
                <div key={result.id} className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                  <div className="flex items-center gap-4">
                    <img src={result.avatar_url} alt="avatar" className="w-12 h-12 rounded-full bg-zinc-800" />
                    <div>
                      <h4 className="font-medium text-white">{result.username}</h4>
                      <p className="text-sm text-zinc-400">{result.bio}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddContact(result.id)}
                    className="text-indigo-400 hover:text-indigo-300 p-2 rounded-lg hover:bg-indigo-500/10 transition-colors"
                    title="Add to Contacts"
                  >
                    <UserPlus size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contacts List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <UserPlus className="text-indigo-500" /> My Contacts
          </h2>
          
          {contacts.length === 0 ? (
            <p className="text-zinc-500 text-center py-8">No contacts yet. Search for people above to add them!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contacts.map(contact => {
                const isOnline = onlineUsers[contact.id];
                return (
                  <div key={contact.id} className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="relative flex-shrink-0">
                        <img src={contact.avatar_url} alt="avatar" className="w-12 h-12 rounded-full bg-zinc-800" />
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-zinc-950 rounded-full"></span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium text-white truncate">{contact.username}</h4>
                        <p className="text-xs text-zinc-400 truncate">
                          {isOnline ? onlineUsers[contact.id].status || 'Online' : contact.bio}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onStartChat(contact.id)}
                      className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors flex-shrink-0 ml-2"
                      title="Message"
                    >
                      <MessageCircle size={20} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
