import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type OfficeStatus = Database['public']['Enums']['office_status'];

interface Office {
  id: string;
  name: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  status: OfficeStatus;
  active_product_id: string | null;
  notes: string | null;
  tags: string[] | null;
  onboarding_date: string | null;
  activation_date: string | null;
  visible_in_directory: boolean;
}

interface Product { id: string; name: string; }

interface Props {
  office: Office;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

export function EditOfficeDialog({ office, open, onOpenChange, onSaved }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', cnpj: '', city: '', state: '', email: '', phone: '', instagram: '',
    status: 'nao_iniciado' as OfficeStatus, active_product_id: '', notes: '',
    onboarding_date: '', activation_date: '', visible_in_directory: true,
  });

  useEffect(() => {
    supabase.from('products').select('id, name').eq('is_active', true).then(({ data }) => setProducts(data || []));
  }, []);

  useEffect(() => {
    if (open && office) {
      setForm({
        name: office.name, cnpj: office.cnpj || '', city: office.city || '',
        state: office.state || '', email: office.email || '', phone: office.phone || '',
        instagram: office.instagram || '', status: office.status,
        active_product_id: office.active_product_id || '', notes: office.notes || '',
        onboarding_date: office.onboarding_date || '', activation_date: office.activation_date || '',
        visible_in_directory: office.visible_in_directory,
      });
    }
  }, [open, office]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('offices').update({
      name: form.name,
      cnpj: form.cnpj || null,
      city: form.city || null,
      state: form.state || null,
      email: form.email || null,
      phone: form.phone || null,
      instagram: form.instagram || null,
      status: form.status,
      active_product_id: form.active_product_id || null,
      notes: form.notes || null,
      onboarding_date: form.onboarding_date || null,
      activation_date: form.activation_date || null,
      visible_in_directory: form.visible_in_directory,
    }).eq('id', office.id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Escritório atualizado!'); onOpenChange(false); onSaved(); }
    setSaving(false);
  };

  const statuses: { value: OfficeStatus; label: string }[] = [
    { value: 'nao_iniciado', label: 'Não Iniciado' },
    { value: 'ativo', label: 'Ativo' },
    { value: 'churn', label: 'Churn' },
    { value: 'nao_renovado', label: 'Não Renovado' },
    { value: 'upsell', label: 'Upsell' },
    { value: 'bonus_elite', label: 'Bônus Elite' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar Escritório</DialogTitle></DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as OfficeStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={form.active_product_id} onValueChange={v => setForm({ ...form, active_product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Onboarding</Label>
              <Input type="date" value={form.onboarding_date} onChange={e => setForm({ ...form, onboarding_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Data Ativação</Label>
              <Input type="date" value={form.activation_date} onChange={e => setForm({ ...form, activation_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.visible_in_directory} onCheckedChange={v => setForm({ ...form, visible_in_directory: v })} />
            <Label>Visível no diretório</Label>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
