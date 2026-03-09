import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { ContractStatusBadge } from '@/components/clientes/StatusBadge';

interface Contract {
  id: string;
  office_id: string;
  status: string;
  value: number | null;
  monthly_value: number | null;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  installments_overdue: number | null;
  installments_total: number | null;
  asaas_link: string | null;
  offices: { id: string; name: string };
  products: { name: string };
  product_id: string;
}

function currency(val: number | null) {
  if (val == null) return '—';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmt(date: string | null) {
  if (!date) return '—';
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
}

export default function ContratosGlobal() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [startFrom, setStartFrom] = useState('');
  const [startTo, setStartTo] = useState('');
  const navigate = useNavigate();

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    const [cRes, pRes, oRes] = await Promise.all([
      supabase.from('contracts').select('*, offices(id, name, installments_overdue), products:product_id(name)').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name').order('name'),
      supabase.from('offices').select('id, installments_overdue'),
    ]);
    setContracts((cRes.data as Contract[]) || []);
    setProducts(pRes.data || []);
    // Merge office-level overdue into contracts for display
    const overdueMap = new Map((oRes.data || []).map((o: any) => [o.id, o.installments_overdue || 0]));
    setContracts(prev => prev.map(c => ({ ...c, installments_overdue: overdueMap.get(c.office_id) || 0 })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const filtered = contracts.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (productFilter !== 'all' && c.product_id !== productFilter) return false;
    if (startFrom && c.start_date && c.start_date < startFrom) return false;
    if (startTo && c.start_date && c.start_date > startTo) return false;
    if (search) {
      const s = search.toLowerCase();
      return c.offices?.name?.toLowerCase().includes(s) || c.products?.name?.toLowerCase().includes(s);
    }
    return true;
  });

  const ativos = contracts.filter(c => c.status === 'ativo').length;
  const vencidos = contracts.reduce((sum, c) => sum + (c.installments_overdue || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contratos</h1>
        <p className="text-sm text-muted-foreground">
          {ativos} ativo{ativos !== 1 ? 's' : ''} • {vencidos} parcela{vencidos !== 1 ? 's' : ''} vencida{vencidos !== 1 ? 's' : ''} • {contracts.length} total
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por escritório ou produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="encerrado">Encerrado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Produto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" placeholder="De" value={startFrom} onChange={e => setStartFrom(e.target.value)} className="w-[150px]" />
        <Input type="date" placeholder="Até" value={startTo} onChange={e => setStartTo(e.target.value)} className="w-[150px]" />
      </div>

      {loading ? (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="bg-muted/50 h-11 flex items-center px-4 gap-12">
            {[...Array(7)].map((_, i) => <div key={i} className="h-3 w-16 rounded skeleton-shimmer" />)}
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border-b border-border/50 px-4 py-3 flex items-center gap-12">
              {[...Array(7)].map((_, j) => <div key={j} className="h-4 w-20 rounded skeleton-shimmer" />)}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search || statusFilter !== 'all' || productFilter !== 'all' ? 'Nenhum contrato encontrado.' : 'Nenhum contrato registrado.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Escritório</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Mensal</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Renovação</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/clientes/${c.office_id}`)}>
                  <TableCell className="font-medium">{c.offices?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.products?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{currency(c.value)}</TableCell>
                  <TableCell className="text-muted-foreground">{currency(c.monthly_value)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmt(c.start_date)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmt(c.renewal_date)}</TableCell>
                  <TableCell>
                    {(c.installments_overdue || 0) > 0 ? (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                        {c.installments_overdue} vencida{(c.installments_overdue || 0) > 1 ? 's' : ''}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">{c.installments_total || 0} total</span>
                    )}
                  </TableCell>
                  <TableCell><ContractStatusBadge status={c.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
