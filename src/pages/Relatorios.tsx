import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, BarChart3, TrendingDown, DollarSign, Heart, Users, Route, AlertTriangle, TrendingUp, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts';
import { differenceInDays, differenceInMonths, format, subMonths, subDays, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subQuarters, subYears } from 'date-fns';

const CHART_COLORS = ['hsl(346.8, 77.2%, 49.8%)', 'hsl(142.1, 76.2%, 36.3%)', 'hsl(45.4, 93.4%, 47.5%)', 'hsl(200, 70%, 50%)', 'hsl(280, 60%, 55%)', 'hsl(20, 80%, 55%)'];

const STATUS_LABELS: Record<string, string> = { ativo: 'Ativo', churn: 'Churn', nao_renovado: 'Não Renovado', nao_iniciado: 'Não Iniciado', upsell: 'Upsell', bonus_elite: 'Bônus Elite' };
const STATUS_COLORS: Record<string, string> = { ativo: 'hsl(142.1,76.2%,36.3%)', churn: 'hsl(0,84.2%,60.2%)', nao_renovado: 'hsl(45.4,93.4%,47.5%)', nao_iniciado: 'hsl(0,0%,65%)', upsell: 'hsl(346.8,77.2%,49.8%)', bonus_elite: 'hsl(280,60%,55%)' };

type PeriodType = 'month' | 'quarter' | 'semester' | 'year';

function getDateRange(period: PeriodType) {
  const now = new Date();
  switch (period) {
    case 'month': return { start: startOfMonth(now), end: endOfMonth(now), prevStart: startOfMonth(subMonths(now, 1)), prevEnd: endOfMonth(subMonths(now, 1)) };
    case 'quarter': return { start: startOfQuarter(now), end: endOfQuarter(now), prevStart: startOfQuarter(subQuarters(now, 1)), prevEnd: endOfQuarter(subQuarters(now, 1)) };
    case 'semester': return { start: subMonths(startOfMonth(now), 5), end: now, prevStart: subMonths(startOfMonth(now), 11), prevEnd: subMonths(now, 6) };
    case 'year': return { start: startOfYear(now), end: endOfYear(now), prevStart: startOfYear(subYears(now, 1)), prevEnd: endOfYear(subYears(now, 1)) };
  }
}

function inRange(dateStr: string, start: Date, end: Date) {
  const d = new Date(dateStr);
  return d >= start && d <= end;
}

function delta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? '+100%' : '—';
  const pct = ((current - previous) / previous * 100).toFixed(1);
  return Number(pct) >= 0 ? `+${pct}%` : `${pct}%`;
}

export default function Relatorios() {
  const [offices, setOffices] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [healthScores, setHealthScores] = useState<any[]>([]);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [formSubmissions, setFormSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('month');
  const [showComparison, setShowComparison] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [oRes, cRes, mRes, hRes, jRes, sRes, pRes, fRes] = await Promise.all([
      supabase.from('offices').select('*, products:active_product_id(name)'),
      supabase.from('contracts').select('*, products:product_id(name)'),
      supabase.from('meetings').select('*'),
      supabase.from('health_scores').select('*'),
      supabase.from('office_journey').select('*'),
      supabase.from('journey_stages').select('*, products:product_id(name)'),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('form_submissions').select('id, data, template_id, office_id, submitted_at'),
    ]);
    setOffices(oRes.data || []);
    setContracts(cRes.data || []);
    setMeetings(mRes.data || []);
    setHealthScores(hRes.data || []);
    setJourneys(jRes.data || []);
    setStages(sRes.data || []);
    setProfiles(pRes.data || []);
    setFormSubmissions(fRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const range = useMemo(() => getDateRange(period), [period]);

  if (loading) return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Relatórios</h1></div>
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-card p-6 space-y-3">
            <div className="h-4 w-20 rounded skeleton-shimmer" />
            <div className="h-8 w-16 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );

  // Filter by period
  const officesInPeriod = offices.filter(o => inRange(o.created_at, range.start, range.end));
  const officesPrev = offices.filter(o => inRange(o.created_at, range.prevStart, range.prevEnd));
  const meetingsInPeriod = meetings.filter(m => inRange(m.scheduled_at, range.start, range.end));
  const meetingsPrev = meetings.filter(m => inRange(m.scheduled_at, range.prevStart, range.prevEnd));
  const contractsInPeriod = contracts.filter(c => c.start_date && inRange(c.start_date, range.start, range.end));

  const total = offices.length;
  const ativos = offices.filter(o => o.status === 'ativo' || o.status === 'bonus_elite').length;
  const churnCount = offices.filter(o => o.status === 'churn').length;
  const naoRenovado = offices.filter(o => o.status === 'nao_renovado').length;
  const retentionRate = total > 0 ? ((ativos / total) * 100).toFixed(1) : '0';

  // Status distribution
  const statusCounts = offices.reduce((acc: Record<string, number>, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
  const statusData = Object.entries(statusCounts).map(([s, c]) => ({ name: STATUS_LABELS[s] || s, value: c, color: STATUS_COLORS[s] || 'hsl(0,0%,65%)' }));

  // Product distribution
  const productCounts = offices.reduce((acc: Record<string, number>, o) => { const n = o.products?.name || 'Sem produto'; acc[n] = (acc[n] || 0) + 1; return acc; }, {});
  const productData = Object.entries(productCounts).map(([name, value]) => ({ name, value }));

  // MRR by product
  const mrrByProduct = contracts.filter(c => c.status === 'ativo').reduce((acc: Record<string, number>, c) => { const n = c.products?.name || 'Sem produto'; acc[n] = (acc[n] || 0) + (c.monthly_value || 0); return acc; }, {});
  const mrrData = Object.entries(mrrByProduct).map(([name, mrr]) => ({ name, mrr }));

  const totalLTV = contracts.reduce((s, c) => s + (c.value || 0), 0);
  const activeMRR = contracts.filter(c => c.status === 'ativo').reduce((s, c) => s + (c.monthly_value || 0), 0);

  // Health
  const greenCount = healthScores.filter(h => h.band === 'green').length;
  const yellowCount = healthScores.filter(h => h.band === 'yellow').length;
  const redCount = healthScores.filter(h => h.band === 'red').length;
  const avgHealth = healthScores.length > 0 ? Math.round(healthScores.reduce((s, h) => s + h.score, 0) / healthScores.length) : 0;
  const healthDistData = [
    { name: 'Verde', value: greenCount, color: 'hsl(142.1,76.2%,36.3%)' },
    { name: 'Amarelo', value: yellowCount, color: 'hsl(45.4,93.4%,47.5%)' },
    { name: 'Vermelho', value: redCount, color: 'hsl(0,84.2%,60.2%)' },
  ].filter(d => d.value > 0);

  // NPS from form submissions (look for rating_nps fields)
  const npsValues = formSubmissions.flatMap(f => {
    const data = f.data as Record<string, any>;
    if (!data) return [];
    return Object.values(data).filter(v => typeof v === 'string' && !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 10).map(v => Number(v));
  });
  const avgNps = npsValues.length > 0 ? (npsValues.reduce((s, v) => s + v, 0) / npsValues.length).toFixed(1) : '—';
  const npsCoverage = offices.length > 0 ? Math.round((new Set(formSubmissions.map(f => f.office_id)).size / offices.length) * 100) : 0;

  // Meetings coverage
  const completedMeetings = meetings.filter(m => m.status === 'completed');
  const completedInPeriod = meetingsInPeriod.filter(m => m.status === 'completed');
  const completedPrev = meetingsPrev.filter(m => m.status === 'completed');
  const profileMap = new Map(profiles.map(p => [p.id, p.full_name || 'Sem nome']));
  const meetingsByCsm = completedMeetings.reduce((acc: Record<string, number>, m) => { const n = profileMap.get(m.user_id) || 'Desconhecido'; acc[n] = (acc[n] || 0) + 1; return acc; }, {});
  const meetingsByCsmData = Object.entries(meetingsByCsm).map(([name, count]) => ({ name, count }));

  const lastMeetingMap: Record<string, string> = {};
  completedMeetings.forEach(m => { if (!lastMeetingMap[m.office_id] || m.scheduled_at > lastMeetingMap[m.office_id]) lastMeetingMap[m.office_id] = m.scheduled_at; });
  const activeOfficeIds = offices.filter(o => o.status === 'ativo').map(o => o.id);
  const noMeeting30 = activeOfficeIds.filter(id => { const l = lastMeetingMap[id]; return !l || differenceInDays(new Date(), new Date(l)) > 30; });

  // Inadimplência
  const activeContracts = contracts.filter(c => c.status === 'ativo');
  const overdueContracts = activeContracts.filter(c => (c.installments_overdue || 0) > 0);
  const totalOverdueValue = overdueContracts.reduce((s, c) => s + (c.monthly_value || 0) * (c.installments_overdue || 0), 0);
  const overduePct = activeMRR > 0 ? ((totalOverdueValue / activeMRR) * 100).toFixed(1) : '0';

  const churnedOffices = offices.filter(o => o.status === 'churn');
  const avgTimeToChurn = churnedOffices.length > 0
    ? Math.round(churnedOffices.reduce((s, o) => s + differenceInMonths(new Date(), new Date(o.created_at)), 0) / churnedOffices.length) : 0;

  const stageMap = new Map(stages.map(s => [s.id, s]));
  const journeyStageCount = journeys.reduce((acc: Record<string, number>, j) => {
    const s = stageMap.get(j.journey_stage_id);
    const name = s ? `${s.name} (${s.products?.name || ''})` : 'Desconhecida';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const journeyData = Object.entries(journeyStageCount).map(([name, count]) => ({ name, count }));

  const monthlyMap = offices.reduce((acc: Record<string, number>, o) => { const m = o.created_at?.substring(0, 7); if (m) acc[m] = (acc[m] || 0) + 1; return acc; }, {});
  const monthlyData = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month: month.split('-').reverse().join('/'), novos: count }));

  const periodLabel: Record<PeriodType, string> = { month: 'Mês', quarter: 'Trimestre', semester: 'Semestre', year: 'Ano' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">{offices.length} escritório{offices.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={period} onValueChange={v => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="semester">Semestre</SelectItem>
              <SelectItem value="year">Ano</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant={showComparison ? 'default' : 'outline'} className="cursor-pointer text-xs" onClick={() => setShowComparison(!showComparison)}>
            vs anterior
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="executiva" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="executiva" className="gap-1.5"><BarChart3 className="h-4 w-4" />Visão Executiva</TabsTrigger>
          <TabsTrigger value="churn" className="gap-1.5"><TrendingDown className="h-4 w-4" />Churn & Retenção</TabsTrigger>
          <TabsTrigger value="receita" className="gap-1.5"><DollarSign className="h-4 w-4" />Receita & LTV</TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5"><Heart className="h-4 w-4" />Health/NPS</TabsTrigger>
          <TabsTrigger value="cobertura" className="gap-1.5"><Users className="h-4 w-4" />Cobertura</TabsTrigger>
          <TabsTrigger value="jornada" className="gap-1.5"><Route className="h-4 w-4" />Jornada</TabsTrigger>
          <TabsTrigger value="inadimplencia" className="gap-1.5"><AlertTriangle className="h-4 w-4" />Inadimplência</TabsTrigger>
          <TabsTrigger value="evolucao" className="gap-1.5"><TrendingUp className="h-4 w-4" />Evolução</TabsTrigger>
        </TabsList>

        {/* Visão Executiva */}
        <TabsContent value="executiva" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <KPI label="Total de Clientes" value={total} />
            <KPI label={`Novos (${periodLabel[period]})`} value={officesInPeriod.length} comparison={showComparison ? delta(officesInPeriod.length, officesPrev.length) : undefined} />
            <KPI label="Ativos" value={ativos} className="text-success" />
            <KPI label="Taxa de Retenção" value={`${retentionRate}%`} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Distribuição por Status">
              {statusData.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart><Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Distribuição por Produto">
              {productData.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={productData}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} /><Tooltip />
                    <Bar dataKey="value" name="Escritórios" radius={[4,4,0,0]}>{productData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </TabsContent>

        {/* Churn & Retenção */}
        <TabsContent value="churn" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <KPI label="Churn" value={churnCount} className="text-destructive" />
            <KPI label="Não Renovado" value={naoRenovado} className="text-warning" />
            <KPI label="Não Iniciado" value={offices.filter(o => o.status === 'nao_iniciado').length} />
            <KPI label="Tempo Médio até Churn" value={`${avgTimeToChurn} meses`} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <KPI label="Taxa de Retenção" value={`${retentionRate}%`} />
            <KPI label="Taxa de Churn" value={`${total > 0 ? ((churnCount / total) * 100).toFixed(1) : 0}%`} className="text-destructive" />
          </div>
        </TabsContent>

        {/* Receita & LTV */}
        <TabsContent value="receita" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <KPI label="MRR Total" value={`R$ ${activeMRR.toLocaleString('pt-BR')}`} />
            <KPI label="LTV Total" value={`R$ ${totalLTV.toLocaleString('pt-BR')}`} />
            <KPI label="Ticket Médio Mensal" value={activeContracts.length > 0 ? `R$ ${Math.round(activeMRR / activeContracts.length).toLocaleString('pt-BR')}` : '—'} />
          </div>
          <ChartCard title="MRR por Produto">
            {mrrData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={mrrData}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} /><Tooltip formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                  <Bar dataKey="mrr" name="MRR" radius={[4,4,0,0]}>{mrrData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </TabsContent>

        {/* Health/NPS */}
        <TabsContent value="health" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <KPI label="Health Médio" value={avgHealth} />
            <KPI label="Verde" value={greenCount} className="text-success" />
            <KPI label="Amarelo" value={yellowCount} className="text-warning" />
            <KPI label="Vermelho" value={redCount} className="text-destructive" />
            <KPI label="NPS Médio" value={avgNps} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <KPI label="Cobertura NPS" value={`${npsCoverage}%`} />
            <KPI label={`Reuniões no ${periodLabel[period]}`} value={completedInPeriod.length} comparison={showComparison ? delta(completedInPeriod.length, completedPrev.length) : undefined} />
          </div>
          <ChartCard title="Distribuição de Health">
            {healthDistData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart><Pie data={healthDistData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {healthDistData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie><Tooltip /><Legend /></PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </TabsContent>

        {/* Cobertura */}
        <TabsContent value="cobertura" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <KPI label={`Reuniões (${periodLabel[period]})`} value={completedInPeriod.length} comparison={showComparison ? delta(completedInPeriod.length, completedPrev.length) : undefined} />
            <KPI label="Sem Reunião +30 dias" value={noMeeting30.length} className="text-warning" />
            <KPI label="% Cobertura" value={`${activeOfficeIds.length > 0 ? ((1 - noMeeting30.length / activeOfficeIds.length) * 100).toFixed(0) : 0}%`} />
          </div>
          <ChartCard title="Reuniões por CSM">
            {meetingsByCsmData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={meetingsByCsmData}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} /><Tooltip />
                  <Bar dataKey="count" name="Reuniões" radius={[4,4,0,0]}>{meetingsByCsmData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </TabsContent>

        {/* Jornada */}
        <TabsContent value="jornada" className="space-y-6">
          <ChartCard title="Distribuição por Etapa">
            {journeyData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={journeyData} layout="vertical"><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={200} /><Tooltip />
                  <Bar dataKey="count" name="Escritórios" radius={[0,4,4,0]}>{journeyData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </TabsContent>

        {/* Inadimplência */}
        <TabsContent value="inadimplencia" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <KPI label="Valor Inadimplente" value={`R$ ${totalOverdueValue.toLocaleString('pt-BR')}`} className="text-destructive" />
            <KPI label="% da Carteira Ativa" value={`${overduePct}%`} className="text-destructive" />
            <KPI label="Contratos Inadimplentes" value={overdueContracts.length} />
          </div>
          {overdueContracts.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Clientes com Parcelas Vencidas</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overdueContracts.map(c => {
                    const office = offices.find(o => o.id === c.office_id);
                    return (
                      <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div><p className="text-sm font-medium">{office?.name || 'Escritório'}</p><p className="text-xs text-muted-foreground">{c.products?.name}</p></div>
                        <Badge variant="destructive">{c.installments_overdue} parcela{c.installments_overdue > 1 ? 's' : ''}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Evolução */}
        <TabsContent value="evolucao" className="space-y-6">
          <ChartCard title="Evolução Mensal (novos clientes)">
            {monthlyData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="month" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} /><Tooltip />
                  <Area type="monotone" dataKey="novos" name="Novos" stroke="hsl(346.8,77.2%,49.8%)" fill="hsl(346.8,77.2%,49.8%)" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPI({ label, value, className, comparison }: { label: string; value: string | number; className?: string; comparison?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${className || ''}`}>{value}</div>
        {comparison && <p className={`text-xs mt-1 ${comparison.startsWith('+') ? 'text-success' : comparison.startsWith('-') ? 'text-destructive' : 'text-muted-foreground'}`}>{comparison} vs anterior</p>}
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <BarChart3 className="mb-2 h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Sem dados para exibir</p>
    </div>
  );
}
