import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Building2, List, LayoutGrid, Table2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/clientes/StatusBadge';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ActivityCounterBadges, ActivityCounts } from '@/components/shared/ActivityCounterBadges';
import { JornadaListView } from '@/components/jornada/JornadaListView';
import { JornadaTableView } from '@/components/jornada/JornadaTableView';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface Product { id: string; name: string; }
interface Stage { id: string; name: string; position: number; description: string | null; sla_days: number | null; }
interface OfficeInStage {
  id: string; office_id: string; journey_stage_id: string; entered_at: string;
  offices: { id: string; name: string; status: string; city: string | null; state: string | null; csm_id: string | null; activation_date?: string | null };
}
interface CsmProfile { id: string; full_name: string | null; }

type ViewMode = 'board' | 'list' | 'table';

export default function Jornada() {
  const { isViewer, session } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [stages, setStages] = useState<Stage[]>([]);
  const [officeJourneys, setOfficeJourneys] = useState<OfficeInStage[]>([]);
  const [healthScores, setHealthScores] = useState<Record<string, { score: number; band: string }>>({});
  const [contracts, setContracts] = useState<Record<string, any>>({});
  const [lastMeetings, setLastMeetings] = useState<Record<string, string>>({});
  const [csmProfiles, setCsmProfiles] = useState<Record<string, CsmProfile>>({});
  const [activitiesMap, setActivitiesMap] = useState<Record<string, { total: number; completed: number }>>({});
  const [loading, setLoading] = useState(true);
  const [moveDialog, setMoveDialog] = useState<{ journey: OfficeInStage; targetStage: string; fromStage: string } | null>(null);
  const [moveReason, setMoveReason] = useState('');
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [filterHealth, setFilterHealth] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCsm, setFilterCsm] = useState('');
  const [csmList, setCsmList] = useState<CsmProfile[]>([]);

  // Activity counts for badges
  const [activityCounts, setActivityCounts] = useState<ActivityCounts>({ todas: 0, atrasadas: 0, vencemHoje: 0, aVencer: 0, concluidas: 0 });

  useEffect(() => {
    supabase.from('products').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => { const p = data || []; setProducts(p); if (p.length > 0) setSelectedProduct(p[0].id); });
    (async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'csm');
      if (roles && roles.length > 0) {
        const ids = roles.map(r => r.user_id);
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
        const list = (profiles || []).map(p => ({ id: p.id, full_name: p.full_name }));
        setCsmList(list);
        const map: Record<string, CsmProfile> = {};
        list.forEach(p => { map[p.id] = p; });
        setCsmProfiles(map);
      }
    })();
  }, []);

  const fetchAll = useCallback(async () => {
    if (!selectedProduct) return;
    setLoading(true);
    const stageIds = (await supabase.from('journey_stages').select('id').eq('product_id', selectedProduct)).data?.map(s => s.id) || [];

    const [stagesRes, journeysRes, healthRes, contractsRes] = await Promise.all([
      supabase.from('journey_stages').select('*').eq('product_id', selectedProduct).order('position'),
      stageIds.length > 0
        ? supabase.from('office_journey').select('*, offices!office_journey_office_id_fkey(id, name, status, city, state, csm_id, activation_date)').in('journey_stage_id', stageIds)
        : Promise.resolve({ data: [] }),
      supabase.from('health_scores').select('office_id, score, band'),
      supabase.from('contracts').select('office_id, renewal_date, installments_overdue, monthly_value').eq('status', 'ativo'),
    ]);

    setStages((stagesRes.data as any[]) || []);
    const journeys = (journeysRes.data as any[]) || [];
    setOfficeJourneys(journeys);

    const hMap: Record<string, { score: number; band: string }> = {};
    (healthRes.data || []).forEach((h: any) => { hMap[h.office_id] = { score: h.score, band: h.band }; });
    setHealthScores(hMap);

    const cMap: Record<string, any> = {};
    (contractsRes.data || []).forEach((c: any) => { cMap[c.office_id] = c; });
    setContracts(cMap);

    const officeIds = journeys.map((oj: any) => oj.office_id);
    if (officeIds.length > 0) {
      const [meetingsRes, activitiesRes] = await Promise.all([
        supabase.from('meetings').select('office_id, scheduled_at').in('office_id', officeIds).eq('status', 'completed').order('scheduled_at', { ascending: false }),
        supabase.from('activities').select('office_id, completed_at, due_date').in('office_id', officeIds),
      ]);

      const mMap: Record<string, string> = {};
      (meetingsRes.data || []).forEach((m: any) => { if (!mMap[m.office_id]) mMap[m.office_id] = m.scheduled_at; });
      setLastMeetings(mMap);

      // Build activity map per office and global counts
      const aMap: Record<string, { total: number; completed: number }> = {};
      let totalAll = 0, totalOverdue = 0, totalToday = 0, totalUpcoming = 0, totalDone = 0;
      const today = new Date(); today.setHours(0,0,0,0);

      (activitiesRes.data || []).forEach((a: any) => {
        const oid = a.office_id;
        if (!aMap[oid]) aMap[oid] = { total: 0, completed: 0 };
        aMap[oid].total++;
        if (a.completed_at) { aMap[oid].completed++; totalDone++; }
        else {
          if (a.due_date) {
            const d = new Date(a.due_date); d.setHours(0,0,0,0);
            if (d < today) totalOverdue++;
            else if (d.getTime() === today.getTime()) totalToday++;
            else totalUpcoming++;
          } else totalUpcoming++;
        }
        totalAll++;
      });
      setActivitiesMap(aMap);
      setActivityCounts({ todas: totalAll, atrasadas: totalOverdue, vencemHoje: totalToday, aVencer: totalUpcoming, concluidas: totalDone });
    }

    setLoading(false);
  }, [selectedProduct]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const confirmMove = async () => {
    if (!moveDialog || !moveReason.trim()) { toast.error('Motivo obrigatório!'); return; }
    const { error } = await supabase.from('office_journey').update({
      journey_stage_id: moveDialog.targetStage,
      entered_at: new Date().toISOString(),
      notes: moveReason,
    }).eq('id', moveDialog.journey.id);

    if (error) { toast.error('Erro: ' + error.message); }
    else {
      await supabase.from('office_stage_history' as any).insert({
        office_id: moveDialog.journey.office_id,
        from_stage_id: moveDialog.fromStage,
        to_stage_id: moveDialog.targetStage,
        changed_by: session?.user?.id,
        reason: moveReason,
        change_type: 'manual',
      });
      // Trigger automation for stage change
      try {
        await supabase.functions.invoke('execute-automations', {
          body: { action: 'triggerV2', trigger_type: 'office.stage_changed', office_id: moveDialog.journey.office_id, context: { stage_id: moveDialog.targetStage } },
        });
      } catch (e) { console.error('Stage automation trigger failed:', e); }
      toast.success('Cliente movido!');
      fetchAll();
    }
    setMoveDialog(null);
    setMoveReason('');
  };

  const onDragEnd = (result: DropResult) => {
    if (isViewer) return;
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    const journey = officeJourneys.find(oj => oj.id === draggableId);
    if (!journey) return;
    setMoveDialog({ journey, targetStage: destination.droppableId, fromStage: source.droppableId });
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const filteredJourneys = officeJourneys.filter(oj => {
    if (filterHealth && healthScores[oj.office_id]?.band !== filterHealth) return false;
    if (filterStatus && oj.offices.status !== filterStatus) return false;
    if (filterCsm && oj.offices.csm_id !== filterCsm) return false;
    return true;
  });

  const officesByStage = (stageId: string) => filteredJourneys.filter(oj => oj.journey_stage_id === stageId);

  const selectedProductName = products.find(p => p.id === selectedProduct)?.name || '';
  const totalClients = filteredJourneys.length;

  const healthColor = (band: string | null) => {
    if (band === 'green') return 'border-l-4 border-l-green-500';
    if (band === 'yellow') return 'border-l-4 border-l-yellow-500';
    if (band === 'red') return 'border-l-4 border-l-red-500';
    return 'border-l-4 border-l-gray-300';
  };

  const healthTextColor = (band: string | null) => {
    if (band === 'green') return 'text-green-600';
    if (band === 'yellow') return 'text-yellow-600';
    if (band === 'red') return 'text-red-600';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {selectedProductName ? `${selectedProductName}` : 'Jornada'} 
            {!loading && <span className="text-muted-foreground font-normal text-base ml-2">({totalClients} Clientes)</span>}
          </h1>
          <p className="text-sm text-muted-foreground">Acompanhe a jornada dos clientes por etapa</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {([
              { mode: 'list' as ViewMode, icon: List, label: 'Lista' },
              { mode: 'board' as ViewMode, icon: LayoutGrid, label: 'Quadro' },
              { mode: 'table' as ViewMode, icon: Table2, label: 'Tabela' },
            ]).map(v => (
              <button
                key={v.mode}
                onClick={() => setViewMode(v.mode)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === v.mode ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                <v.icon className="h-3.5 w-3.5" />
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Produto/Jornada" /></SelectTrigger>
          <SelectContent>
            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {csmList.length > 0 && (
          <Select value={filterCsm} onValueChange={v => setFilterCsm(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos CSMs</SelectItem>
              {csmList.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name || 'Sem nome'}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={filterHealth} onValueChange={v => setFilterHealth(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Saúde" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="green">Verde</SelectItem>
            <SelectItem value="yellow">Amarelo</SelectItem>
            <SelectItem value="red">Vermelho</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="churn">Churn</SelectItem>
            <SelectItem value="nao_renovado">Não Renovado</SelectItem>
            <SelectItem value="nao_iniciado">Não Iniciado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Activity counter badges */}
      {!loading && <ActivityCounterBadges counts={activityCounts} />}

      {/* Content */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[300px] rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <div className="h-5 w-24 rounded skeleton-shimmer" />
              {[...Array(3)].map((_, j) => <div key={j} className="h-20 rounded-lg skeleton-shimmer" />)}
            </div>
          ))}
        </div>
      ) : stages.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhuma etapa configurada para este produto.</p>
        </CardContent></Card>
      ) : viewMode === 'list' ? (
        <JornadaListView
          stages={stages}
          officeJourneys={filteredJourneys}
          healthScores={healthScores}
          contracts={contracts}
          lastMeetings={lastMeetings}
          csmProfiles={csmProfiles}
          activities={activitiesMap}
        />
      ) : viewMode === 'table' ? (
        <JornadaTableView
          stages={stages}
          officeJourneys={filteredJourneys}
          healthScores={healthScores}
          contracts={contracts}
          lastMeetings={lastMeetings}
          csmProfiles={csmProfiles}
          activities={activitiesMap}
        />
      ) : (
        /* BOARD VIEW */
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="relative">
            {/* Scroll shadow indicators */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10" />
            <div className="flex gap-3 overflow-x-auto pb-4 scroll-smooth px-1">
              {stages.map(stage => {
                const offices = officesByStage(stage.id);
                return (
                  <div key={stage.id} className="flex-shrink-0 w-[240px] max-w-[260px]">
                    {/* Column header - compact */}
                    <div className="bg-muted rounded-t-lg py-1.5 px-2 flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{stage.name}</span>
                      <Badge variant="secondary" className="text-[10px] h-5 min-w-5 px-1">{offices.length}</Badge>
                    </div>

                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            'space-y-1.5 min-h-[200px] p-1.5 border border-t-0 border-border/40 rounded-b-lg bg-card transition-colors',
                            snapshot.isDraggingOver && 'bg-accent/30'
                          )}
                        >
                          {offices.length === 0 ? (
                            <p className="text-xs text-muted-foreground/60 text-center py-8">Nenhum cliente</p>
                          ) : offices.map((oj, index) => {
                            const health = healthScores[oj.office_id];
                            const act = activitiesMap[oj.office_id] || { total: 0, completed: 0 };
                            const csm = oj.offices.csm_id ? csmProfiles[oj.offices.csm_id] : null;
                            const contract = contracts[oj.office_id];
                            const taskPct = act.total > 0 ? Math.round((act.completed / act.total) * 100) : 0;
                            const renewalDays = contract?.renewal_date ? differenceInDays(new Date(contract.renewal_date), new Date()) : null;
                            const overdueInstallments = contract?.installments_overdue || 0;

                            return (
                              <Draggable key={oj.id} draggableId={oj.id} index={index} isDragDisabled={isViewer}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={cn(
                                      'rounded-lg bg-white border border-border/50 cursor-pointer hover:shadow-sm transition-shadow',
                                      healthColor(health?.band ?? null),
                                      snapshot.isDragging && 'shadow-lg ring-2 ring-primary/30'
                                    )}
                                    onClick={() => navigate(`/clientes/${oj.offices.id}`)}
                                  >
                                    <div className="p-2.5 space-y-1.5">
                                      {/* Line 1: Health + Name */}
                                      <div className="flex items-center gap-1.5">
                                        {health && (
                                          <span className={cn('text-xs font-bold', healthTextColor(health.band))}>
                                            {Math.round(health.score)}
                                          </span>
                                        )}
                                        <span className="text-xs font-medium truncate flex-1">{oj.offices.name}</span>
                                      </div>
                                      {/* Line 2: CSM avatar + Tasks + Progress */}
                                      <div className="flex items-center gap-1.5">
                                        {csm && (
                                          <div
                                            className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-medium flex-shrink-0"
                                            title={csm.full_name || ''}
                                          >
                                            {getInitials(csm.full_name)}
                                          </div>
                                        )}
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{act.completed}/{act.total}</span>
                                        <Progress value={taskPct} className="h-1 flex-1" />
                                      </div>
                                      {/* Line 3: Optional badges */}
                                      {(renewalDays !== null && renewalDays <= 30 || overdueInstallments > 0) && (
                                        <div className="flex gap-1 flex-wrap">
                                          {renewalDays !== null && renewalDays <= 30 && (
                                            <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-300 text-amber-700">
                                              {renewalDays}d renov
                                            </Badge>
                                          )}
                                          {overdueInstallments > 0 && (
                                            <Badge variant="outline" className="text-[9px] h-4 px-1 border-destructive/50 text-destructive">
                                              {overdueInstallments} vencida{overdueInstallments > 1 ? 's' : ''}
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </div>
        </DragDropContext>
      )}

      {/* Move reason dialog */}
      <Dialog open={!!moveDialog} onOpenChange={(open) => { if (!open) { setMoveDialog(null); setMoveReason(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mover Cliente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Movendo <strong>{moveDialog?.journey.offices.name}</strong> para{' '}
              <strong>{stages.find(s => s.id === moveDialog?.targetStage)?.name}</strong>
            </p>
            <div className="space-y-2">
              <Label>Motivo da movimentação *</Label>
              <Textarea value={moveReason} onChange={e => setMoveReason(e.target.value)}
                placeholder="Descreva o motivo (obrigatório)..." rows={3} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setMoveDialog(null); setMoveReason(''); }}>Cancelar</Button>
              <Button className="flex-1" onClick={confirmMove} disabled={!moveReason.trim()}>Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
