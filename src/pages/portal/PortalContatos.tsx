import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Phone, Mail } from 'lucide-react';

export default function PortalContatos() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: links } = await supabase.from('client_office_links').select('office_id').eq('user_id', user.id);
      const oid = links?.[0]?.office_id;
      if (!oid) { setLoading(false); return; }

      // Get office CSM
      const { data: office } = await supabase.from('offices').select('csm_id').eq('id', oid).single();
      const csmId = office?.csm_id;
      const profileIds = csmId ? [csmId] : [];

      // Get manager if exists
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
  }, [user]);

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
                <Avatar className="h-12 w-12">
                  <AvatarImage src={c.avatar_url} />
                  <AvatarFallback>{c.full_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{c.full_name || 'Sem nome'}</p>
                  <p className="text-sm text-muted-foreground">{roleLabels[c.role] || c.role}</p>
                  {c.phone && <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><Phone className="h-3 w-3" />{c.phone}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
