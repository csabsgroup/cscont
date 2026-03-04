import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface IntegrationSetting {
  id: string;
  provider: string;
  config: Record<string, any>;
  workspace_name: string | null;
  is_connected: boolean;
  created_at: string;
  updated_at: string;
}

export function useIntegrationSettings() {
  const [settings, setSettings] = useState<IntegrationSetting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('integration_settings')
      .select('*')
      .order('provider');
    setSettings((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const getProvider = (provider: string) =>
    settings.find(s => s.provider === provider);

  const upsertSetting = async (provider: string, updates: Partial<IntegrationSetting>) => {
    const existing = getProvider(provider);
    if (existing) {
      await supabase.from('integration_settings').update(updates).eq('id', existing.id);
    } else {
      await supabase.from('integration_settings').insert({ provider, ...updates } as any);
    }
    await fetchSettings();
  };

  return { settings, loading, fetchSettings, getProvider, upsertSetting };
}
