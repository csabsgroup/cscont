import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Plus, FileText, ExternalLink, Pencil } from 'lucide-react';
import { ContractStatusBadge } from './StatusBadge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';
import { processContractDates } from '@/lib/mrr-helpers';

type ContractStatus = Database['public']['Enums']['contract_status'];

interface Contract {
  id: string;
  product_id: string;
  status: ContractStatus;
  value: number | null;
  monthly_value: number | null;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  installments_total: number | null;
  installments_overdue: number | null;
  asaas_link: string | null;
  negotiation_notes: string | null;
  products?: { name: string } | null;
}

interface Product {
  id: string;
  name: string;
}

interface Props {
  officeId: string;
  contracts: Contract[];
  onRefresh: () => void;
}

function fmt(d: string | null) {
  if (!d) return '—';
  return format(new Date(d), 'dd/MM/yyyy', { locale: ptBR });
}

function currency(v: number | null) {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const emptyForm = {
  product_id: '', status: 'pendente' as ContractStatus, value: '', monthly_value: '',
  start_date: '', end_date: '', renewal_date: '', installments_total: '',
  installments_overdue: '', asaas_link: '', negotiation_notes: '',
};

export function ClienteContratos({ officeId, contracts, onRefresh }: Props) {
  const { isViewer, isAdmin, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    supabase.from('products').select('id, name').eq('is_active', true).then(({ data }) => setProducts(data || []));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const contractData = {
      office_id: officeId,
      product_id: form.product_id,
      status: form.status,
      value: form.value ? Number(form.value) : null,
      monthly_value: form.monthly_value ? Number(form.monthly_value) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      renewal_date: form.renewal_date || null,
      installments_total: form.installments_total ? Number(form.installments_total) : null,
      installments_overdue: form.installments_overdue ? Number(form.installments_overdue) : null,
      asaas_link: form.asaas_link || null,
      negotiation_notes: form.negotiation_notes || null,
    };
    const { error } = await supabase.from('contracts').insert(contractData);
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success('Contrato criado!');
      try {
        await supabase.functions.invoke('execute-automations', {
          body: { action: 'triggerV2', trigger_type: 'contract.created', office_id: officeId, context: { suffix: `contract_${Date.now()}` } },
        });
      } catch (autoErr) { console.error('Automation trigger failed:', autoErr); }
      
      await processContractDates(officeId, {
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        monthly_value: form.monthly_value ? Number(form.monthly_value) : null,
        value: form.value ? Number(form.value) : null,
      });
      
      setOpen(false);
      setForm(emptyForm);
      onRefresh();
    }
    setSaving(false);
  };

  const openEdit = (c: Contract) => {
    setEditId(c.id);
    setEditForm({
      product_id: c.product_id,
      status: c.status,
      value: c.value?.toString() || '',
      monthly_value: c.monthly_value?.toString() || '',
      start_date: c.start_date || '',
      end_date: c.end_date || '',
      renewal_date: c.renewal_date || '',
      installments_total: c.installments_total?.toString() || '',
      installments_overdue: c.installments_overdue?.toString() || '',
      asaas_link: c.asaas_link || '',
      negotiation_notes: c.negotiation_notes || '',
    });
    setEditOpen(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId || !user) return;
    setEditSaving(true);

    const updateData = {
      product_id: editForm.product_id,
      status: editForm.status,
      value: editForm.value ? Number(editForm.value) : null,
      monthly_value: editForm.monthly_value ? Number(editForm.monthly_value) : null,
      start_date: editForm.start_date || null,
      end_date: editForm.end_date || null,
      renewal_date: editForm.renewal_date || null,
      installments_total: editForm.installments_total ? Number(editForm.installments_total) : null,
      installments_overdue: editForm.installments_overdue ? Number(editForm.installments_overdue) : null,
      asaas_link: editForm.asaas_link || null,
      negotiation_notes: editForm.negotiation_notes || null,
    };

    const { error } = await supabase.from('contracts').update(updateData).eq('id', editId);
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success('Contrato atualizado!');

      await processContractDates(officeId, {
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
        monthly_value: editForm.monthly_value ? Number(editForm.monthly_value) : null,
        value: editForm.value ? Number(editForm.value) : null,
      });

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'update_contract',
        entity_type: 'contract',
        entity_id: editId,
        details: { office_id: officeId, changes: updateData },
      });

      setEditOpen(false);
      setEditId(null);
      onRefresh();
    }
    setEditSaving(false);
  };

  const renderForm = (
    formData: typeof emptyForm,
    setFormData: (f: typeof emptyForm) => void,
    onSubmit: (e: React.FormEvent) => void,
    isSaving: boolean,
    submitLabel: string,
    isEdit: boolean,
  ) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Produto *</Label>
          <Select value={formData.product_id} onValueChange={v => setFormData({ ...formData, product_id: v })} disabled={isEdit && !isAdmin}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v as ContractStatus })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="encerrado">Encerrado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Valor Total</Label>
          <Input type="number" step="0.01" value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Valor Mensal</Label>
          <Input type="number" step="0.01" value={formData.monthly_value} onChange={e => setFormData({ ...formData, monthly_value: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Início</Label>
          <Input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Fim</Label>
          <Input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Renovação</Label>
          <Input type="date" value={formData.renewal_date} onChange={e => setFormData({ ...formData, renewal_date: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Parcelas Total</Label>
          <Input type="number" value={formData.installments_total} onChange={e => setFormData({ ...formData, installments_total: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Parcelas Vencidas</Label>
          <Input type="number" value={formData.installments_overdue} disabled placeholder="Sincronizado do Asaas" />
          <p className="text-[10px] text-muted-foreground">Este campo é atualizado automaticamente pelo Asaas</p>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Link Asaas</Label>
        <Input value={formData.asaas_link} onChange={e => setFormData({ ...formData, asaas_link: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Notas de Negociação</Label>
        <Textarea value={formData.negotiation_notes} onChange={e => setFormData({ ...formData, negotiation_notes: e.target.value })} />
      </div>
      <Button type="submit" className="w-full" disabled={isSaving || !formData.product_id}>
        {isSaving ? 'Salvando...' : submitLabel}
      </Button>
    </form>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{contracts.length} contrato{contracts.length !== 1 ? 's' : ''}</p>
        {!isViewer && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Novo Contrato</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Novo Contrato</DialogTitle></DialogHeader>
              {renderForm(form, setForm, handleSave, saving, 'Criar Contrato', false)}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {contracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm">Nenhum contrato cadastrado.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Mensal</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Parcelas</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.products?.name || '—'}</TableCell>
                <TableCell><ContractStatusBadge status={c.status} /></TableCell>
                <TableCell>{currency(c.value)}</TableCell>
                <TableCell>{currency(c.monthly_value)}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {fmt(c.start_date)} — {fmt(c.end_date)}
                </TableCell>
                <TableCell className="text-sm">
                  {c.installments_overdue ?? 0}/{c.installments_total ?? 0}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {!isViewer && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {c.asaas_link && (
                      <a href={c.asaas_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Edit Contract Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar Contrato</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {renderForm(editForm, setEditForm, handleEditSave, editSaving, 'Salvar Alterações', true)}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
