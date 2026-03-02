/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import { supabase } from './lib/supabase';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    let profileData = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (error && error.code === 'PGRST116') {
          // Profile not found, create a fallback profile
          const { data: userData } = await supabase.auth.getUser();
          const baseUsername = userData.user?.user_metadata?.username || userData.user?.email?.split('@')[0] || 'user';
          const username = `${baseUsername}_${Math.floor(Math.random() * 1000000)}`;
          
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert([{ 
              id: userId, 
              username: username,
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
            }])
            .select()
            .single();
            
          if (!insertError && newProfile) {
            profileData = newProfile;
            break;
          } else if (insertError?.code === '23505') {
            // Duplicate key error (profile already exists, maybe created by trigger just now)
            // We will just let the loop run again to fetch it
            console.log("Profile already exists (duplicate key), will retry fetching...");
          } else {
            console.error("Error creating fallback profile:", insertError);
          }
        } else if (error) {
          console.error("Error fetching profile:", error);
        } else if (data) {
          profileData = data;
          break;
        }
      } catch (err) {
        console.error("Unexpected error in fetchProfile:", err);
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (profileData) {
      setUser(profileData);
    } else {
      console.error("Could not load or create profile");
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleUserUpdate = (updatedUser: any) => {
    setUser(updatedUser);
  };

  if (loading) {
    return <div className="h-screen bg-zinc-950 flex items-center justify-center text-white">Loading...</div>;
  }

  if (!session || !user) {
    return <Auth onLoginSuccess={() => {
      if (session) {
        fetchProfile(session.user.id);
      } else {
        supabase.auth.getSession().then(({ data: { session } }) => {
          setSession(session);
          if (session) fetchProfile(session.user.id);
        });
      }
    }} />;
  }

  return <Dashboard session={session} user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />;
}
