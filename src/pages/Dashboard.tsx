import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2, AlertTriangle, TrendingDown, TrendingUp, CheckSquare, Clock, Heart,
  BarChart3, CalendarDays, Users, Star, Eye, ShieldAlert, Percent, Activity,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isFuture, isPast, differenceInDays, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const { user, role, isAdmin, isManager, isCSM } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [allMeetings, setAllMeetings] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [healthScores, setHealthScores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [formSubmissions, setFormSubmissions] = useState<any[]>([]);
  const [healthOverrides, setHealthOverrides] = useState<any[]>([]);
  const [csmProfiles, setCsmProfiles] = useState<any[]>([]);
  const [selectedFunnelProduct, setSelectedFunnelProduct] = useState('');
  const [selectedCsms, setSelectedCsms] = useState<string[]>([]);
  const [actionPlans, setActionPlans] = useState<any[]>([]);
  const [officeJourneys, setOfficeJourneys] = useState<any[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const threeMonthsAgo = subMonths(new Date(), 3).toISOString();
    const [
      officesRes, contractsRes, activitiesRes, meetingsRes, contactsRes,
      healthRes, productsRes, allMeetingsRes, eventsRes, formsRes,
      overridesRes, profilesRes, rolesRes, actionPlansRes, journeysRes
    ] = await Promise.all([
      supabase.from('offices').select('*, products:active_product_id(name)'),
      supabase.from('contracts').select('*'),
      supabase.from('activities').select('*, offices(name)').is('completed_at', null),
      supabase.from('meetings').select('*, offices(name)').eq('status', 'scheduled'),
      supabase.from('contacts').select('name, birthday, office_id, offices(name)').not('birthday', 'is', null),
      supabase.from('health_scores').select('*, offices:office_id(name, status, csm_id)'),
      supabase.from('products').select('id, name').eq('is_active', true),
      supabase.from('meetings').select('office_id, scheduled_at, status'),
      supabase.from('events').select('*').gte('event_date', new Date().toISOString()).order('event_date').limit(5),
      supabase.from('form_submissions').select('id, office_id, submitted_at, data'),
      supabase.from('health_overrides').select('*'),
      supabase.from('profiles').select('id, full_name, avatar_url'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('action_plans').select('*'),
      supabase.from('office_journey').select('journey_stage_id, office_id, entered_at'),
    ]);
    setOffices(officesRes.data || []);
    setContracts(contractsRes.data || []);
    setActivities(activitiesRes.data || []);
    setMeetings(meetingsRes.data || []);
    setContacts(contactsRes.data || []);
    setHealthScores(healthRes.data || []);
    setProducts(productsRes.data || []);
    setAllMeetings(allMeetingsRes.data || []);
    setEvents(eventsRes.data || []);
    setFormSubmissions(formsRes.data || []);
    setHealthOverrides(overridesRes.data || []);
    setActionPlans(actionPlansRes.data || []);
    setOfficeJourneys(journeysRes.data || []);

    // Build CSM profiles list
    const roles = rolesRes.data || [];
    const profiles = profilesRes.data || [];
    const csmUserIds = roles.filter(r => r.role === 'csm').map(r => r.user_id);
    const csms = profiles.filter(p => csmUserIds.includes(p.id));
    setCsmProfiles(csms);

    const prods = productsRes.data || [];
    if (prods.length > 0) setSelectedFunnelProduct(prods[0].id);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!selectedFunnelProduct) return;
    supabase.from('journey_stages').select('*').eq('product_id', selectedFunnelProduct).order('position')
      .then(({ data }) => setStages(data || []));
  }, [selectedFunnelProduct]);

  // Filter by CSM for manager/admin
  const filteredOffices = useMemo(() => {
    if (selectedCsms.length === 0) return offices;
    return offices.filter(o => selectedCsms.includes(o.csm_id));
  }, [offices, selectedCsms]);

  const filteredHealthScores = useMemo(() => {
    if (selectedCsms.length === 0) return healthScores;
    const officeIds = new Set(filteredOffices.map(o => o.id));
    return healthScores.filter(h => officeIds.has(h.office_id));
  }, [healthScores, filteredOffices, selectedCsms]);

  const filteredContracts = useMemo(() => {
    if (selectedCsms.length === 0) return contracts;
    const officeIds = new Set(filteredOffices.map(o => o.id));
    return contracts.filter(c => officeIds.has(c.office_id));
  }, [contracts, filteredOffices, selectedCsms]);

  const filteredAllMeetings = useMemo(() => {
    if (selectedCsms.length === 0) return allMeetings;
    const officeIds = new Set(filteredOffices.map(o => o.id));
    return allMeetings.filter(m => officeIds.has(m.office_id));
  }, [allMeetings, filteredOffices, selectedCsms]);

  // === COMPUTED VALUES ===
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const thirtyDaysAgo = subDays(today, 30);
  const sixtyDaysAgo = subDays(today, 60);

  // Novos clientes
  const newClientsThisMonth = filteredOffices.filter(o => new Date(o.created_at) >= startOfMonth(today));
  const newClientsPrevMonth = filteredOffices.filter(o => {
    const d = new Date(o.created_at);
    return d >= startOfMonth(subMonths(today, 1)) && d < startOfMonth(today);
  });
  const newClientsDelta = newClientsThisMonth.length - newClientsPrevMonth.length;

  // Ativos
  const ativos = filteredOffices.filter(o => o.status === 'ativo' || o.status === 'bonus_elite');
  const bonusElite = filteredOffices.filter(o => o.status === 'bonus_elite').length;
  const activeOfficeIds = ativos.map(o => o.id);

  // Em risco
  const redHealth = filteredHealthScores.filter(h => h.band === 'red');
  const emRisco = redHealth.length;

  // Churn macro
  const churnOffices = filteredOffices.filter(o => o.status === 'churn');
  const naoRenovado = filteredOffices.filter(o => o.status === 'nao_renovado');
  const naoIniciado = filteredOffices.filter(o => o.status === 'nao_iniciado');
  const churnTotal = churnOffices.length + naoRenovado.length;

  // Expansão
  const upsellOffices = filteredOffices.filter(o => o.status === 'upsell');

  // Health distribution
  const greenCount = filteredHealthScores.filter(h => h.band === 'green').length;
  const yellowCount = filteredHealthScores.filter(h => h.band === 'yellow').length;
  const redCount = filteredHealthScores.filter(h => h.band === 'red').length;
  const healthTotal = greenCount + yellowCount + redCount;
  const avgHealth = filteredHealthScores.length > 0 ? Math.round(filteredHealthScores.reduce((s, h) => s + h.score, 0) / filteredHealthScores.length) : 0;

  // Cobertura: % active offices with meeting this month
  const meetingsThisMonth = filteredAllMeetings.filter(m => m.scheduled_at?.startsWith(currentMonth));
  const officesWithMeetingThisMonth = new Set(meetingsThisMonth.map(m => m.office_id));
  const cobertura = activeOfficeIds.length > 0 ? Math.round((activeOfficeIds.filter(id => officesWithMeetingThisMonth.has(id)).length / activeOfficeIds.length) * 100) : 0;

  // Last meeting per office
  const lastMeetingMap: Record<string, string> = {};
  filteredAllMeetings.filter(m => m.status === 'completed').forEach(m => {
    if (!lastMeetingMap[m.office_id] || m.scheduled_at > lastMeetingMap[m.office_id]) lastMeetingMap[m.office_id] = m.scheduled_at;
  });
  const noMeeting30 = activeOfficeIds.filter(id => {
    const last = lastMeetingMap[id];
    if (!last) return true;
    return differenceInDays(today, new Date(last)) > 30;
  });

  // Sem percepção
  const officesWithSubmission = new Set(formSubmissions.filter(f => f.submitted_at?.startsWith(currentMonth)).map(f => f.office_id));
  const semPercepcao = activeOfficeIds.filter(id => !officesWithSubmission.has(id));

  // Active contracts
  const activeContracts = filteredContracts.filter(c => c.status === 'ativo');
  const totalOverdueInstallments = activeContracts.reduce((sum, c) => sum + (c.installments_overdue || 0), 0);
  const renewingSoon = activeContracts.filter(c => { if (!c.renewal_date) return false; const d = differenceInDays(new Date(c.renewal_date), today); return d >= 0 && d <= 30; });

  // Activities
  const overdueActivities = activities.filter(a => a.due_date && isPast(new Date(a.due_date)) && !isToday(new Date(a.due_date)));
  const todayActivities = activities.filter(a => a.due_date && isToday(new Date(a.due_date)));
  const todayMeetings = meetings.filter(m => isToday(new Date(m.scheduled_at)));
  const upcomingMeetings = meetings.filter(m => isFuture(new Date(m.scheduled_at)));

  // Birthdays
  const upcomingBirthdays = contacts.filter(c => {
    if (!c.birthday) return false;
    const bday = new Date(c.birthday);
    const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
    return differenceInDays(thisYear, today) >= 0 && differenceInDays(thisYear, today) <= 30;
  }).sort((a, b) => {
    const ad = new Date(a.birthday); const bd = new Date(b.birthday);
    return new Date(today.getFullYear(), ad.getMonth(), ad.getDate()).getTime() - new Date(today.getFullYear(), bd.getMonth(), bd.getDate()).getTime();
  }).slice(0, 5);

  // Funnel
  const funnelData = stages.map(s => ({
    name: s.name,
    count: officeJourneys.filter(j => j.journey_stage_id === s.id).length,
  }));

  // Top churn risk
  const topChurnRisk = filteredHealthScores.filter(h => h.band === 'red').sort((a, b) => a.score - b.score).slice(0, 5);
  const topExpansao = upsellOffices.slice(0, 5);

  // Action plans (OKR) - for "Atenção Hoje"
  const filteredActionPlans = useMemo(() => {
    if (selectedCsms.length === 0) return actionPlans;
    const officeIds = new Set(filteredOffices.map(o => o.id));
    return actionPlans.filter(a => officeIds.has(a.office_id));
  }, [actionPlans, filteredOffices, selectedCsms]);

  // === ATENÇÃO HOJE TABLE ===
  const attentionRows = useMemo(() => {
    const rows: { officeId: string; officeName: string; motivos: { label: string; type: 'danger' | 'warning' }[]; health: number | null; band: string | null; days: number | null; action: string }[] = [];
    const officeMap = new Map(filteredOffices.map(o => [o.id, o]));
    const healthMap = new Map(filteredHealthScores.map(h => [h.office_id, h]));

    for (const office of ativos) {
      const motivos: { label: string; type: 'danger' | 'warning' }[] = [];
      const h = healthMap.get(office.id);

      // a) Risco alto
      if (h && h.band === 'red') motivos.push({ label: 'Health vermelho', type: 'danger' });

      // b) Sem contato há +15 dias (using meetings)
      const lastMeeting = lastMeetingMap[office.id];
      const daysSinceContact = lastMeeting ? differenceInDays(today, new Date(lastMeeting)) : 999;
      if (daysSinceContact > 15) motivos.push({ label: `Sem contato há ${daysSinceContact > 900 ? '∞' : daysSinceContact} dias`, type: 'warning' });

      // d) Sem reunião +30 dias
      if (daysSinceContact > 30) motivos.push({ label: '+30d sem reunião', type: 'warning' });

      // e) Sem percepção
      if (!officesWithSubmission.has(office.id)) motivos.push({ label: 'Sem percepção no mês', type: 'warning' });

      // f) Renovação 0-30 dias
      const contract = activeContracts.find(c => c.office_id === office.id);
      if (contract?.renewal_date) {
        const daysToRenewal = differenceInDays(new Date(contract.renewal_date), today);
        if (daysToRenewal >= 0 && daysToRenewal <= 30) motivos.push({ label: `Renovação em ${daysToRenewal}d`, type: 'warning' });
      }

      // g) Parcelas vencidas
      if (contract && (contract.installments_overdue || 0) > 0) motivos.push({ label: `${contract.installments_overdue} parcela(s) vencida(s)`, type: 'danger' });

      if (motivos.length > 0) {
        const suggestedAction = motivos.some(m => m.label.includes('Health')) ? 'Agendar check-in urgente' :
          motivos.some(m => m.label.includes('Renovação')) ? 'Iniciar processo de renovação' :
          motivos.some(m => m.label.includes('parcela')) ? 'Verificar cobrança' :
          motivos.some(m => m.label.includes('reunião')) ? 'Agendar reunião' : 'Atualizar percepção';

        rows.push({
          officeId: office.id,
          officeName: office.name,
          motivos,
          health: h?.score ?? null,
          band: h?.band ?? null,
          days: daysSinceContact > 900 ? null : daysSinceContact,
          action: suggestedAction,
        });
      }
    }
    return rows.sort((a, b) => {
      const aDanger = a.motivos.filter(m => m.type === 'danger').length;
      const bDanger = b.motivos.filter(m => m.type === 'danger').length;
      if (aDanger !== bDanger) return bDanger - aDanger;
      return b.motivos.length - a.motivos.length;
    });
  }, [ativos, filteredHealthScores, lastMeetingMap, officesWithSubmission, activeContracts, today]);

  // === CSM PERFORMANCE TABLE ===
  const csmPerformance = useMemo(() => {
    if (!isAdmin && !isManager) return [];
    return csmProfiles.map(csm => {
      const csmOffices = offices.filter(o => o.csm_id === csm.id);
      const csmActive = csmOffices.filter(o => o.status === 'ativo' || o.status === 'bonus_elite');
      const csmHealth = healthScores.filter(h => csmOffices.some(o => o.id === h.office_id));
      const avgH = csmHealth.length > 0 ? Math.round(csmHealth.reduce((s, h) => s + h.score, 0) / csmHealth.length) : 0;
      const csmActiveIds = csmActive.map(o => o.id);
      const withMeeting = csmActiveIds.filter(id => officesWithMeetingThisMonth.has(id)).length;
      const coverage = csmActiveIds.length > 0 ? Math.round((withMeeting / csmActiveIds.length) * 100) : 0;
      const churnCount = csmOffices.filter(o => o.status === 'churn' || o.status === 'nao_renovado').length;
      return { id: csm.id, name: csm.full_name || 'Sem nome', portfolio: csmActive.length, avgHealth: avgH, coverage, churn: churnCount };
    }).sort((a, b) => b.portfolio - a.portfolio);
  }, [csmProfiles, offices, healthScores, officesWithMeetingThisMonth, isAdmin, isManager]);

  // Health band color helper
  const bandColor = (band: string | null) => {
    if (band === 'green') return 'bg-success text-success-foreground';
    if (band === 'yellow') return 'bg-warning text-warning-foreground';
    if (band === 'red') return 'bg-destructive text-destructive-foreground';
    return 'bg-muted text-muted-foreground';
  };

  const DeltaIcon = ({ value }: { value: number }) => {
    if (value > 0) return <ArrowUpRight className="h-3 w-3 text-success inline" />;
    if (value < 0) return <ArrowDownRight className="h-3 w-3 text-destructive inline" />;
    return <Minus className="h-3 w-3 text-muted-foreground inline" />;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">Dashboard</h1><p className="text-sm text-muted-foreground">Visão geral da sua carteira</p></div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="p-6 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="p-6 space-y-3">
              <Skeleton className="h-5 w-32" />
              {[...Array(3)].map((_, j) => <Skeleton key={j} className="h-12" />)}
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + CSM Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral da sua carteira</p>
        </div>
        {(isAdmin || isManager) && csmProfiles.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtrar CSM:</span>
            <Select
              value={selectedCsms.length === 0 ? 'all' : selectedCsms[0]}
              onValueChange={(v) => setSelectedCsms(v === 'all' ? [] : [v])}
            >
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Consolidado do time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Consolidado do time</SelectItem>
                {csmProfiles.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name || 'Sem nome'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* 8 KPI Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {/* 1. Novos clientes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos no Mês</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {newClientsThisMonth.length === 0 ? (
              <p className="text-xs text-muted-foreground">Não temos clientes novos no momento</p>
            ) : (
              <>
                <div className="text-2xl font-bold">{newClientsThisMonth.length}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <DeltaIcon value={newClientsDelta} />
                  {newClientsDelta > 0 ? '+' : ''}{newClientsDelta} vs mês anterior
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* 2. Clientes ativos */}
        <Card className="cursor-pointer card-hover" onClick={() => navigate('/clientes')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ativos.length}</div>
            <p className="text-xs text-muted-foreground">{bonusElite > 0 ? `${bonusElite} Bonus Elite` : `${filteredOffices.length} total`}</p>
          </CardContent>
        </Card>

        {/* 3. Em risco */}
        <Card className="cursor-pointer card-hover" onClick={() => navigate('/clientes')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Risco</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{emRisco}</div>
            <p className="text-xs text-muted-foreground">Health vermelho ou override</p>
          </CardContent>
        </Card>

        {/* 4. Churn macro */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{churnTotal}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {naoIniciado.length > 0 && <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => navigate('/clientes')}>N.Inic: {naoIniciado.length}</Badge>}
              {churnOffices.length > 0 && <Badge variant="destructive" className="text-xs cursor-pointer" onClick={() => navigate('/clientes')}>Churn: {churnOffices.length}</Badge>}
              {naoRenovado.length > 0 && <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => navigate('/clientes')}>N.Ren: {naoRenovado.length}</Badge>}
            </div>
          </CardContent>
        </Card>

        {/* 5. Expansão */}
        <Card className="cursor-pointer card-hover" onClick={() => navigate('/clientes')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expansão/Upsell</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upsellOffices.length}</div>
            <p className="text-xs text-muted-foreground">Oportunidades ativas</p>
          </CardContent>
        </Card>

        {/* 6. NPS médio */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NPS Médio</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">—</div>
            <p className="text-xs text-muted-foreground">Configure formulário NPS</p>
          </CardContent>
        </Card>

        {/* 7. Cobertura */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cobertura</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cobertura}%</div>
            <Progress value={cobertura} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">Clientes com reunião no mês</p>
          </CardContent>
        </Card>

        {/* 8. Health médio */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Médio</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgHealth}</div>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-success">●{greenCount}</span>
              <span className="text-xs text-warning">●{yellowCount}</span>
              <span className="text-xs text-destructive">●{redCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health Distribution + Atenção Hoje */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Health distribution */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" />Distribuição de Saúde</CardTitle></CardHeader>
          <CardContent>
            {healthTotal === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum score calculado.</p>
            ) : (
              <div className="space-y-3">
                {/* Stacked bar */}
                <div className="flex h-8 rounded-lg overflow-hidden">
                  {greenCount > 0 && (
                    <div
                      className="bg-success flex items-center justify-center text-success-foreground text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ width: `${(greenCount / healthTotal) * 100}%` }}
                      onClick={() => navigate('/clientes')}
                    >{greenCount}</div>
                  )}
                  {yellowCount > 0 && (
                    <div
                      className="bg-warning flex items-center justify-center text-warning-foreground text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ width: `${(yellowCount / healthTotal) * 100}%` }}
                      onClick={() => navigate('/clientes')}
                    >{yellowCount}</div>
                  )}
                  {redCount > 0 && (
                    <div
                      className="bg-destructive flex items-center justify-center text-destructive-foreground text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ width: `${(redCount / healthTotal) * 100}%` }}
                      onClick={() => navigate('/clientes')}
                    >{redCount}</div>
                  )}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" />Verde {healthTotal > 0 ? Math.round((greenCount / healthTotal) * 100) : 0}%</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" />Amarelo {healthTotal > 0 ? Math.round((yellowCount / healthTotal) * 100) : 0}%</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" />Vermelho {healthTotal > 0 ? Math.round((redCount / healthTotal) * 100) : 0}%</span>
                </div>

                {/* Quick alerts */}
                <div className="space-y-1.5 pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground">Alertas rápidos</p>
                  <div className="flex items-center justify-between text-xs">
                    <span>Sem percepção no mês</span>
                    <Badge variant="secondary">{semPercepcao.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>+30d sem reunião</span>
                    <Badge variant="secondary">{noMeeting30.length}</Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Atenção Hoje - Table */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" />Atenção Hoje</CardTitle></CardHeader>
          <CardContent>
            {attentionRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum item requer atenção. 🎉</p>
            ) : (
              <div className="max-h-[320px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Escritório</TableHead>
                      <TableHead>Motivo(s)</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Dias</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attentionRows.slice(0, 10).map(row => (
                      <TableRow key={row.officeId} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/clientes/${row.officeId}`)}>
                        <TableCell className="font-medium text-xs max-w-[120px] truncate">{row.officeName}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {row.motivos.map((m, i) => (
                              <Badge key={i} variant={m.type === 'danger' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                {m.label}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.health !== null ? (
                            <Badge className={`text-[10px] ${bandColor(row.band)}`}>{row.health}</Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-xs">{row.days !== null ? `${row.days}d` : '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.action}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {attentionRows.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center mt-2">+{attentionRows.length - 10} itens</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agenda + Funil */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" />Agenda do Dia</CardTitle></CardHeader>
          <CardContent>
            {todayMeetings.length === 0 && todayActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma reunião ou atividade para hoje.</p>
            ) : (
              <div className="space-y-2">
                {todayMeetings.map(m => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/clientes/${m.office_id}`)}>
                    <div><p className="text-sm font-medium">{m.title}</p><p className="text-xs text-muted-foreground">{m.offices?.name}</p></div>
                    <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />{format(new Date(m.scheduled_at), 'HH:mm')}</Badge>
                  </div>
                ))}
                {todayActivities.map(a => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50" onClick={() => navigate('/atividades')}>
                    <div><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-muted-foreground">{a.offices?.name || 'Sem cliente'}</p></div>
                    <Badge variant="outline" className="text-xs">Atividade</Badge>
                  </div>
                ))}
              </div>
            )}
            {upcomingMeetings.length > 0 && <p className="text-xs text-muted-foreground mt-3 cursor-pointer hover:underline" onClick={() => navigate('/reunioes')}>+ {upcomingMeetings.length} próxima{upcomingMeetings.length > 1 ? 's' : ''} →</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-muted-foreground" />Funil da Jornada</CardTitle>
              <Select value={selectedFunnelProduct} onValueChange={setSelectedFunnelProduct}>
                <SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {funnelData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma etapa configurada.</p>
            ) : (
              <div className="space-y-2">
                {funnelData.map((s, i) => {
                  const maxCount = Math.max(...funnelData.map(f => f.count), 1);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20 text-right truncate">{s.name}</span>
                      <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                        <div className="h-full bg-primary/70 rounded-sm transition-all" style={{ width: `${(s.count / maxCount) * 100}%` }} />
                      </div>
                      <span className="text-sm font-medium w-6">{s.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-4 w-4 text-destructive" />Top Churn Risk</CardTitle></CardHeader>
          <CardContent>
            {topChurnRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente em risco. ✅</p>
            ) : (
              <div className="space-y-2">
                {topChurnRisk.map(h => (
                  <div key={h.id} className="flex items-center justify-between rounded-lg border p-2 cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/clientes/${h.office_id}`)}>
                    <p className="text-sm font-medium truncate">{h.offices?.name || 'Escritório'}</p>
                    <Badge variant="destructive" className="text-xs">{h.score}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-success" />Top Expansão</CardTitle></CardHeader>
          <CardContent>
            {topExpansao.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente em expansão.</p>
            ) : (
              <div className="space-y-2">
                {topExpansao.map(o => (
                  <div key={o.id} className="flex items-center justify-between rounded-lg border p-2 cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/clientes/${o.id}`)}>
                    <p className="text-sm font-medium truncate">{o.name}</p>
                    <Badge variant="secondary" className="text-xs">Upsell</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-muted-foreground" />Ranking Evolução</CardTitle></CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">Configure percepção para ver rankings de evolução.</p>
              <p className="text-xs text-muted-foreground mt-1">Campos: faturamento, clientes, colaboradores</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aniversários + Eventos + CSM Performance */}
      <div className={`grid gap-6 ${(isAdmin || isManager) ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        <Card>
          <CardHeader><CardTitle className="text-base">🎂 Próximos Aniversários</CardTitle></CardHeader>
          <CardContent>
            {upcomingBirthdays.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum aniversário nos próximos 30 dias.</p>
            ) : (
              <div className="space-y-2">
                {upcomingBirthdays.map((c, i) => {
                  const bday = new Date(c.birthday);
                  const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
                  const daysUntil = differenceInDays(thisYear, today);
                  return (
                    <div key={i} className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/clientes/${c.office_id}`)}>
                      <div><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.offices?.name}</p></div>
                      <Badge variant={daysUntil === 0 ? 'default' : 'secondary'} className="text-xs">{daysUntil === 0 ? 'Hoje! 🎉' : `em ${daysUntil}d`}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4 text-muted-foreground" />Próximos Eventos</CardTitle></CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento agendado.</p>
            ) : (
              <div className="space-y-2">
                {events.slice(0, 3).map(e => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg border p-2 cursor-pointer hover:bg-muted/50" onClick={() => navigate('/eventos')}>
                    <div><p className="text-sm font-medium truncate">{e.title}</p><p className="text-xs text-muted-foreground">{e.type}</p></div>
                    <Badge variant="outline" className="text-xs">{format(new Date(e.event_date), 'dd/MM')}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* CSM Performance - Manager/Admin only */}
        {(isAdmin || isManager) && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" />Performance por CSM</CardTitle></CardHeader>
            <CardContent>
              {csmPerformance.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum CSM cadastrado.</p>
              ) : (
                <div className="overflow-auto max-h-[280px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">CSM</TableHead>
                        <TableHead className="text-[10px]">Cart.</TableHead>
                        <TableHead className="text-[10px]">Health</TableHead>
                        <TableHead className="text-[10px]">Cob.</TableHead>
                        <TableHead className="text-[10px]">Churn</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csmPerformance.map(csm => (
                        <TableRow key={csm.id}>
                          <TableCell className="text-xs font-medium max-w-[80px] truncate">{csm.name}</TableCell>
                          <TableCell className="text-xs">{csm.portfolio}</TableCell>
                          <TableCell className="text-xs">{csm.avgHealth}</TableCell>
                          <TableCell className="text-xs">{csm.coverage}%</TableCell>
                          <TableCell className="text-xs">{csm.churn > 0 ? <span className="text-destructive font-medium">{csm.churn}</span> : '0'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
