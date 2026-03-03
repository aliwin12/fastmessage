import React, { useState } from 'react';
import { LogOut, Save, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Settings({ user, onLogout, onUserUpdate }: any) {
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '');
  const [bannerUrl, setBannerUrl] = useState(user.banner_url || '');
  const [username, setUsername] = useState(user.username || '');
  const [bio, setBio] = useState(user.bio || '');
  const [status, setStatus] = useState(user.status || 'online');
  const [allowGroupAdds, setAllowGroupAdds] = useState(user.allow_group_adds ?? true);
  const [allowGroupInvites, setAllowGroupInvites] = useState(user.allow_group_invites ?? true);
  const [message, setMessage] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: avatarUrl, 
          banner_url: bannerUrl,
          username,
          bio, 
          status,
          allow_group_adds: allowGroupAdds,
          allow_group_invites: allowGroupInvites
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        onUserUpdate(data);
        setMessage('Profile updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-950 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
          <User className="text-indigo-500" /> Profile Settings
        </h1>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-6 mb-8">
            <img src={avatarUrl} alt="avatar" className="w-24 h-24 rounded-full bg-zinc-800 border-4 border-zinc-800" />
            <div>
              <h2 className="text-xl font-semibold text-white">{user.username}</h2>
              <p className="text-sm text-zinc-400">Joined {new Date(user.created_at || Date.now()).toLocaleDateString()}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Avatar URL</label>
              <input
                type="text"
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Banner URL</label>
              <input
                type="text"
                value={bannerUrl}
                onChange={e => setBannerUrl(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Bio</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={4}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Status</label>
              <input
                type="text"
                value={status}
                onChange={e => setStatus(e.target.value)}
                placeholder="e.g., Working, In a meeting, etc."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <h3 className="text-lg font-medium text-white mb-4">Privacy Settings</h3>
              
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-white">Allow Group Adds</p>
                  <p className="text-xs text-zinc-400">Can people add you directly to groups?</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={allowGroupAdds} onChange={e => setAllowGroupAdds(e.target.checked)} />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Allow Group Invites</p>
                  <p className="text-xs text-zinc-400">Can people send you group invitations?</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={allowGroupInvites} onChange={e => setAllowGroupInvites(e.target.checked)} />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            {message && <p className="text-emerald-500 text-sm">{message}</p>}

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <Save size={18} /> Save Changes
              </button>
            </div>
          </form>
        </div>

        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
          <h3 className="text-lg font-medium text-red-500 mb-2">Danger Zone</h3>
          <p className="text-sm text-zinc-500 mb-4">Log out of your account on this device.</p>
          <button
            onClick={onLogout}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            <LogOut size={18} /> Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
