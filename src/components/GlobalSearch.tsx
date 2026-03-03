import React, { useState, useEffect } from 'react';
import { Search, User, Users, Hash, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface GlobalSearchProps {
  onSelectResult: (result: any) => void;
}

export default function GlobalSearch({ onSelectResult }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ exact: any[], fuzzy: any[] }>({ exact: [], fuzzy: [] });
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ exact: [], fuzzy: [] });
      setSearchError(null);
      return;
    }

    const search = async () => {
      setLoading(true);
      setSearchError(null);
      try {
        const { data, error } = await supabase.rpc('global_search', { search_query: query });
        if (error) throw error;
        
        const exact: any[] = [];
        const fuzzy: any[] = [];
        
        (data || []).forEach((result: any) => {
          const nameMatch = (result.name || '').toLowerCase().includes(query.toLowerCase());
          const usernameMatch = (result.username || '').toLowerCase().includes(query.toLowerCase());
          const isExact = nameMatch || usernameMatch;
            
          if (isExact) {
            exact.push(result);
          } else {
            fuzzy.push(result);
          }
        });
        
        setResults({ exact, fuzzy });
      } catch (err: any) {
        console.error('Error searching:', err);
        setSearchError(err.message || 'Search failed');
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  return (
    <div className="relative p-3 border-b border-zinc-800">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
        <input
          type="text"
          placeholder="Search global..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-8 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {query && (
        <div className="absolute top-full left-0 right-0 mt-2 mx-3 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
          {searchError ? (
            <div className="p-4 text-center text-sm text-red-400">{searchError}</div>
          ) : loading ? (
            <div className="p-4 text-center text-sm text-zinc-400">Searching...</div>
          ) : results.exact.length > 0 || results.fuzzy.length > 0 ? (
            <div className="py-2">
              {results.exact.length > 0 && (
                <div className="mb-2">
                  <div className="px-4 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Exact Matches
                  </div>
                  {results.exact.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => {
                        onSelectResult(result);
                        setQuery('');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-zinc-700 transition-colors text-left"
                    >
                      <img
                        src={result.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${result.id}`}
                        alt="avatar"
                        className="w-8 h-8 rounded-full bg-zinc-900"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <h4 className="text-sm font-medium text-white truncate">{result.name}</h4>
                          {result.entity_type === 'user' && <User size={12} className="text-zinc-400" />}
                          {result.entity_type === 'group' && <Users size={12} className="text-zinc-400" />}
                          {result.entity_type === 'channel' && <Hash size={12} className="text-zinc-400" />}
                        </div>
                        {result.username && (
                          <p className="text-xs text-zinc-400 truncate">@{result.username}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.fuzzy.length > 0 && (
                <div>
                  <div className="px-4 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Did you mean...
                  </div>
                  {results.fuzzy.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => {
                        onSelectResult(result);
                        setQuery('');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-zinc-700 transition-colors text-left"
                    >
                      <img
                        src={result.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${result.id}`}
                        alt="avatar"
                        className="w-8 h-8 rounded-full bg-zinc-900"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <h4 className="text-sm font-medium text-white truncate">{result.name}</h4>
                          {result.entity_type === 'user' && <User size={12} className="text-zinc-400" />}
                          {result.entity_type === 'group' && <Users size={12} className="text-zinc-400" />}
                          {result.entity_type === 'channel' && <Hash size={12} className="text-zinc-400" />}
                        </div>
                        {result.username && (
                          <p className="text-xs text-zinc-400 truncate">@{result.username}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-zinc-400">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}
