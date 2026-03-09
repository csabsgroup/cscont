import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, DollarSign, BarChart3, Heart, Users, Briefcase } from 'lucide-react';
import { HealthBadge } from './HealthBadge';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props { officeId: string; officeOverdue?: number; }

export function ClienteMetricas({ officeId, officeOverdue }: Props) {
  const [contracts, setContracts] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);

  const fetch = useCallback(async () => {
    setLoading(true);
    const [contractsRes, healthRes, metricsRes] = await Promise.all([
      supabase.from('contracts').select('*').eq('office_id', officeId).order('created_at'),
      supabase.from('health_scores').select('*').eq('office_id', officeId).maybeSingle(),
      supabase.from('office_metrics_history').select('period_month, period_year, faturamento_mensal, qtd_clientes, qtd_colaboradores')
        .eq('office_id', officeId)
        .order('period_year', { ascending: true })
        .order('period_month', { ascending: true }),
    ]);
    setContracts(contractsRes.data || []);
    setHealth(healthRes.data);
    setMetricsHistory(metricsRes.data || []);
    setLoading(false);
  }, [officeId]);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const ltv = contracts.reduce((sum, c) => sum + (Number(c.value) || 0), 0);
  const cycles = contracts.length;
  const activeContract = contracts.find(c => c.status === 'ativo');
  const retentionMonths = activeContract?.start_date
    ? Math.floor((Date.now() - new Date(activeContract.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : null;

  // Chart data
  const MONTH_LABELS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const chartData = metricsHistory.map(m => ({
    month: `${MONTH_LABELS[m.period_month]}/${String(m.period_year).slice(-2)}`,
    faturamento: m.faturamento_mensal,
    clientes: m.qtd_clientes,
    colaboradores: m.qtd_colaboradores,
  }));

  // Contract cycles by year
  const contractsByYear: Record<number, number> = {};
  contracts.forEach(c => {
    const year = new Date(c.created_at).getFullYear();
    contractsByYear[year] = (contractsByYear[year] || 0) + 1;
  });
  const contractChartData = Object.entries(contractsByYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, count]) => ({ year, count }));

  const hasMetrics = chartData.length > 0;

  const EmptyChart = ({ message }: { message: string }) => (
    <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
      {message}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />LTV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{ltv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            <p className="text-xs text-muted-foreground">{cycles} ciclo{cycles !== 1 ? 's' : ''} de contrato</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />Retenção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{retentionMonths != null ? `${retentionMonths} meses` : '—'}</p>
            <p className="text-xs text-muted-foreground">Tempo no contrato ativo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Heart className="h-4 w-4 text-muted-foreground" />Health Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            {health ? (
              <>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{Math.round(health.score)}</p>
                  <HealthBadge score={health.score} band={health.band} size="md" />
                </div>
                <p className="text-xs text-muted-foreground">Última atualização: {new Date(health.calculated_at).toLocaleDateString('pt-BR')}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Ainda não calculado</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />Parcelas
            </CardTitle>
          </CardHeader>
          <CardContent>
        <p className="text-2xl font-bold">{officeOverdue ?? 0}</p>
            <p className="text-xs text-muted-foreground">Parcelas vencidas</p>
          </CardContent>
        </Card>
      </div>

      {/* Evolution Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Faturamento Mensal */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />Faturamento Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasMetrics && chartData.some(d => d.faturamento != null) ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-[10px]" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-[10px]" tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [`R$ ${v?.toLocaleString('pt-BR')}`, 'Faturamento']} />
                  <Line type="monotone" dataKey="faturamento" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="Sem dados de faturamento. Os dados serão preenchidos conforme o CS preencher os formulários." />
            )}
          </CardContent>
        </Card>

        {/* Clientes Ativos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />Clientes Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasMetrics && chartData.some(d => d.clientes != null) ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-[10px]" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-[10px]" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip formatter={(v: number) => [v, 'Clientes']} />
                  <Line type="monotone" dataKey="clientes" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="Sem dados de clientes. Os dados serão preenchidos conforme o CS preencher os formulários." />
            )}
          </CardContent>
        </Card>

        {/* Funcionários */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />Funcionários
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasMetrics && chartData.some(d => d.colaboradores != null) ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-[10px]" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-[10px]" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip formatter={(v: number) => [v, 'Colaboradores']} />
                  <Line type="monotone" dataKey="colaboradores" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="Sem dados de funcionários. Os dados serão preenchidos conforme o CS preencher os formulários." />
            )}
          </CardContent>
        </Card>

        {/* Contratos por ano */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />Contratos (Ciclos)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contractChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={contractChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="year" className="text-[10px]" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-[10px]" tick={{ fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, 'Contratos']} />
                  <Bar dataKey="count" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="Nenhum contrato registrado." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
