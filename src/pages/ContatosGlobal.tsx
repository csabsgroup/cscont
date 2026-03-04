import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Users, Search, Star, Mail, Phone, Instagram, Edit2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
  const { isViewer } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [officeFilter, setOfficeFilter] = useState('all');
  const [sponsorFilter, setSponsorFilter] = useState(false);
  const navigate = useNavigate();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', role_title: '', email: '', phone: '', instagram: '',
    birthday: '', is_main_contact: false, office_id: '',
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [cRes, oRes] = await Promise.all([
      supabase.from('contacts').select('*, offices(id, name)').order('name'),
      supabase.from('offices').select('id, name').order('name'),
    ]);
    setContacts((cRes.data as Contact[]) || []);
    setOffices(oRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openNew = () => {
    setEditContact(null);
    setForm({ name: '', role_title: '', email: '', phone: '', instagram: '', birthday: '', is_main_contact: false, office_id: '' });
    setDialogOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditContact(c);
    setForm({
      name: c.name, role_title: c.role_title || '', email: c.email || '',
      phone: c.phone || '', instagram: c.instagram || '', birthday: c.birthday || '',
      is_main_contact: c.is_main_contact, office_id: c.office_id,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.office_id) { toast.error('Selecione um escritório'); return; }
    setSaving(true);
    const payload = {
      name: form.name,
      role_title: form.role_title || null,
      email: form.email || null,
      phone: form.phone || null,
      instagram: form.instagram || null,
      birthday: form.birthday || null,
      is_main_contact: form.is_main_contact,
      office_id: form.office_id,
    };
    if (editContact) {
      const { error } = await supabase.from('contacts').update(payload).eq('id', editContact.id);
      if (error) toast.error('Erro: ' + error.message); else toast.success('Contato atualizado!');
    } else {
      const { error } = await supabase.from('contacts').insert(payload);
      if (error) toast.error('Erro: ' + error.message); else toast.success('Contato criado!');
    }
    setSaving(false); setDialogOpen(false); fetchAll();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message); else { toast.success('Contato removido!'); fetchAll(); }
  };

  const filtered = contacts.filter(c => {
    if (officeFilter !== 'all' && c.office_id !== officeFilter) return false;
    if (sponsorFilter && !c.is_main_contact) return false;
    if (search) {
      const s = search.toLowerCase();
      return c.name.toLowerCase().includes(s) || c.offices?.name?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) || c.role_title?.toLowerCase().includes(s);
    }
    return true;
  });

  const sponsors = contacts.filter(c => c.is_main_contact).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contatos</h1>
          <p className="text-sm text-muted-foreground">
            {contacts.length} contato{contacts.length !== 1 ? 's' : ''} • {sponsors} sponsor{sponsors !== 1 ? 's' : ''}
          </p>
        </div>
        {!isViewer && (
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Contato</Button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, escritório, cargo ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={officeFilter} onValueChange={setOfficeFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Escritório" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os escritórios</SelectItem>
            {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Switch checked={sponsorFilter} onCheckedChange={setSponsorFilter} />
          Apenas sponsors
        </label>
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
              {search || officeFilter !== 'all' ? 'Nenhum contato encontrado.' : 'Nenhum contato registrado.'}
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
                {!isViewer && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell onClick={() => navigate(`/clientes/${c.office_id}`)}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      {c.is_main_contact && <Star className="h-3.5 w-3.5 fill-warning text-warning" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.role_title || '—'}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{c.offices?.name}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email ? <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{c.email}</div> : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.phone ? <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{c.phone}</div> : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.instagram ? <div className="flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5" />{c.instagram}</div> : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.birthday || '—'}</TableCell>
                  {!isViewer && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(c); }}><Edit2 className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editContact ? 'Editar Contato' : 'Novo Contato'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Cargo</Label><Input value={form.role_title} onChange={e => setForm(f => ({ ...f, role_title: e.target.value }))} /></div>
            </div>
            <div className="space-y-2">
              <Label>Escritório *</Label>
              <Select value={form.office_id} onValueChange={val => setForm(f => ({ ...f, office_id: val }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Instagram</Label><Input value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Aniversário</Label><Input type="date" value={form.birthday} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_main_contact} onCheckedChange={val => setForm(f => ({ ...f, is_main_contact: val }))} />
              <Label>Contato principal (Sponsor)</Label>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
