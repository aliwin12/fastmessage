import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kwynkskxvspobuoprhvw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3eW5rc2t4dnNwb2J1b3ByaHZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODAwNDcsImV4cCI6MjA4ODA1NjA0N30.YuX59I1pCbNklfHrFGwNVdoC4s7A5jNiFS7BQh2EZxk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
