import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePortalSettings, PortalSettings } from '@/hooks/usePortalSettings';

interface PortalContextType {
  officeId: string | null;
  officeName: string;
  officeLogo: string | null;
  isPreview: boolean;
  isReadOnly: boolean;
  settings: PortalSettings;
  settingsLoading: boolean;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

interface Props {
  children: React.ReactNode;
  previewOfficeId?: string;
}

export function PortalProvider({ children, previewOfficeId }: Props) {
  const { user } = useAuth();
  const { settings, loading: settingsLoading } = usePortalSettings();
  const [officeId, setOfficeId] = useState<string | null>(previewOfficeId || null);
  const [officeName, setOfficeName] = useState('');
  const [officeLogo, setOfficeLogo] = useState<string | null>(null);
  const isPreview = !!previewOfficeId;

  useEffect(() => {
    if (previewOfficeId) {
      setOfficeId(previewOfficeId);
      supabase
        .from('offices')
        .select('name, logo_url, photo_url')
        .eq('id', previewOfficeId)
        .single()
        .then(({ data }) => {
          setOfficeName(data?.name || '');
          setOfficeLogo(data?.logo_url || data?.photo_url || null);
        });
      return;
    }

    if (!user) return;
    (async () => {
      console.log('[PORTAL] Resolving office for user:', user.id);
      const { data: links, error } = await supabase
        .from('client_office_links')
        .select('office_id')
        .eq('user_id', user.id);
      console.log('[PORTAL] client_office_links result:', links, error);
      const oid = links?.[0]?.office_id;
      if (!oid) {
        console.warn('[PORTAL] No office linked for user', user.id);
        return;
      }
      setOfficeId(oid);
      console.log('[PORTAL] Office ID resolved:', oid);
      const { data: office } = await supabase
        .from('offices')
        .select('name, logo_url, photo_url')
        .eq('id', oid)
        .single();
      if (office) {
        setOfficeName(office.name);
        setOfficeLogo(office.logo_url || office.photo_url || null);
      }
    })();
  }, [user, previewOfficeId]);

  return (
    <PortalContext.Provider
      value={{
        officeId,
        officeName,
        officeLogo,
        isPreview,
        isReadOnly: isPreview,
        settings,
        settingsLoading,
      }}
    >
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used within PortalProvider');
  return ctx;
}
