import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Users, MapPin, Phone, Mail, Instagram, Search, MessageCircle } from 'lucide-react';
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

      let query = supabase.from('offices')
        .select('id, name, photo_url, phone, email, instagram, whatsapp, city, state')
        .in('status', ['ativo'])
        .neq('id', officeId)
        .order('name');
      
      if (office?.active_product_id) {
        query = query.eq('active_product_id', office.active_product_id);
      }
      
      const { data } = await query;
      
      const offices = data || [];
      
      // Fetch main contacts for all offices
      if (offices.length > 0) {
        const officeIds = offices.map(o => o.id);
        const { data: contacts } = await supabase.from('contacts')
          .select('office_id, name')
          .in('office_id', officeIds)
          .eq('is_main_contact', true);
        
        const contactMap = new Map<string, string>();
        (contacts || []).forEach(c => contactMap.set(c.office_id, c.name));
        
        offices.forEach(o => {
          (o as any).main_contact_name = contactMap.get(o.id) || null;
        });
      }
      
      setMembers(offices);
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
                    {(m as any).main_contact_name && (
                      <p className="text-xs text-muted-foreground">Contato: {(m as any).main_contact_name}</p>
                    )}
                    {(m.city || m.state) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{[m.city, m.state].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {m.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</p>}
                  {m.email && <p className="flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</p>}
                  {m.whatsapp && (
                    <a href={`https://wa.me/${m.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-600 hover:underline">
                      <MessageCircle className="h-3 w-3" />{m.whatsapp}
                    </a>
                  )}
                  {m.instagram && (
                    <a href={`https://instagram.com/${m.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
                      <Instagram className="h-3 w-3" />{m.instagram}
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
