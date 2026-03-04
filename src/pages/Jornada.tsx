import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Building2, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/clientes/StatusBadge';
import { HealthBadge } from '@/components/clientes/HealthBadge';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface Product { id: string; name: string; }
interface Stage { id: string; name: string; position: number; description: string | null; sla_days: number | null; }
interface OfficeInStage {
  id: string; office_id: string; journey_stage_id: string; entered_at: string;
  offices: { id: string; name: string; status: string; city: string | null; state: string | null; csm_id: string | null; };
}

export default function Jornada() {
  const { isViewer, session } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [stages, setStages] = useState<Stage[]>([]);
  const [officeJourneys, setOfficeJourneys] = useState<OfficeInStage[]>([]);
  const [healthScores, setHealthScores] = useState<Record<string, { score: number; band: string }>>({});
  const [contracts, setContracts] = useState<Record<string, any>>({});
  const [lastMeetings, setLastMeetings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [moveDialog, setMoveDialog] = useState<{ journey: OfficeInStage; targetStage: string; fromStage: string } | null>(null);
  const [moveReason, setMoveReason] = useState('');
  const navigate = useNavigate();

  const [filterHealth, setFilterHealth] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    supabase.from('products').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => { const p = data || []; setProducts(p); if (p.length > 0) setSelectedProduct(p[0].id); });
  }, []);

  const fetchAll = useCallback(async () => {
    if (!selectedProduct) return;
    setLoading(true);
    const stageIds = (await supabase.from('journey_stages').select('id').eq('product_id', selectedProduct)).data?.map(s => s.id) || [];

    const [stagesRes, journeysRes, healthRes, contractsRes] = await Promise.all([
      supabase.from('journey_stages').select('*').eq('product_id', selectedProduct).order('position'),
      stageIds.length > 0
        ? supabase.from('office_journey').select('*, offices!office_journey_office_id_fkey(id, name, status, city, state, csm_id)').in('journey_stage_id', stageIds)
        : Promise.resolve({ data: [] }),
      supabase.from('health_scores').select('office_id, score, band'),
      supabase.from('contracts').select('office_id, renewal_date, installments_overdue').eq('status', 'ativo'),
    ]);

    setStages((stagesRes.data as any[]) || []);
    setOfficeJourneys((journeysRes.data as any[]) || []);

    const hMap: Record<string, { score: number; band: string }> = {};
    (healthRes.data || []).forEach((h: any) => { hMap[h.office_id] = { score: h.score, band: h.band }; });
    setHealthScores(hMap);

    const cMap: Record<string, any> = {};
    (contractsRes.data || []).forEach((c: any) => { cMap[c.office_id] = c; });
    setContracts(cMap);

    const officeIds = (journeysRes.data as any[] || []).map((oj: any) => oj.office_id);
    if (officeIds.length > 0) {
      const { data: mData } = await supabase.from('meetings')
        .select('office_id, scheduled_at')
        .in('office_id', officeIds)
        .eq('status', 'completed')
        .order('scheduled_at', { ascending: false });
      const mMap: Record<string, string> = {};
      (mData || []).forEach((m: any) => { if (!mMap[m.office_id]) mMap[m.office_id] = m.scheduled_at; });
      setLastMeetings(mMap);
    }

    setLoading(false);
  }, [selectedProduct]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const confirmMove = async () => {
    if (!moveDialog || !moveReason.trim()) {
      toast.error('Motivo obrigatório!');
      return;
    }
    // Update journey
    const { error } = await supabase.from('office_journey').update({
      journey_stage_id: moveDialog.targetStage,
      entered_at: new Date().toISOString(),
      notes: moveReason,
    }).eq('id', moveDialog.journey.id);

    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      // Record history
      await supabase.from('office_stage_history' as any).insert({
        office_id: moveDialog.journey.office_id,
        from_stage_id: moveDialog.fromStage,
        to_stage_id: moveDialog.targetStage,
        changed_by: session?.user?.id,
        reason: moveReason,
        change_type: 'manual',
      });
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

    setMoveDialog({
      journey,
      targetStage: destination.droppableId,
      fromStage: source.droppableId,
    });
  };

  const officesByStage = (stageId: string) => {
    return officeJourneys.filter(oj => {
      if (oj.journey_stage_id !== stageId) return false;
      if (filterHealth && healthScores[oj.office_id]?.band !== filterHealth) return false;
      if (filterStatus && oj.offices.status !== filterStatus) return false;
      return true;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Jornada</h1>
          <p className="text-sm text-muted-foreground">Kanban por produto — acompanhe a jornada dos clientes</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterHealth} onValueChange={v => setFilterHealth(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Saúde" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="green">Verde</SelectItem>
              <SelectItem value="yellow">Amarelo</SelectItem>
              <SelectItem value="red">Vermelho</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={v => setFilterStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="churn">Churn</SelectItem>
              <SelectItem value="nao_renovado">Não Renovado</SelectItem>
              <SelectItem value="nao_iniciado">Não Iniciado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
            <SelectContent>
              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

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
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map(stage => {
              const offices = officesByStage(stage.id);
              return (
                <div key={stage.id} className="flex-shrink-0 w-[300px]">
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs">{offices.length}</Badge>
                      </div>
                      {stage.sla_days && <p className="text-xs text-muted-foreground">SLA: {stage.sla_days} dias</p>}
                    </CardHeader>
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <CardContent
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`space-y-2 min-h-[200px] transition-colors ${snapshot.isDraggingOver ? 'bg-accent/30' : ''}`}
                        >
                          {offices.length === 0 ? (
                            <p className="text-xs text-muted-foreground/60 text-center py-8">Nenhum cliente</p>
                          ) : (
                            offices.map((oj, index) => {
                              const health = healthScores[oj.office_id];
                              const contract = contracts[oj.office_id];
                              const lastMeeting = lastMeetings[oj.office_id];
                              const daysRenewal = contract?.renewal_date ? differenceInDays(new Date(contract.renewal_date), new Date()) : null;
                              const daysSinceMeeting = lastMeeting ? differenceInDays(new Date(), new Date(lastMeeting)) : null;

                              return (
                                <Draggable key={oj.id} draggableId={oj.id} index={index} isDragDisabled={isViewer}>
                                  {(provided, snapshot) => (
                                    <Card
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`cursor-pointer hover:shadow-md transition-shadow p-3 ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/30' : ''}`}
                                      onClick={() => navigate(`/clientes/${oj.offices.id}`)}
                                    >
                                      <div className="flex items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium truncate">{oj.offices.name}</p>
                                            {health && <HealthBadge band={health.band as any} score={health.score} />}
                                          </div>
                                          <p className="text-xs text-muted-foreground">
                                            {[oj.offices.city, oj.offices.state].filter(Boolean).join('/') || '—'}
                                          </p>
                                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                                            <StatusBadge status={oj.offices.status} />
                                            {daysRenewal !== null && (
                                              <span className={`text-xs ${daysRenewal <= 30 ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
                                                🔄 {daysRenewal}d
                                              </span>
                                            )}
                                            {(contract?.installments_overdue || 0) > 0 && (
                                              <span className="text-xs text-destructive font-medium">
                                                💳 {contract.installments_overdue} vencida{contract.installments_overdue > 1 ? 's' : ''}
                                              </span>
                                            )}
                                            {daysSinceMeeting !== null && (
                                              <span className={`text-xs ${daysSinceMeeting > 30 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                                📅 {daysSinceMeeting}d
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </Card>
                                  )}
                                </Draggable>
                              );
                            })
                          )}
                          {provided.placeholder}
                        </CardContent>
                      )}
                    </Droppable>
                  </Card>
                </div>
              );
            })}
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
