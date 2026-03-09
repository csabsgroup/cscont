import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { UserAvatar } from '@/components/shared/UserAvatar';

interface ContactInfo {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  whatsapp: string | null;
  roleLabel: string;
}

function formatWhatsAppLink(whatsapp: string): string {
  const digits = whatsapp.replace(/\D/g, '');
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

export default function PortalContatos() {
  const { officeId } = usePortal();
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!officeId) { setLoading(false); return; }
    (async () => {
      // 1. Get CSM
      const { data: office } = await supabase.from('offices').select('csm_id').eq('id', officeId).single();
      const csmId = office?.csm_id;
      if (!csmId) { setContacts([]); setLoading(false); return; }

      // 2. Get Manager(s) of this CSM
      const { data: mLinks } = await supabase.from('manager_csm_links').select('manager_id').eq('csm_id', csmId);
      const managerIds = (mLinks || []).map(ml => ml.manager_id);

      // 3. Get configured portal admin
      const { data: adminSetting } = await supabase
        .from('portal_settings')
        .select('setting_value')
        .eq('setting_key', 'portal_contact_admin_id')
        .single();
      const adminId = adminSetting?.setting_value ? String(adminSetting.setting_value) : null;

      // 4. Fetch all profiles
      const profileIds = [...new Set([csmId, ...managerIds, ...(adminId ? [adminId] : [])])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, whatsapp')
        .in('id', profileIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const result: ContactInfo[] = [];

      // CSM
      const csmProfile = profileMap.get(csmId);
      if (csmProfile) {
        result.push({ ...csmProfile, roleLabel: 'CSM' });
      }

      // Managers
      managerIds.forEach(mid => {
        const p = profileMap.get(mid);
        if (p) result.push({ ...p, roleLabel: 'Gestor' });
      });

      // Admin
      if (adminId) {
        const p = profileMap.get(adminId);
        if (p && !result.find(r => r.id === adminId)) {
          result.push({ ...p, roleLabel: 'Diretor de Operações' });
        }
      }

      setContacts(result);
      setLoading(false);
    })();
  }, [officeId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Contatos</h1>
      {contacts.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum contato disponível.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {contacts.map(c => (
            <Card key={c.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <UserAvatar
                  name={c.full_name || 'Sem nome'}
                  avatarUrl={c.avatar_url}
                  size="lg"
                  showName
                  subtitle={c.roleLabel}
                />
                {c.whatsapp && (
                  <a
                    href={formatWhatsAppLink(c.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
