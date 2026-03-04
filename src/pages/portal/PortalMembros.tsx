import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Users, MapPin, Phone, Mail, Instagram } from 'lucide-react';

export default function PortalMembros() {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: links } = await supabase.from('client_office_links').select('office_id').eq('user_id', user.id);
      const oid = links?.[0]?.office_id;
      if (!oid) { setLoading(false); return; }

      // Get product of the office
      const { data: office } = await supabase.from('offices').select('active_product_id').eq('id', oid).single();
      if (!office?.active_product_id) { setLoading(false); return; }

      // Get all active offices of same product that are visible
      const { data } = await supabase.from('offices')
        .select('id, name, photo_url, phone, email, instagram, city, state')
        .eq('active_product_id', office.active_product_id)
        .eq('visible_in_directory', true)
        .in('status', ['ativo', 'upsell', 'bonus_elite'])
        .neq('id', oid)
        .order('name');
      setMembers(data || []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Membros Ativos</h1>
        <p className="text-sm text-muted-foreground">{members.length} membro{members.length !== 1 ? 's' : ''} do seu produto</p>
      </div>
      {members.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-8"><Users className="h-8 w-8 text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">Nenhum membro encontrado.</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map(m => (
            <Card key={m.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={m.photo_url} />
                    <AvatarFallback>{m.name[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
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
