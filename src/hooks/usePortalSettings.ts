import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PortalSettings {
  portal_show_health: boolean;
  portal_show_bonus_balance: boolean;
  portal_show_next_event: boolean;
  portal_show_next_meeting: boolean;
  portal_show_contract: boolean;
  portal_show_okr: boolean;
  portal_show_meetings: boolean;
  portal_show_events: boolean;
  portal_show_bonus: boolean;
  portal_show_files: boolean;
  portal_show_contacts: boolean;
  portal_show_members: boolean;
  portal_show_billing_info: boolean;
  portal_show_contract_values: boolean;
  [key: string]: boolean;
}

const defaults: PortalSettings = {
  portal_show_health: true,
  portal_show_bonus_balance: true,
  portal_show_next_event: true,
  portal_show_next_meeting: true,
  portal_show_contract: true,
  portal_show_okr: true,
  portal_show_meetings: true,
  portal_show_events: true,
  portal_show_bonus: true,
  portal_show_files: true,
  portal_show_contacts: true,
  portal_show_members: true,
  portal_show_billing_info: true,
  portal_show_contract_values: true,
};

export function usePortalSettings() {
  const [settings, setSettings] = useState<PortalSettings>(defaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('portal_settings')
        .select('setting_key, setting_value');
      if (data) {
        const merged = { ...defaults };
        data.forEach((row: any) => {
          if (row.setting_key in merged) {
            merged[row.setting_key] = row.setting_value;
          }
        });
        setSettings(merged);
      }
      setLoading(false);
    })();
  }, []);

  return { settings, loading };
}
