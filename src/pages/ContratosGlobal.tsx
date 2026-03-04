import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileText, Search } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contracts')
      .select('*, offices(id, name), products:product_id(name)')
      .order('created_at', { ascending: false });
    setContracts((data as Contract[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const filtered = contracts.filter(c =>
    c.offices?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.products?.name?.toLowerCase().includes(search.toLowerCase())
  );

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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por escritório ou produto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search ? 'Nenhum contrato encontrado.' : 'Nenhum contrato registrado.'}
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
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/clientes/${c.office_id}`)}
                >
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
                      <span className="text-muted-foreground text-sm">
                        {c.installments_total || 0} total
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ContractStatusBadge status={c.status} />
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
