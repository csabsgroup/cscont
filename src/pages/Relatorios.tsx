import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, BarChart3, TrendingDown, DollarSign, Heart, Users, Route,
  AlertTriangle, TrendingUp, ArrowUp, ArrowDown, Minus, X, Layers, GitBranch,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts';
import {
  differenceInDays, differenceInMonths, format, subMonths, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear, subQuarters, subYears, parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import IndicatorBuilder from '@/components/relatorios/IndicatorBuilder';
import CohortAnalysis from '@/components/relatorios/CohortAnalysis';

// ─── Constants ───
const COLORS = {
  primary: 'hsl(var(--primary))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  destructive: 'hsl(var(--destructive))',
  green: 'hsl(142.1,76.2%,36.3%)',
  yellow: 'hsl(45.4,93.4%,47.5%)',
  red: 'hsl(0,84.2%,60.2%)',
  blue: 'hsl(200,70%,50%)',
  purple: 'hsl(280,60%,55%)',
  orange: 'hsl(20,80%,55%)',
  muted: 'hsl(var(--muted-foreground))',
};
const CHART_COLORS = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.blue, COLORS.purple, COLORS.orange];
const STATUS_LABELS: Record<string, string> = { ativo: 'Ativo', churn: 'Churn', nao_renovado: 'Não Renovado', nao_iniciado: 'Não Iniciado', upsell: 'Upsell', bonus_elite: 'Bônus Elite', pausado: 'Pausado' };

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

function inRange(dateStr: string | null, start: Date, end: Date) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= start && d <= end;
}

function deltaStr(current: number, previous: number) {
  if (previous === 0) return current > 0 ? '+100%' : '—';
  const pct = ((current - previous) / previous * 100).toFixed(1);
  return Number(pct) >= 0 ? `+${pct}%` : `${pct}%`;
}

function getLast12Months() {
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    months.push(format(subMonths(new Date(), i), 'yyyy-MM'));
  }
  return months;
}

export default function Relatorios() {
  const { user, role, isAdmin, isManager, isCSM } = useAuth();
  const [offices, setOffices] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [healthScores, setHealthScores] = useState<any[]>([]);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [formSubmissions, setFormSubmissions] = useState<any[]>([]);
  const [stageHistory, setStageHistory] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [csmUsers, setCsmUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [period, setPeriod] = useState<PeriodType>('month');
  const [showComparison, setShowComparison] = useState(true);
  const [filterCsm, setFilterCsm] = useState<string>('all');
  const [filterProduct, setFilterProduct] = useState<string>('all');

  const [churnReasons, setChurnReasons] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [oRes, cRes, mRes, hRes, jRes, sRes, pRes, fRes, shRes, prRes, urRes, crRes] = await Promise.all([
      supabase.from('offices').select('*, products:active_product_id(name)'),
      supabase.from('contracts').select('*, products:product_id(name)'),
      supabase.from('meetings').select('*'),
      supabase.from('health_scores').select('*'),
      supabase.from('office_journey').select('*'),
      supabase.from('journey_stages').select('*, products:product_id(name)'),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('form_submissions').select('id, data, template_id, office_id, submitted_at'),
      supabase.from('office_stage_history').select('*'),
      supabase.from('products').select('id, name').eq('is_active', true),
      supabase.from('user_roles').select('user_id, role').eq('role', 'csm'),
      supabase.from('churn_reasons').select('id, name'),
    ]);
    const churnReasonMap = new Map((crRes.data || []).map((r: any) => [r.id, r.name]));
    setChurnReasons(crRes.data || []);
    // Enrich offices with churn reason name
    setOffices((oRes.data || []).map((o: any) => ({
      ...o,
      churn_reason_name: o.churn_reason_id ? churnReasonMap.get(o.churn_reason_id) || null : null,
    })));
    setContracts(cRes.data || []);
    setMeetings(mRes.data || []);
    setHealthScores(hRes.data || []);
    setJourneys(jRes.data || []);
    setStages(sRes.data || []);
    setProfiles(pRes.data || []);
    setFormSubmissions(fRes.data || []);
    setStageHistory(shRes.data || []);
    setProducts(prRes.data || []);

    // Build CSM list from user_roles + profiles
    const csmIds = (urRes.data || []).map((r: any) => r.user_id);
    const csmProfiles = (pRes.data || []).filter((p: any) => csmIds.includes(p.id));
    setCsmUsers(csmProfiles);

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const range = useMemo(() => getDateRange(period), [period]);
  const profileMap = useMemo(() => new Map((profiles || []).map((p: any) => [p.id, p.full_name || 'Sem nome'])), [profiles]);

  // ─── Role-based + filter scoping ───
  const filteredOffices = useMemo(() => {
    let list = offices;
    if (filterCsm !== 'all') list = list.filter(o => o.csm_id === filterCsm);
    if (filterProduct !== 'all') list = list.filter(o => o.active_product_id === filterProduct);
    return list;
  }, [offices, filterCsm, filterProduct]);

  const filteredContracts = useMemo(() => {
    const officeIds = new Set(filteredOffices.map(o => o.id));
    return contracts.filter(c => officeIds.has(c.office_id));
  }, [contracts, filteredOffices]);

  const filteredMeetings = useMemo(() => {
    const officeIds = new Set(filteredOffices.map(o => o.id));
    return meetings.filter(m => officeIds.has(m.office_id));
  }, [meetings, filteredOffices]);

  const filteredHealth = useMemo(() => {
    const officeIds = new Set(filteredOffices.map(o => o.id));
    return healthScores.filter(h => officeIds.has(h.office_id));
  }, [healthScores, filteredOffices]);

  const filteredJourneys = useMemo(() => {
    const officeIds = new Set(filteredOffices.map(o => o.id));
    return journeys.filter(j => officeIds.has(j.office_id));
  }, [journeys, filteredOffices]);

  const filteredHistory = useMemo(() => {
    const officeIds = new Set(filteredOffices.map(o => o.id));
    return stageHistory.filter(h => officeIds.has(h.office_id));
  }, [stageHistory, filteredOffices]);

  // ─── COMPUTED METRICS ───
  const metrics = useMemo(() => {
    const o = filteredOffices.filter(x => x.status !== 'pausado'); // Exclude pausado from metrics
    const pausadoCount = filteredOffices.filter(x => x.status === 'pausado').length;
    const total = o.length;
    const ativos = o.filter(x => x.status === 'ativo' || x.status === 'bonus_elite' || x.status === 'upsell').length;
    const churnList = o.filter(x => x.status === 'churn');
    const naoRenovado = o.filter(x => x.status === 'nao_renovado');
    const naoIniciado = o.filter(x => x.status === 'nao_iniciado');
    const churnCount = churnList.length;
    const churnPct = total > 0 ? ((churnCount / total) * 100).toFixed(1) : '0';
    const retentionRate = total > 0 ? ((ativos / total) * 100).toFixed(1) : '0';

    // Churn breakdown
    const churnNaoIniciado = churnList.filter(x => {
      const j = filteredJourneys.find(j => j.office_id === x.id);
      return !j;
    });
    const churnDuranteJornada = churnList.filter(x => {
      const j = filteredJourneys.find(j => j.office_id === x.id);
      return j && !j.completed_at;
    });
    const churnBreakdown = [
      { name: 'Não Iniciado', value: churnNaoIniciado.length, color: COLORS.muted },
      { name: 'Durante Jornada', value: churnDuranteJornada.length, color: COLORS.warning },
      { name: 'Não Renovado', value: naoRenovado.length, color: COLORS.red },
    ].filter(d => d.value > 0);

    const avgTimeToChurn = churnList.length > 0
      ? Math.round(churnList.reduce((s, x) => {
          const from = x.activation_date ? new Date(x.activation_date) : new Date(x.created_at);
          const to = x.churn_date ? new Date(x.churn_date) : new Date(x.updated_at);
          return s + differenceInMonths(to, from);
        }, 0) / churnList.length)
      : 0;

    // Churn by reason
    const churnByReason: Record<string, number> = {};
    churnList.forEach(x => {
      const reason = x.churn_reason_name || 'Sem motivo';
      churnByReason[reason] = (churnByReason[reason] || 0) + 1;
    });
    const churnReasonData = Object.entries(churnByReason).map(([name, value], i) => ({
      name, value, color: CHART_COLORS[i % CHART_COLORS.length],
    })).sort((a, b) => b.value - a.value);

    // Monthly churn evolution (last 12 months)
    const last12 = getLast12Months();
    const churnEvolution = last12.map(m => {
      const churned = o.filter(x => x.status === 'churn' && x.updated_at?.startsWith(m));
      return { month: m.substring(5) + '/' + m.substring(2, 4), churns: churned.length };
    });

    // Churned clients table
    const churnTable = churnList.map(x => {
      const hs = filteredHealth.find(h => h.office_id === x.id);
      const from = x.activation_date ? new Date(x.activation_date) : new Date(x.created_at);
      const to = x.churn_date ? new Date(x.churn_date) : new Date(x.updated_at);
      const mesesAtivo = differenceInMonths(to, from);
      return { name: x.name, id: x.id, mesesAtivo, health: hs?.score ?? '—', band: hs?.band, csm: profileMap.get(x.csm_id) || '—', churnReason: x.churn_reason_name || '—' };
    });

    // MRR / LTV
    const activeContracts = filteredContracts.filter(c => c.status === 'ativo');
    const activeMRR = activeContracts.reduce((s, c) => s + (c.monthly_value || 0), 0);
    const totalLTV = filteredContracts.reduce((s, c) => s + (c.value || 0), 0);
    const avgLTV = total > 0 ? Math.round(totalLTV / total) : 0;

    // LTV distribution histogram
    const ltvRanges = [
      { label: '< 5k', min: 0, max: 5000 },
      { label: '5k-15k', min: 5000, max: 15000 },
      { label: '15k-50k', min: 15000, max: 50000 },
      { label: '50k-100k', min: 50000, max: 100000 },
      { label: '> 100k', min: 100000, max: Infinity },
    ];
    const officeLTV = o.map(x => {
      const sum = filteredContracts.filter(c => c.office_id === x.id).reduce((s, c) => s + (c.value || 0), 0);
      return sum;
    });
    const ltvHistogram = ltvRanges.map(r => ({
      name: r.label,
      count: officeLTV.filter(v => v >= r.min && v < r.max).length,
    }));

    // Monthly retention evolution
    const retentionEvolution = last12.map(m => {
      const totalM = o.filter(x => new Date(x.created_at) <= new Date(m + '-28')).length;
      const ativosM = o.filter(x => (x.status === 'ativo' || x.status === 'bonus_elite') && new Date(x.created_at) <= new Date(m + '-28')).length;
      return { month: m.substring(5) + '/' + m.substring(2, 4), taxa: totalM > 0 ? Math.round((ativosM / totalM) * 100) : 0 };
    });

    // Health
    const avgHealth = filteredHealth.length > 0 ? Math.round(filteredHealth.reduce((s, h) => s + h.score, 0) / filteredHealth.length) : 0;
    const greenCount = filteredHealth.filter(h => h.band === 'green').length;
    const yellowCount = filteredHealth.filter(h => h.band === 'yellow').length;
    const redCount = filteredHealth.filter(h => h.band === 'red').length;
    const healthDistData = [
      { name: 'Verde', value: greenCount, color: COLORS.green },
      { name: 'Amarelo', value: yellowCount, color: COLORS.yellow },
      { name: 'Vermelho', value: redCount, color: COLORS.red },
    ].filter(d => d.value > 0);

    // NPS from form submissions
    const npsValues = formSubmissions.flatMap((f: any) => {
      const data = f.data as Record<string, any>;
      if (!data) return [];
      return Object.entries(data)
        .filter(([k]) => k.toLowerCase().includes('nps') || k.toLowerCase().includes('nota'))
        .map(([, v]) => Number(v))
        .filter(v => !isNaN(v) && v >= 0 && v <= 10);
    });
    const avgNps = npsValues.length > 0 ? (npsValues.reduce((s, v) => s + v, 0) / npsValues.length).toFixed(1) : '—';
    const promoters = npsValues.filter(v => v >= 9).length;
    const neutrals = npsValues.filter(v => v >= 7 && v <= 8).length;
    const detractors = npsValues.filter(v => v <= 6).length;
    const npsDistribution = [
      { name: 'Promotores (9-10)', value: promoters, color: COLORS.green },
      { name: 'Neutros (7-8)', value: neutrals, color: COLORS.yellow },
      { name: 'Detratores (0-6)', value: detractors, color: COLORS.red },
    ].filter(d => d.value > 0);

    // Meetings coverage
    const completedMeetings = filteredMeetings.filter(m => m.status === 'completed');
    const completedInPeriod = filteredMeetings.filter(m => m.status === 'completed' && inRange(m.scheduled_at, range.start, range.end));
    const completedPrev = filteredMeetings.filter(m => m.status === 'completed' && inRange(m.scheduled_at, range.prevStart, range.prevEnd));
    const activeOfficeIds = o.filter(x => x.status === 'ativo' || x.status === 'bonus_elite').map(x => x.id);

    const lastMeetingMap: Record<string, string> = {};
    completedMeetings.forEach(m => {
      if (!lastMeetingMap[m.office_id] || m.scheduled_at > lastMeetingMap[m.office_id]) lastMeetingMap[m.office_id] = m.scheduled_at;
    });
    const noMeeting30 = activeOfficeIds.filter(id => {
      const l = lastMeetingMap[id];
      return !l || differenceInDays(new Date(), new Date(l)) > 30;
    });
    const coveragePct = activeOfficeIds.length > 0 ? Math.round(((activeOfficeIds.length - noMeeting30.length) / activeOfficeIds.length) * 100) : 0;

    // CSM coverage table
    const csmCoverage = csmUsers.map(csm => {
      const csmOffices = o.filter(x => x.csm_id === csm.id && (x.status === 'ativo' || x.status === 'bonus_elite'));
      const csmMeetings = completedInPeriod.filter(m => m.user_id === csm.id);
      const clientsAtendidos = new Set(csmMeetings.map(m => m.office_id)).size;
      const cob = csmOffices.length > 0 ? Math.round((clientsAtendidos / csmOffices.length) * 100) : 0;
      return { name: csm.full_name || 'Sem nome', total: csmMeetings.length, clientes: clientsAtendidos, carteira: csmOffices.length, cobertura: cob };
    });

    // No contact 30d list
    const noContactList = noMeeting30.map(id => {
      const office = o.find(x => x.id === id);
      const last = lastMeetingMap[id];
      return { name: office?.name || '—', dias: last ? differenceInDays(new Date(), new Date(last)) : 999, csm: profileMap.get(office?.csm_id) || '—' };
    }).sort((a, b) => b.dias - a.dias);

    // Monthly meeting frequency
    const meetingFrequency = last12.map(m => ({
      month: m.substring(5) + '/' + m.substring(2, 4),
      reunioes: completedMeetings.filter(mt => mt.scheduled_at?.startsWith(m)).length,
    }));

    // Journey analytics
    const stageMap = new Map(stages.map((s: any) => [s.id, s]));

    // Avg time per stage
    const stageTimesAccum: Record<string, { total: number; count: number; sla: number | null; name: string }> = {};
    filteredHistory.forEach(h => {
      const st = stageMap.get(h.from_stage_id || h.to_stage_id);
      if (!st) return;
      const key = st.id;
      if (!stageTimesAccum[key]) stageTimesAccum[key] = { total: 0, count: 0, sla: st.sla_days, name: st.name };
      // approximate time: use created_at of next move
    });
    // Better approach: for each office journey entry, compute time spent
    const avgTimePerStage = stages
      .filter((s: any) => filteredJourneys.some(j => j.journey_stage_id === s.id))
      .map((s: any) => {
        const entries = filteredJourneys.filter(j => j.journey_stage_id === s.id);
        const times = entries.map(e => {
          const enter = new Date(e.entered_at);
          const exit = e.completed_at ? new Date(e.completed_at) : new Date();
          return differenceInDays(exit, enter);
        });
        const avg = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        return { name: s.name, dias: avg, sla: s.sla_days, exceedsSla: s.sla_days ? avg > s.sla_days : false };
      });

    // Churn by stage
    const churnByStage = stages.map((s: any) => {
      const officesInStage = filteredJourneys.filter(j => j.journey_stage_id === s.id).map(j => j.office_id);
      const churns = churnList.filter(x => officesInStage.includes(x.id)).length;
      return { name: s.name, churns };
    }).filter(d => d.churns > 0);

    // Conversion funnel
    const sortedStages = [...stages].sort((a: any, b: any) => a.position - b.position);
    const funnel = sortedStages.map((s: any, i: number) => {
      const countInStage = filteredJourneys.filter(j => j.journey_stage_id === s.id).length;
      const completed = filteredJourneys.filter(j => j.journey_stage_id === s.id && j.completed_at).length;
      return { name: s.name, total: countInStage, avancou: completed, pct: countInStage > 0 ? Math.round((completed / countInStage) * 100) : 0 };
    });

    // Inadimplência — fonte de verdade: offices (sincronizado do Asaas)
    const overdueOfficesList = o.filter(x => (x.installments_overdue || 0) > 0);
    const totalOverdueValue = overdueOfficesList.reduce((s, x) => s + (x.total_overdue_value || 0), 0);
    const overduePct = activeMRR > 0 ? ((totalOverdueValue / activeMRR) * 100).toFixed(1) : '0';

    const overdueTable = overdueOfficesList.map(x => {
      return {
        name: x.name || '—', parcelas: x.installments_overdue || 0, valor: x.total_overdue_value || 0,
        diasAtraso: 0, csm: profileMap.get(x.csm_id) || '—', product: x.products?.name || '—',
      };
    });

    // Period comparisons
    const newInPeriod = o.filter(x => inRange(x.created_at, range.start, range.end)).length;
    const newPrev = o.filter(x => inRange(x.created_at, range.prevStart, range.prevEnd)).length;

    return {
      total, ativos, churnCount, churnPct, retentionRate, churnBreakdown, avgTimeToChurn, churnEvolution, churnTable, churnReasonData, pausadoCount,
      activeMRR, totalLTV, avgLTV, ltvHistogram, retentionEvolution, activeContracts,
      avgHealth, greenCount, yellowCount, redCount, healthDistData,
      avgNps, npsDistribution, promoters, neutrals, detractors,
      completedInPeriod, completedPrev, coveragePct, noMeeting30, csmCoverage, noContactList, meetingFrequency,
      avgTimePerStage, churnByStage, funnel,
      overdueOfficesList, totalOverdueValue, overduePct, overdueTable,
      newInPeriod, newPrev,
    };
  }, [filteredOffices, filteredContracts, filteredMeetings, filteredHealth, filteredJourneys, filteredHistory, stages, csmUsers, formSubmissions, profileMap, range]);

  const periodLabel: Record<PeriodType, string> = { month: 'Mês', quarter: 'Trimestre', semester: 'Semestre', year: 'Ano' };

  const clearFilters = () => { setFilterCsm('all'); setFilterProduct('all'); setPeriod('month'); };

  if (loading) return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Relatórios</h1></div>
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ─── HEADER + FILTROS ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">{filteredOffices.length} escritório{filteredOffices.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center rounded-lg border border-border/60 bg-card p-3">
        <Select value={period} onValueChange={v => setPeriod(v as PeriodType)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mês</SelectItem>
            <SelectItem value="quarter">Trimestre</SelectItem>
            <SelectItem value="semester">Semestre</SelectItem>
            <SelectItem value="year">Ano</SelectItem>
          </SelectContent>
        </Select>

        {(isAdmin || isManager) && (
          <Select value={filterCsm} onValueChange={setFilterCsm}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos os CSMs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os CSMs</SelectItem>
              {csmUsers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name || 'Sem nome'}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Todos os Produtos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Badge variant={showComparison ? 'default' : 'outline'} className="cursor-pointer text-xs h-8 px-3" onClick={() => setShowComparison(!showComparison)}>
          vs anterior
        </Badge>

        <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4 mr-1" />Limpar</Button>
      </div>

      {/* ─── TABS ─── */}
      <Tabs defaultValue="executiva" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="executiva" className="gap-1.5"><BarChart3 className="h-4 w-4" />Executiva</TabsTrigger>
          <TabsTrigger value="churn" className="gap-1.5"><TrendingDown className="h-4 w-4" />Churn</TabsTrigger>
          <TabsTrigger value="receita" className="gap-1.5"><DollarSign className="h-4 w-4" />Receita & LTV</TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5"><Heart className="h-4 w-4" />Saúde/NPS</TabsTrigger>
          <TabsTrigger value="cobertura" className="gap-1.5"><Users className="h-4 w-4" />Cobertura</TabsTrigger>
          <TabsTrigger value="jornada" className="gap-1.5"><Route className="h-4 w-4" />Jornada</TabsTrigger>
          <TabsTrigger value="inadimplencia" className="gap-1.5"><AlertTriangle className="h-4 w-4" />Inadimplência</TabsTrigger>
          <TabsTrigger value="evolucao" className="gap-1.5"><TrendingUp className="h-4 w-4" />Evolução</TabsTrigger>
          <TabsTrigger value="indicadores" className="gap-1.5"><Layers className="h-4 w-4" />📊 Indicadores</TabsTrigger>
          <TabsTrigger value="cohort" className="gap-1.5"><GitBranch className="h-4 w-4" />📈 Cohort</TabsTrigger>
        </TabsList>

        {/* ═══ VISÃO EXECUTIVA ═══ */}
        <TabsContent value="executiva" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <KPI label="Total de Clientes" value={metrics.total} />
            <KPI label={`Novos (${periodLabel[period]})`} value={metrics.newInPeriod} comparison={showComparison ? deltaStr(metrics.newInPeriod, metrics.newPrev) : undefined} />
            <KPI label="Ativos" value={metrics.ativos} positive />
            <KPI label="Taxa de Retenção" value={`${metrics.retentionRate}%`} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Distribuição por Status">
              {filteredOffices.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={Object.entries(filteredOffices.reduce((acc: Record<string, number>, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {})).map(([s, c]) => ({ name: STATUS_LABELS[s] || s, value: c }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {Object.keys(STATUS_LABELS).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="MRR por Produto">
              {metrics.activeContracts.length === 0 ? <EmptyChart /> : (() => {
                const mrrByProduct = metrics.activeContracts.reduce((acc: Record<string, number>, c: any) => { const n = c.products?.name || 'Sem produto'; acc[n] = (acc[n] || 0) + (c.monthly_value || 0); return acc; }, {});
                const data = Object.entries(mrrByProduct).map(([name, mrr]) => ({ name, mrr }));
                return (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} /><Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR')}`} />
                      <Bar dataKey="mrr" name="MRR" radius={[4, 4, 0, 0]}>{data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </ChartCard>
          </div>
        </TabsContent>

        {/* ═══ CHURN ═══ */}
        <TabsContent value="churn" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <KPI label="Churn Total" value={metrics.churnCount} negative />
            <KPI label="Taxa de Churn" value={`${metrics.churnPct}%`} negative />
            <KPI label="Tempo Médio até Churn" value={`${metrics.avgTimeToChurn} meses`} />
            <KPI label="Taxa de Retenção" value={`${metrics.retentionRate}%`} positive />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Churn por Motivo">
              {metrics.churnReasonData.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart><Pie data={metrics.churnReasonData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                    {metrics.churnReasonData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie><Tooltip /><Legend /></PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Breakdown por Tipo">
              {metrics.churnBreakdown.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart><Pie data={metrics.churnBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                    {metrics.churnBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie><Tooltip /><Legend /></PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Evolução Mensal do Churn">
              {metrics.churnEvolution.every(d => d.churns === 0) ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={metrics.churnEvolution}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip />
                    <Line type="monotone" dataKey="churns" name="Churns" stroke={COLORS.red} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
          {metrics.churnTable.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Clientes que Churnaram</CardTitle></CardHeader>
              <CardContent>
                 <Table>
                  <TableHeader><TableRow>
                    <TableHead>Escritório</TableHead><TableHead>Motivo</TableHead><TableHead>Meses Ativo</TableHead><TableHead>Último Health</TableHead><TableHead>CSM</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {metrics.churnTable.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{r.churnReason}</Badge></TableCell>
                        <TableCell>{r.mesesAtivo}</TableCell>
                        <TableCell><Badge variant={r.band === 'red' ? 'destructive' : r.band === 'yellow' ? 'outline' : 'default'} className="text-xs">{r.health}</Badge></TableCell>
                        <TableCell>{r.csm}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ RECEITA & LTV ═══ */}
        <TabsContent value="receita" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <KPI label="MRR Total" value={`R$ ${metrics.activeMRR.toLocaleString('pt-BR')}`} />
            <KPI label="LTV Total" value={`R$ ${metrics.totalLTV.toLocaleString('pt-BR')}`} />
            <KPI label="LTV Médio" value={`R$ ${metrics.avgLTV.toLocaleString('pt-BR')}`} />
            <KPI label="Ticket Médio Mensal" value={metrics.activeContracts.length > 0 ? `R$ ${Math.round(metrics.activeMRR / metrics.activeContracts.length).toLocaleString('pt-BR')}` : '—'} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Distribuição de LTV">
              {metrics.ltvHistogram.every(d => d.count === 0) ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={metrics.ltvHistogram}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} /><Tooltip />
                    <Bar dataKey="count" name="Escritórios" radius={[4, 4, 0, 0]} fill={COLORS.blue} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Evolução da Retenção Mensal">
              {metrics.retentionEvolution.every(d => d.taxa === 0) ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={metrics.retentionEvolution}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} /><Tooltip formatter={(v: number) => `${v}%`} />
                    <Line type="monotone" dataKey="taxa" name="Retenção" stroke={COLORS.green} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </TabsContent>

        {/* ═══ SAÚDE / NPS ═══ */}
        <TabsContent value="health" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-5">
            <KPI label="Health Médio" value={metrics.avgHealth} />
            <KPI label="Verde" value={metrics.greenCount} positive />
            <KPI label="Amarelo" value={metrics.yellowCount} />
            <KPI label="Vermelho" value={metrics.redCount} negative />
            <KPI label="NPS Médio" value={metrics.avgNps} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Distribuição de Health">
              {metrics.healthDistData.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart><Pie data={metrics.healthDistData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {metrics.healthDistData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie><Tooltip /><Legend /></PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Distribuição NPS">
              {metrics.npsDistribution.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={metrics.npsDistribution}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip />
                    <Bar dataKey="value" name="Respostas" radius={[4, 4, 0, 0]}>{metrics.npsDistribution.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </TabsContent>

        {/* ═══ COBERTURA ═══ */}
        <TabsContent value="cobertura" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <KPI label={`Reuniões (${periodLabel[period]})`} value={metrics.completedInPeriod.length} comparison={showComparison ? deltaStr(metrics.completedInPeriod.length, metrics.completedPrev.length) : undefined} />
            <KPI label="Sem Contato +30 dias" value={metrics.noMeeting30.length} negative />
            <KPI label="% Cobertura" value={`${metrics.coveragePct}%`} positive />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Frequência Mensal de Reuniões">
              {metrics.meetingFrequency.every(d => d.reunioes === 0) ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={metrics.meetingFrequency}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip />
                    <Bar dataKey="reunioes" name="Reuniões" radius={[4, 4, 0, 0]} fill={COLORS.blue} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            {metrics.csmCoverage.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Cobertura por CSM</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>CSM</TableHead><TableHead>Reuniões</TableHead><TableHead>Clientes</TableHead><TableHead>Carteira</TableHead><TableHead>Cobertura</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {metrics.csmCoverage.map(r => (
                        <TableRow key={r.name}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell>{r.total}</TableCell>
                          <TableCell>{r.clientes}</TableCell>
                          <TableCell>{r.carteira}</TableCell>
                          <TableCell><Badge variant={r.cobertura >= 80 ? 'default' : r.cobertura >= 50 ? 'outline' : 'destructive'}>{r.cobertura}%</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
          {metrics.noContactList.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Clientes sem Contato &gt;30 dias</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Escritório</TableHead><TableHead>Dias sem contato</TableHead><TableHead>CSM</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {metrics.noContactList.slice(0, 20).map(r => (
                      <TableRow key={r.name}><TableCell className="font-medium">{r.name}</TableCell><TableCell><Badge variant="destructive">{r.dias === 999 ? 'Nunca' : `${r.dias}d`}</Badge></TableCell><TableCell>{r.csm}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ JORNADA ANALYTICS ═══ */}
        <TabsContent value="jornada" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Tempo Médio por Etapa (dias)">
              {metrics.avgTimePerStage.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.avgTimePerStage} layout="vertical"><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis type="number" /><YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={150} /><Tooltip formatter={(v: number, name: string, p: any) => [`${v} dias${p.payload.sla ? ` (SLA: ${p.payload.sla}d)` : ''}`, 'Média']} />
                    <Bar dataKey="dias" name="Dias" radius={[0, 4, 4, 0]}>
                      {metrics.avgTimePerStage.map((e, i) => <Cell key={i} fill={e.exceedsSla ? COLORS.red : COLORS.blue} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Churns por Etapa">
              {metrics.churnByStage.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.churnByStage} layout="vertical"><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={150} /><Tooltip />
                    <Bar dataKey="churns" name="Churns" radius={[0, 4, 4, 0]} fill={COLORS.red} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
          {metrics.funnel.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Funil de Conversão</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Etapa</TableHead><TableHead>Total</TableHead><TableHead>Avançou</TableHead><TableHead>% Conversão</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {metrics.funnel.map(r => (
                      <TableRow key={r.name}><TableCell className="font-medium">{r.name}</TableCell><TableCell>{r.total}</TableCell><TableCell>{r.avancou}</TableCell><TableCell><Badge variant={r.pct >= 70 ? 'default' : r.pct >= 40 ? 'outline' : 'destructive'}>{r.pct}%</Badge></TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ INADIMPLÊNCIA ═══ */}
        <TabsContent value="inadimplencia" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <KPI label="Valor Total em Atraso" value={`R$ ${metrics.totalOverdueValue.toLocaleString('pt-BR')}`} negative />
            <KPI label="% Inadimplência" value={`${metrics.overduePct}%`} negative />
            <KPI label="Contratos Inadimplentes" value={metrics.overdueContracts.length} />
          </div>
          {metrics.overdueTable.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Clientes com Parcelas Vencidas</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Escritório</TableHead><TableHead>Produto</TableHead><TableHead>Parcelas</TableHead><TableHead>Valor</TableHead><TableHead>CSM</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {metrics.overdueTable.map((r, i) => (
                      <TableRow key={i}><TableCell className="font-medium">{r.name}</TableCell><TableCell>{r.product}</TableCell><TableCell><Badge variant="destructive">{r.parcelas}</Badge></TableCell><TableCell>R$ {r.valor.toLocaleString('pt-BR')}</TableCell><TableCell>{r.csm}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ EVOLUÇÃO ═══ */}
        <TabsContent value="evolucao" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Evolução do Cliente</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Configure os campos de percepção (faturamento, qtd. clientes, colaboradores) nos escritórios para visualizar rankings de evolução.</p>
                <p className="text-xs text-muted-foreground mt-1">Em breve: rankings mensais de crescimento por indicador.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ INDICADORES ═══ */}
        <TabsContent value="indicadores" className="space-y-6">
          <IndicatorBuilder
            offices={filteredOffices}
            contracts={filteredContracts}
            meetings={filteredMeetings}
            healthScores={filteredHealth}
            activities={[]}
            formSubmissions={formSubmissions}
            products={products}
            csmUsers={csmUsers}
            profileMap={profileMap}
            filterProduct={filterProduct}
            filterCsm={filterCsm}
          />
        </TabsContent>

        {/* ═══ COHORT ═══ */}
        <TabsContent value="cohort" className="space-y-6">
          <CohortAnalysis
            offices={filteredOffices}
            filterProduct={filterProduct}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ───

function KPI({ label, value, comparison, positive, negative }: {
  label: string; value: string | number; comparison?: string; positive?: boolean; negative?: boolean;
}) {
  const colorClass = positive ? 'text-success' : negative ? 'text-destructive' : '';
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
        {comparison && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${comparison.startsWith('+') ? 'text-success' : comparison.startsWith('-') ? 'text-destructive' : 'text-muted-foreground'}`}>
            {comparison.startsWith('+') ? <ArrowUp className="h-3 w-3" /> : comparison.startsWith('-') ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {comparison} vs anterior
          </p>
        )}
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
      <p className="text-sm text-muted-foreground">Sem dados para o período selecionado</p>
    </div>
  );
}
