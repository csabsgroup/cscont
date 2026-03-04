import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Building2, TrendingDown, TrendingUp, Heart, Info,
  Users, ShieldAlert, DollarSign, Plus, Filter,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isFuture, isPast, differenceInDays, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ActivityCounterBadges, type ActivityCounts } from '@/components/shared/ActivityCounterBadges';

export default function Dashboard() {
  const { user, role, isAdmin, isManager, isCSM } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [healthScores, setHealthScores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [csmProfiles, setCsmProfiles] = useState<any[]>([]);
  const [selectedCsms, setSelectedCsms] = useState<string[]>([]);
  const [activityFilter, setActivityFilter] = useState('todas');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [officesRes, contractsRes, activitiesRes, healthRes, productsRes, profilesRes, rolesRes] = await Promise.all([
      supabase.from('offices').select('*, products:active_product_id(name)'),
      supabase.from('contracts').select('*'),
      supabase.from('activities').select('*, offices(name)').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('health_scores').select('*, offices:office_id(name, status, csm_id)'),
      supabase.from('products').select('id, name').eq('is_active', true),
      supabase.from('profiles').select('id, full_name, avatar_url'),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    setOffices(officesRes.data || []);
    setContracts(contractsRes.data || []);
    setActivities(activitiesRes.data || []);
    setHealthScores(healthRes.data || []);
    setProducts(productsRes.data || []);

    const roles = rolesRes.data || [];
    const profiles = profilesRes.data || [];
    const csmUserIds = roles.filter(r => r.role === 'csm').map(r => r.user_id);
    setCsmProfiles(profiles.filter(p => csmUserIds.includes(p.id)));
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // === FILTERED DATA ===
  const filteredOffices = useMemo(() => {
    if (selectedCsms.length === 0) return offices;
    return offices.filter(o => selectedCsms.includes(o.csm_id));
  }, [offices, selectedCsms]);

  const filteredHealthScores = useMemo(() => {
    if (selectedCsms.length === 0) return healthScores;
    const ids = new Set(filteredOffices.map(o => o.id));
    return healthScores.filter(h => ids.has(h.office_id));
  }, [healthScores, filteredOffices, selectedCsms]);

  const filteredContracts = useMemo(() => {
    if (selectedCsms.length === 0) return contracts;
    const ids = new Set(filteredOffices.map(o => o.id));
    return contracts.filter(c => ids.has(c.office_id));
  }, [contracts, filteredOffices, selectedCsms]);

  // === KPI COMPUTATIONS ===
  const today = new Date();
  const ativos = filteredOffices.filter(o => o.status === 'ativo' || o.status === 'bonus_elite');
  const activeContracts = filteredContracts.filter(c => c.status === 'ativo');
  const mrr = activeContracts.reduce((s, c) => s + (c.monthly_value || 0), 0);

  const newClientsThisMonth = filteredOffices.filter(o => new Date(o.created_at) >= startOfMonth(today));
  const newClientsPrev = filteredOffices.filter(o => {
    const d = new Date(o.created_at);
    return d >= startOfMonth(subMonths(today, 1)) && d < startOfMonth(today);
  });
  const mrrDelta = newClientsThisMonth.length - newClientsPrev.length;

  const redHealth = filteredHealthScores.filter(h => h.band === 'red');
  const mrrAtRisk = redHealth.reduce((s, h) => {
    const c = activeContracts.find(c => c.office_id === h.office_id);
    return s + (c?.monthly_value || 0);
  }, 0);

  const upsellOffices = filteredOffices.filter(o => o.status === 'upsell');
  const mrrExpansion = upsellOffices.reduce((s, o) => {
    const c = activeContracts.find(c => c.office_id === o.id);
    return s + (c?.monthly_value || 0);
  }, 0);

  const greenCount = filteredHealthScores.filter(h => h.band === 'green').length;
  const yellowCount = filteredHealthScores.filter(h => h.band === 'yellow').length;
  const redCount = filteredHealthScores.filter(h => h.band === 'red').length;
  const healthTotal = greenCount + yellowCount + redCount;
  const avgHealth = filteredHealthScores.length > 0 ? Math.round(filteredHealthScores.reduce((s, h) => s + h.score, 0) / filteredHealthScores.length) : 0;
  const healthBand = avgHealth >= 70 ? 'green' : avgHealth >= 40 ? 'yellow' : 'red';

  // === ACTIVITY COUNTS ===
  const pendingActivities = activities.filter(a => !a.completed_at);
  const completedActivities = activities.filter(a => a.completed_at);
  const overdueActs = pendingActivities.filter(a => a.due_date && isPast(new Date(a.due_date)) && !isToday(new Date(a.due_date)));
  const todayActs = pendingActivities.filter(a => a.due_date && isToday(new Date(a.due_date)));
  const futureActs = pendingActivities.filter(a => !a.due_date || (isFuture(new Date(a.due_date)) && !isToday(new Date(a.due_date))));

  const actCounts: ActivityCounts = {
    todas: activities.length,
    atrasadas: overdueActs.length,
    vencemHoje: todayActs.length,
    aVencer: futureActs.length,
    concluidas: completedActivities.length,
  };

  // === FILTERED ACTIVITY LIST ===
  const displayActivities = useMemo(() => {
    let list = activities;
    switch (activityFilter) {
      case 'atrasadas': list = overdueActs; break;
      case 'vencemHoje': list = todayActs; break;
      case 'aVencer': list = futureActs; break;
      case 'concluidas': list = completedActivities; break;
    }
    if (categoryFilter) list = list.filter(a => a.type === categoryFilter);
    return list;
  }, [activities, activityFilter, categoryFilter, overdueActs, todayActs, futureActs, completedActivities]);

  const totalPages = Math.max(1, Math.ceil(displayActivities.length / PAGE_SIZE));
  const pagedActivities = displayActivities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const profileMap = useMemo(() => {
    const map = new Map<string, any>();
    csmProfiles.forEach(p => map.set(p.id, p));
    return map;
  }, [csmProfiles]);

  const healthColor = (band: string) => {
    if (band === 'green') return 'text-green-600';
    if (band === 'yellow') return 'text-yellow-500';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Minha Carteira</h1>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="p-6 space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-16" /></Card>
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
          <h1 className="text-2xl font-bold">Minha Carteira</h1>
          <p className="text-sm text-muted-foreground">Visão geral da sua carteira</p>
        </div>
        {(isAdmin || isManager) && csmProfiles.length > 0 && (
          <Select value={selectedCsms.length === 0 ? 'all' : selectedCsms[0]} onValueChange={(v) => setSelectedCsms(v === 'all' ? [] : [v])}>
            <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Consolidado do time" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Consolidado do time</SelectItem>
              {csmProfiles.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name || 'Sem nome'}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* === SEÇÃO 1: Principais Indicadores === */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Health Score grande */}
        <Card className="flex flex-col items-center justify-center p-6">
          <p className="text-xs uppercase text-gray-400 font-medium tracking-wide">Health Score Médio</p>
          <div className={`text-6xl font-bold mt-2 ${healthColor(healthBand)}`}>{avgHealth}</div>
          <p className="text-xs text-muted-foreground mt-1">Últimos 10 dias</p>
          <div className="flex gap-2 mt-4 w-full">
            {[
              { label: 'Vermelho', count: redCount, color: 'bg-red-500' },
              { label: 'Amarelo', count: yellowCount, color: 'bg-yellow-400' },
              { label: 'Verde', count: greenCount, color: 'bg-green-500' },
            ].map(b => (
              <div key={b.label} className="flex-1">
                <div className={`${b.color} h-6 rounded flex items-center justify-center text-white text-xs font-bold`}>
                  {b.count}
                </div>
                <p className="text-[10px] text-center text-muted-foreground mt-1">{b.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">CLIENTES: {redCount} {yellowCount} {greenCount}</p>
        </Card>

        {/* KPIs Grid 2x4 */}
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'MRR', value: `R$ ${mrr.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`, icon: DollarSign, tip: 'Receita mensal recorrente total' },
            { label: 'Variação MRR', value: `${mrrDelta >= 0 ? '+' : ''}${mrrDelta}`, icon: mrrDelta >= 0 ? ArrowUpRight : ArrowDownRight, tip: 'Novos clientes mês vs anterior', color: mrrDelta >= 0 ? 'text-green-600' : 'text-red-600' },
            { label: 'MRR em Risco', value: `R$ ${mrrAtRisk.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`, icon: ShieldAlert, tip: 'MRR dos clientes com health vermelho', color: 'text-red-600' },
            { label: 'MRR Expansão', value: `R$ ${mrrExpansion.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`, icon: TrendingUp, tip: 'MRR dos clientes em upsell', color: 'text-green-600' },
            { label: 'Clientes Ativos', value: String(ativos.length), icon: Building2, tip: 'Clientes com status ativo ou bonus elite' },
            { label: 'Novos Clientes', value: String(newClientsThisMonth.length), icon: Users, tip: 'Clientes criados este mês' },
            { label: 'Em Risco', value: String(redHealth.length), icon: ShieldAlert, tip: 'Clientes com health vermelho', color: 'text-red-600' },
            { label: 'Expansão', value: String(upsellOffices.length), icon: TrendingUp, tip: 'Clientes marcados como upsell', color: 'text-green-600' },
          ].map((kpi, i) => (
            <Card key={i} className="p-3">
              <div className="flex items-start justify-between">
                <p className="text-xs uppercase text-gray-400 font-medium">{kpi.label}</p>
                <Tooltip>
                  <TooltipTrigger><Info className="h-3 w-3 text-gray-300" /></TooltipTrigger>
                  <TooltipContent><p className="text-xs">{kpi.tip}</p></TooltipContent>
                </Tooltip>
              </div>
              <p className={`text-lg font-bold mt-1 ${kpi.color || ''}`}>{kpi.value}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* === SEÇÃO 2: Contadores de Atividades === */}
      <ActivityCounterBadges
        counts={actCounts}
        activeFilter={activityFilter}
        onFilter={(f) => { setActivityFilter(f); setPage(1); }}
      />

      {/* === SEÇÃO 3: Lista de Atividades === */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2">
            <Button variant="outline" className="border-red-600 text-red-600 hover:bg-red-50" onClick={() => navigate('/atividades')}>
              <Plus className="mr-1 h-4 w-4" />ADICIONAR ATIVIDADE
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={categoryFilter || 'all'} onValueChange={v => { setCategoryFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[160px] h-8"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {['task', 'follow_up', 'onboarding', 'renewal', 'ligacao', 'check_in', 'email', 'whatsapp', 'planejamento', 'other'].map(t => (
                  <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Tipo / Descrição</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedActivities.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma atividade encontrada.</TableCell></TableRow>
              ) : pagedActivities.map(a => {
                const isOverdue = a.due_date && isPast(new Date(a.due_date)) && !isToday(new Date(a.due_date)) && !a.completed_at;
                const csm = profileMap.get(a.user_id);
                const initials = csm?.full_name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?';
                return (
                  <TableRow key={a.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => a.office_id && navigate(`/clientes/${a.office_id}`)}>
                    <TableCell><Checkbox checked={!!a.completed_at} disabled /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{typeLabel(a.type)}</Badge>
                        <span className={`text-sm font-medium ${a.completed_at ? 'line-through text-muted-foreground' : ''}`}>{a.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={csm?.avatar_url} />
                        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.offices?.name || '—'}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{typeLabel(a.type)}</Badge></TableCell>
                    <TableCell className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                      {a.due_date ? format(new Date(a.due_date), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      {isOverdue && ' ⚠'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1">
            {Array.from({ length: Math.min(totalPages, 11) }, (_, i) => {
              const p = i + 1;
              if (totalPages > 11 && i >= 5 && i < totalPages - 2 && i !== page - 1) {
                if (i === 5) return <span key="dots" className="px-2 text-muted-foreground">...</span>;
                return null;
              }
              return (
                <Button key={p} variant={p === page ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={() => setPage(p)}>
                  {p}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    task: 'Tarefa', follow_up: 'Follow-up', onboarding: 'Onboarding', renewal: 'Renovação',
    ligacao: 'Ligação', check_in: 'Check-in', email: 'E-mail', whatsapp: 'WhatsApp',
    planejamento: 'Planejamento', other: 'Outro',
  };
  return labels[type] || type;
}
