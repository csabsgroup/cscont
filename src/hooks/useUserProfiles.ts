import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CachedProfile {
  name: string;
  avatarUrl: string | null;
}

const profileCache = new Map<string, CachedProfile>();
const pendingFetches = new Map<string, Promise<CachedProfile>>();

async function fetchProfile(userId: string): Promise<CachedProfile> {
  if (profileCache.has(userId)) return profileCache.get(userId)!;
  if (pendingFetches.has(userId)) return pendingFetches.get(userId)!;

  const promise = (async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', userId)
      .single();
    const result: CachedProfile = {
      name: data?.full_name || 'Usuário',
      avatarUrl: data?.avatar_url || null,
    };
    profileCache.set(userId, result);
    pendingFetches.delete(userId);
    return result;
  })();

  pendingFetches.set(userId, promise);
  return promise;
}

export function useUserProfile(userId?: string) {
  const [profile, setProfile] = useState<CachedProfile>({
    name: '',
    avatarUrl: null,
  });
  const [loading, setLoading] = useState(!!userId);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const cached = profileCache.get(userId);
    if (cached) {
      setProfile(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchProfile(userId).then((p) => {
      setProfile(p);
      setLoading(false);
    });
  }, [userId]);

  return { ...profile, loading };
}

/** Pre-populate cache from already-fetched profile data */
export function cacheProfiles(
  profiles: Array<{ id: string; full_name?: string | null; avatar_url?: string | null }>
) {
  profiles.forEach((p) => {
    profileCache.set(p.id, {
      name: p.full_name || 'Usuário',
      avatarUrl: p.avatar_url || null,
    });
  });
}
