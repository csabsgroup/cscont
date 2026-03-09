import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Users, MapPin, Phone, Mail, Instagram, Search, MessageCircle } from 'lucide-react';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { PaginationWithPageSize } from '@/components/shared/PaginationWithPageSize';

interface MemberContact {
  name: string;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  role_title: string | null;
  office_id: string;
}

interface Member {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  email: string | null;
  whatsapp: string | null;
  logo_url: string | null;
  photo_url: string | null;
  contacts: MemberContact[];
}

export default function PortalMembros() {
  const { officeId } = usePortal();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    if (!officeId) {
      console.log('[PortalMembros] No officeId, skipping');
      setLoading(false);
      return;
    }

    (async () => {
      console.log('[PortalMembros] Starting fetch for officeId:', officeId);

      // 1. Get current office's product
      const { data: office, error: officeErr } = await supabase
        .from('offices')
        .select('active_product_id')
        .eq('id', officeId)
        .single();

      if (officeErr) {
        console.error('[PortalMembros] Error fetching own office:', officeErr);
      }
      console.log('[PortalMembros] Own office product:', office?.active_product_id);

      // 2. Fetch directory offices (WITHOUT embed to avoid silent PostgREST failures)
      let query = supabase
        .from('offices')
        .select('id, name, city, state, email, whatsapp, logo_url, photo_url')
        .eq('status', 'ativo')
        .eq('visible_in_directory', true)
        .neq('id', officeId)
        .order('name');

      if (office?.active_product_id) {
        query = query.eq('active_product_id', office.active_product_id);
      }

      const { data: offices, error: officesErr } = await query;
      if (officesErr) {
        console.error('[PortalMembros] Error fetching directory offices:', officesErr);
      }
      console.log('[PortalMembros] Directory offices found:', offices?.length ?? 0);

      if (!offices || offices.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      // 3. Fetch contacts separately for these office IDs
      const officeIds = offices.map(o => o.id);
      const { data: contacts, error: contactsErr } = await supabase
        .from('contacts')
        .select('name, email, phone, instagram, role_title, office_id')
        .in('office_id', officeIds)
        .eq('is_main_contact', true);

      if (contactsErr) {
        console.error('[PortalMembros] Error fetching contacts:', contactsErr);
      }
      console.log('[PortalMembros] Contacts found:', contacts?.length ?? 0);

      // 4. Merge contacts into offices
      const contactsByOffice = new Map<string, MemberContact[]>();
      (contacts || []).forEach(c => {
        const list = contactsByOffice.get(c.office_id) || [];
        list.push(c);
        contactsByOffice.set(c.office_id, list);
      });

      const merged: Member[] = offices.map(o => ({
        ...o,
        contacts: contactsByOffice.get(o.id) || [],
      }));

      setMembers(merged);
      setLoading(false);
    })();
  }, [officeId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const q = search.toLowerCase();
  const filtered = members.filter(m =>
    m.name?.toLowerCase().includes(q) || m.city?.toLowerCase().includes(q)
  );

  const startIdx = (page - 1) * pageSize;
  const paginated = filtered.slice(startIdx, startIdx + pageSize);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Membros Ativos</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} membro{filtered.length !== 1 ? 's' : ''} do seu produto</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou cidade..." value={search} onChange={e => handleSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-8"><Users className="h-8 w-8 text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">Nenhum membro encontrado.</p></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginated.map(m => {
              const mainContact = m.contacts?.[0];
              const logo = m.logo_url || m.photo_url;
              return (
                <Card key={m.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <UserAvatar name={m.name} avatarUrl={logo} size="md" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{m.name}</p>
                        {m.external_id && (
                          <p className="text-xs text-muted-foreground">{m.external_id}</p>
                        )}
                        {(m.city || m.state) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {[m.city, m.state].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    {mainContact && (
                      <div className="border-t border-border/50 pt-2 mt-2 space-y-1 text-sm text-muted-foreground">
                        <p className="flex items-center gap-1 text-foreground font-medium text-xs">
                          👤 {mainContact.name}
                          {mainContact.role_title && (
                            <span className="text-muted-foreground font-normal">({mainContact.role_title})</span>
                          )}
                        </p>
                        {mainContact.email && (
                          <p className="flex items-center gap-1 text-xs"><Mail className="h-3 w-3" />{mainContact.email}</p>
                        )}
                        {mainContact.phone && (
                          <p className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{mainContact.phone}</p>
                        )}
                        {mainContact.instagram && (
                          <a href={`https://instagram.com/${mainContact.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs hover:underline">
                            <Instagram className="h-3 w-3" />{mainContact.instagram}
                          </a>
                        )}
                      </div>
                    )}

                    {m.whatsapp && (
                      <div className={`${mainContact ? 'mt-1' : 'mt-2 border-t border-border/50 pt-2'}`}>
                        <a href={`https://wa.me/${m.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-green-600 hover:underline">
                          <MessageCircle className="h-3 w-3" />{m.whatsapp}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <PaginationWithPageSize
            totalItems={filtered.length}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="membros"
          />
        </>
      )}
    </div>
  );
}
