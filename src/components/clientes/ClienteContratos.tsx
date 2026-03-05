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
import { Plus, FileText, ExternalLink } from 'lucide-react';
import { ContractStatusBadge } from './StatusBadge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

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
  const { isViewer } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

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
      
      // Auto-fill cycle dates on the office
      const officeUpdate: Record<string, any> = {};
      if (form.start_date) officeUpdate.cycle_start_date = form.start_date;
      if (form.end_date) officeUpdate.cycle_end_date = form.end_date;
      
      // If this is the first contract, also set activation_date
      if (contracts.length === 0 && form.start_date) {
        // Check if activation_date is already set
        const { data: officeData } = await supabase.from('offices').select('activation_date').eq('id', officeId).single();
        if (officeData && !officeData.activation_date) {
          officeUpdate.activation_date = form.start_date;
        }
      }
      
      if (Object.keys(officeUpdate).length > 0) {
        await supabase.from('offices').update(officeUpdate).eq('id', officeId);
      }
      
      setOpen(false);
      setForm(emptyForm);
      onRefresh();
    }
    setSaving(false);
  };

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
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Produto *</Label>
                    <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as ContractStatus })}>
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
                    <Input type="number" step="0.01" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Mensal</Label>
                    <Input type="number" step="0.01" value={form.monthly_value} onChange={e => setForm({ ...form, monthly_value: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Início</Label>
                    <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim</Label>
                    <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Renovação</Label>
                    <Input type="date" value={form.renewal_date} onChange={e => setForm({ ...form, renewal_date: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Parcelas Total</Label>
                    <Input type="number" value={form.installments_total} onChange={e => setForm({ ...form, installments_total: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Parcelas Vencidas</Label>
                    <Input type="number" value={form.installments_overdue} onChange={e => setForm({ ...form, installments_overdue: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Link Asaas</Label>
                  <Input value={form.asaas_link} onChange={e => setForm({ ...form, asaas_link: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Notas de Negociação</Label>
                  <Textarea value={form.negotiation_notes} onChange={e => setForm({ ...form, negotiation_notes: e.target.value })} />
                </div>
                <Button type="submit" className="w-full" disabled={saving || !form.product_id}>
                  {saving ? 'Criando...' : 'Criar Contrato'}
                </Button>
              </form>
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
              <TableHead className="w-10"></TableHead>
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
                  {c.asaas_link && (
                    <a href={c.asaas_link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </a>
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
