import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, Search, Star, Mail, Phone, Instagram } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Contact {
  id: string;
  name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  birthday: string | null;
  is_main_contact: boolean;
  office_id: string;
  offices: { id: string; name: string };
}

export default function ContatosGlobal() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contacts')
      .select('*, offices(id, name)')
      .order('name');
    setContacts((data as Contact[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.offices?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.role_title?.toLowerCase().includes(search.toLowerCase())
  );

  const sponsors = contacts.filter(c => c.is_main_contact).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contatos</h1>
        <p className="text-sm text-muted-foreground">
          {contacts.length} contato{contacts.length !== 1 ? 's' : ''} • {sponsors} sponsor{sponsors !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, escritório, cargo ou email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="bg-muted/50 h-11 flex items-center px-4 gap-12">
            {[...Array(6)].map((_, i) => <div key={i} className="h-3 w-16 rounded skeleton-shimmer" />)}
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border-b border-border/50 px-4 py-3 flex items-center gap-12">
              {[...Array(6)].map((_, j) => <div key={j} className="h-4 w-20 rounded skeleton-shimmer" />)}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search ? 'Nenhum contato encontrado.' : 'Nenhum contato registrado.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Escritório</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Instagram</TableHead>
                <TableHead>Aniversário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/clientes/${c.office_id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      {c.is_main_contact && (
                        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.role_title || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{c.offices?.name}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email ? (
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />{c.email}
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.phone ? (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />{c.phone}
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.instagram ? (
                      <div className="flex items-center gap-1.5">
                        <Instagram className="h-3.5 w-3.5" />{c.instagram}
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.birthday || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
