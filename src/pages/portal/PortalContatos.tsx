import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Phone } from 'lucide-react';
import { UserAvatar } from '@/components/shared/UserAvatar';

export default function PortalContatos() {
  const { officeId } = usePortal();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!officeId) { setLoading(false); return; }
    (async () => {
      const { data: office } = await supabase.from('offices').select('csm_id').eq('id', officeId).single();
      const csmId = office?.csm_id;
      const profileIds = csmId ? [csmId] : [];

      if (csmId) {
        const { data: mLinks } = await supabase.from('manager_csm_links').select('manager_id').eq('csm_id', csmId);
        (mLinks || []).forEach(ml => profileIds.push(ml.manager_id));
      }

      if (profileIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', profileIds);
        const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('user_id', profileIds);
        const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));
        setContacts((profiles || []).map(p => ({ ...p, role: roleMap.get(p.id) })));
      }
      setLoading(false);
    })();
  }, [officeId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const roleLabels: Record<string, string> = { csm: 'CSM', manager: 'Gestor', admin: 'Diretor de Operações' };

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
                  subtitle={roleLabels[c.role] || c.role}
                />
                {c.phone && <p className="text-sm text-muted-foreground flex items-center gap-1 ml-auto"><Phone className="h-3 w-3" />{c.phone}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
