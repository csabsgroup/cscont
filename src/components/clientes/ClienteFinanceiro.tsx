import { useState, useCallback, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaginationWithPageSize } from '@/components/shared/PaginationWithPageSize';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, RefreshCw, AlertTriangle, FileText, ExternalLink, Calendar, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  officeId: string;
  cnpj: string | null;
}

interface Payment {
  id: string;
  value: number;
  netValue: number;
  dueDate: string;
  paymentDate: string | null;
  status: string;
  billingType: string;
  description: string | null;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  isPaid: boolean;
  isOverdue: boolean;
  isPending: boolean;
  isCancelled: boolean;
  isDeleted: boolean;
  daysOverdue: number;
  statusLabel: string;
}

interface FinancialData {
  customer_id: string;
  office_id: string;
  cnpj: string;
  summary: {
    totalPaid: number;
    totalOverdue: number;
    totalPending: number;
    countPaid: number;
    countOverdue: number;
    countPending: number;
    countCancelled: number;
    nextPayment: Payment | null;
    oldestOverdue: Payment | null;
  };
  payments: Payment[];
}

const CACHE_TTL = 5 * 60 * 1000;

function useFinancialData(officeId: string, cnpj: string | null) {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; noCnpj?: boolean; notFound?: boolean; cnpj?: string } | null>(null);
  const lastFetch = useRef(0);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!cnpj) {
      setError({ message: 'Escritório sem CNPJ cadastrado', noCnpj: true });
      return;
    }
    if (!forceRefresh && data && (Date.now() - lastFetch.current) < CACHE_TTL) return;

    setLoading(true);
    setError(null);

    const { data: result, error: fnError } = await supabase.functions.invoke('integration-asaas', {
      body: { action: 'getFinancialByOffice', office_id: officeId },
    });

    if (fnError) {
      setError({ message: fnError.message || 'Erro ao buscar dados financeiros' });
    } else if (result?.error) {
      setError({ message: result.error, noCnpj: result.noCnpj, notFound: result.notFound, cnpj: result.cnpj });
    } else {
      setData(result);
      lastFetch.current = Date.now();
    }
    setLoading(false);
  }, [officeId, cnpj, data]);

  useEffect(() => { fetchData(); }, [officeId]);

  return { data, loading, error, refresh: () => fetchData(true) };
}

const fmtCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y?.slice(2)}`;
};

const billingTypeLabel: Record<string, string> = {
  BOLETO: 'Boleto', PIX: 'PIX', CREDIT_CARD: 'Cartão', DEBIT_CARD: 'Débito', UNDEFINED: '—', TRANSFER: 'Transferência', DEPOSIT: 'Depósito',
};

type StatusFilter = 'all' | 'paid' | 'pending' | 'overdue' | 'cancelled';
type PeriodFilter = 'all' | '1m' | '3m' | '6m' | '1y';

export function ClienteFinanceiro({ officeId, cnpj }: Props) {
  const { data, loading, error, refresh } = useFinancialData(officeId, cnpj);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
    toast.success('Dados atualizados!');
  };

  // Error / empty states
  if (!loading && error?.noCnpj) {
    return (
      <Card className="p-8 text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-yellow-500 mx-auto" />
        <p className="text-sm text-muted-foreground">Este escritório não tem CNPJ cadastrado. Adicione o CNPJ no cabeçalho para consultar a situação financeira.</p>
      </Card>
    );
  }

  if (!loading && error?.notFound) {
    return (
      <Card className="p-8 text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
        <p className="text-sm text-muted-foreground">Nenhum cliente com CNPJ <strong>{error.cnpj}</strong> encontrado no Asaas. Verifique se o CNPJ está correto.</p>
      </Card>
    );
  }

  if (!loading && error) {
    return (
      <Card className="p-8 text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button variant="outline" size="sm" onClick={handleRefresh}>Tentar novamente</Button>
      </Card>
    );
  }

  // Loading skeleton
  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const { summary, payments } = data;

  // Filter payments
  let filtered = [...payments];
  if (statusFilter === 'paid') filtered = filtered.filter(p => p.isPaid);
  if (statusFilter === 'pending') filtered = filtered.filter(p => p.isPending);
  if (statusFilter === 'overdue') filtered = filtered.filter(p => p.isOverdue);
  if (statusFilter === 'cancelled') filtered = filtered.filter(p => p.isCancelled);

  if (periodFilter !== 'all') {
    const now = new Date();
    const months = periodFilter === '1m' ? 1 : periodFilter === '3m' ? 3 : periodFilter === '6m' ? 6 : 12;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    filtered = filtered.filter(p => new Date(p.dueDate) >= cutoff);
  }

  const totalFiltered = filtered.length;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(totalFiltered / pageSize);

  const statusBadge = (p: Payment) => {
    if (p.isPaid) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">{p.statusLabel}</Badge>;
    if (p.isOverdue) return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0">{p.statusLabel}</Badge>;
    if (p.isPending) return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">{p.statusLabel}</Badge>;
    return <Badge variant="secondary">{p.statusLabel}</Badge>;
  };

  const summaryCards = [
    { label: 'Pagas', value: fmtCurrency(summary.totalPaid), count: summary.countPaid, colorClass: 'text-green-600 dark:text-green-400', bgClass: 'bg-green-50 dark:bg-green-950/20' },
    { label: 'A Vencer', value: fmtCurrency(summary.totalPending), count: summary.countPending, colorClass: 'text-yellow-600 dark:text-yellow-400', bgClass: 'bg-yellow-50 dark:bg-yellow-950/20' },
    { label: 'Vencidas', value: fmtCurrency(summary.totalOverdue), count: summary.countOverdue, colorClass: 'text-red-600 dark:text-red-400', bgClass: 'bg-red-50 dark:bg-red-950/20' },
    { label: 'Inadimplência', value: fmtCurrency(summary.totalOverdue), count: summary.countOverdue, colorClass: 'text-red-700 dark:text-red-300', bgClass: 'bg-red-100 dark:bg-red-950/30' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Situação Financeira
          </h2>
          <p className="text-xs text-muted-foreground">CNPJ: {data.cnpj} • Dados do Asaas</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map((card, i) => (
          <Card key={i} className={`p-4 ${card.bgClass} border-0`}>
            <div className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground">{card.label}</div>
            <div className={`text-2xl font-bold mt-1 ${card.colorClass}`}>{card.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{card.count} {card.count === 1 ? 'parcela' : 'parcelas'}</div>
          </Card>
        ))}
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {summary.nextPayment && (
          <Card className="p-4 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-yellow-500 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground">Próxima parcela</div>
              <div className="text-sm font-semibold text-foreground">
                {fmtDate(summary.nextPayment.dueDate)} • {fmtCurrency(summary.nextPayment.value)} • {billingTypeLabel[summary.nextPayment.billingType] || summary.nextPayment.billingType}
              </div>
            </div>
          </Card>
        )}
        {summary.oldestOverdue && (
          <Card className="p-4 flex items-center gap-3 border-red-200 dark:border-red-900/40">
            <TrendingDown className="h-5 w-5 text-red-500 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground">Parcela mais atrasada</div>
              <div className="text-sm font-semibold text-foreground">
                {fmtDate(summary.oldestOverdue.dueDate)} • {fmtCurrency(summary.oldestOverdue.value)} • <span className="text-red-600 dark:text-red-400">{summary.oldestOverdue.daysOverdue} dias de atraso</span>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xs uppercase font-medium tracking-wider text-muted-foreground">Histórico de Cobranças</h3>
          <div className="flex-1" />
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="paid">Pagas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="overdue">Vencidas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={periodFilter} onValueChange={(v) => { setPeriodFilter(v as PeriodFilter); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo período</SelectItem>
              <SelectItem value="1m">Último mês</SelectItem>
              <SelectItem value="3m">Últimos 3 meses</SelectItem>
              <SelectItem value="6m">Últimos 6 meses</SelectItem>
              <SelectItem value="1y">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Vencimento</TableHead>
                <TableHead className="text-xs">Valor</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Pagamento</TableHead>
                <TableHead className="text-xs">Dias atraso</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhuma cobrança encontrada.</TableCell></TableRow>
              )}
              {paginated.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{fmtDate(p.dueDate)}</TableCell>
                  <TableCell className="text-sm font-medium">{fmtCurrency(p.value)}</TableCell>
                  <TableCell>{statusBadge(p)}</TableCell>
                  <TableCell className="text-sm">{p.paymentDate ? fmtDate(p.paymentDate) : '—'}</TableCell>
                  <TableCell className="text-sm">{p.isOverdue ? <span className="text-red-600 dark:text-red-400 font-medium">{p.daysOverdue} dias</span> : '—'}</TableCell>
                  <TableCell className="text-sm">{billingTypeLabel[p.billingType] || p.billingType}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {(p.invoiceUrl || p.bankSlipUrl) && (
                        <a href={p.invoiceUrl || p.bankSlipUrl || ''} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {p.isPaid && p.invoiceUrl && (
                        <a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                          <FileText className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <PaginationWithPageSize
          totalItems={totalFiltered}
          currentPage={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          itemLabel="cobranças"
        />
      </Card>
    </div>
  );
}
