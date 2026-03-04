import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Star, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface Contact {
  id: string;
  name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  birthday: string | null;
  is_main_contact: boolean;
  notes: string | null;
}

interface Props {
  officeId: string;
  contacts: Contact[];
  onRefresh: () => void;
}

const emptyForm = {
  name: '', role_title: '', email: '', phone: '', instagram: '',
  birthday: '', is_main_contact: false, notes: '',
};

export function ClienteContatos({ officeId, contacts, onRefresh }: Props) {
  const { isViewer } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({
      name: c.name, role_title: c.role_title || '', email: c.email || '',
      phone: c.phone || '', instagram: c.instagram || '', birthday: c.birthday || '',
      is_main_contact: c.is_main_contact, notes: c.notes || '',
    });
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      role_title: form.role_title || null,
      email: form.email || null,
      phone: form.phone || null,
      instagram: form.instagram || null,
      birthday: form.birthday || null,
      is_main_contact: form.is_main_contact,
      notes: form.notes || null,
      office_id: officeId,
    };

    const { error } = editing
      ? await supabase.from('contacts').update(payload).eq('id', editing.id)
      : await supabase.from('contacts').insert(payload);

    if (error) toast.error('Erro: ' + error.message);
    else { toast.success(editing ? 'Contato atualizado!' : 'Contato criado!'); setOpen(false); onRefresh(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este contato?')) return;
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Contato excluído!'); onRefresh(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{contacts.length} contato{contacts.length !== 1 ? 's' : ''}</p>
        {!isViewer && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" /> Novo Contato
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cargo</Label>
                    <Input value={form.role_title} onChange={e => setForm({ ...form, role_title: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Aniversário</Label>
                    <Input type="date" value={form.birthday} onChange={e => setForm({ ...form, birthday: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Instagram</Label>
                  <Input value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_main_contact} onCheckedChange={v => setForm({ ...form, is_main_contact: v })} />
                  <Label>Contato principal</Label>
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm">Nenhum contato cadastrado.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-1.5">
                    {c.is_main_contact && <Star className="h-3.5 w-3.5 text-warning fill-warning" />}
                    {c.name}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.role_title || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{c.email || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{c.phone || '—'}</TableCell>
                <TableCell>
                  {!isViewer && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
