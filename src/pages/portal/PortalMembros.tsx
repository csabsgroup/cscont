import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Users, MapPin, Phone, Mail, Instagram, Search } from 'lucide-react';
import { UserAvatar } from '@/components/shared/UserAvatar';

export default function PortalMembros() {
  const { officeId } = usePortal();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!officeId) { setLoading(false); return; }
    (async () => {
      const { data: office } = await supabase.from('offices').select('active_product_id').eq('id', officeId).single();
      if (!office?.active_product_id) { setLoading(false); return; }

      const { data } = await supabase.from('offices')
        .select('id, name, photo_url, phone, email, instagram, city, state')
        .eq('active_product_id', office.active_product_id)
        .eq('visible_in_directory', true)
        .in('status', ['ativo', 'upsell', 'bonus_elite'])
        .neq('id', officeId)
        .order('name');
      setMembers(data || []);
      setLoading(false);
    })();
  }, [officeId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const q = search.toLowerCase();
  const filtered = members.filter(m =>
    m.name?.toLowerCase().includes(q) || m.city?.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Membros Ativos</h1>
        <p className="text-sm text-muted-foreground">{members.length} membro{members.length !== 1 ? 's' : ''} do seu produto</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou cidade..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-8"><Users className="h-8 w-8 text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">Nenhum membro encontrado.</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(m => (
            <Card key={m.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <UserAvatar name={m.name} avatarUrl={m.photo_url} size="md" />
                  <div>
                    <p className="font-medium text-sm">{m.name}</p>
                    {(m.city || m.state) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{[m.city, m.state].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {m.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</p>}
                  {m.email && <p className="flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</p>}
                  {m.instagram && <p className="flex items-center gap-1"><Instagram className="h-3 w-3" />{m.instagram}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
