CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.global_search(search_query TEXT)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  name TEXT,
  username TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  description TEXT,
  similarity_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    'user'::TEXT as entity_type,
    p.username as name,
    p.username,
    p.avatar_url,
    p.banner_url,
    p.bio as description,
    similarity(p.username, search_query) as similarity_score
  FROM public.profiles p
  WHERE p.username ILIKE '%' || search_query || '%' OR similarity(p.username, search_query) > 0.1
  
  UNION ALL
  
  SELECT
    c.id,
    c.type as entity_type,
    c.name,
    c.username,
    c.avatar_url,
    NULL as banner_url,
    c.description,
    GREATEST(similarity(c.name, search_query), similarity(COALESCE(c.username, ''), search_query)) as similarity_score
  FROM public.chats c
  WHERE c.type IN ('group', 'channel')
    AND (
      c.name ILIKE '%' || search_query || '%' OR 
      c.username ILIKE '%' || search_query || '%' OR
      similarity(c.name, search_query) > 0.1 OR
      similarity(COALESCE(c.username, ''), search_query) > 0.1
    )
  ORDER BY similarity_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
