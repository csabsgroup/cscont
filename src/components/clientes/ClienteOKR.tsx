import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Loader2, Edit2, Trash2, ChevronDown, ChevronRight, Target, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Props { officeId: string; }

const areaLabels: Record<string, string> = {
  gestao_estrategica: 'Gestão Estratégica',
  marketing: 'Marketing',
  vendas: 'Vendas',
  sucesso_cliente: 'Sucesso do Cliente',
  gestao_pessoas: 'Gestão de Pessoas',
  financeiro: 'Financeiro',
};

const areaColors: Record<string, string> = {
  gestao_estrategica: 'bg-primary/10 text-primary',
  marketing: 'bg-purple-100 text-purple-700',
  vendas: 'bg-blue-100 text-blue-700',
  sucesso_cliente: 'bg-green-100 text-green-700',
  gestao_pessoas: 'bg-orange-100 text-orange-700',
  financeiro: 'bg-yellow-100 text-yellow-700',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendente', in_progress: 'Em Andamento', done: 'Concluído', cancelled: 'Cancelado',
};

const krTypeLabels: Record<string, string> = { meta: 'Meta', action: 'Ação' };

export function ClienteOKR({ officeId }: Props) {
  const { session, isViewer } = useAuth();
  const [objectives, setObjectives] = useState<any[]>([]);
  const [krs, setKrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'obj' | 'kr'; id: string; label: string } | null>(null);

  // Objective dialog
  const [objDialogOpen, setObjDialogOpen] = useState(false);
  const [editObj, setEditObj] = useState<any>(null);
  const [objTitle, setObjTitle] = useState('');
  const [objDesc, setObjDesc] = useState('');
  const [objArea, setObjArea] = useState('gestao_estrategica');
  const [objSaving, setObjSaving] = useState(false);

  // KR dialog
  const [krDialogOpen, setKrDialogOpen] = useState(false);
  const [krObjectiveId, setKrObjectiveId] = useState('');
  const [editKr, setEditKr] = useState<any>(null);
  const [krTitle, setKrTitle] = useState('');
  const [krType, setKrType] = useState('action');
  const [krArea, setKrArea] = useState('gestao_estrategica');
  const [krDueDate, setKrDueDate] = useState('');
  const [krStatus, setKrStatus] = useState('pending');
  const [krDesc, setKrDesc] = useState('');
  const [krSaving, setKrSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [oRes, kRes] = await Promise.all([
      supabase.from('okr_objectives').select('*').eq('office_id', officeId).order('created_at'),
      supabase.from('action_plans').select('*').eq('office_id', officeId).not('objective_id', 'is', null).order('created_at'),
    ]);
    setObjectives(oRes.data || []);
    setKrs(kRes.data || []);
    setLoading(false);
  }, [officeId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleOpen = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Objective CRUD
  const openNewObj = () => { setEditObj(null); setObjTitle(''); setObjDesc(''); setObjArea('gestao_estrategica'); setObjDialogOpen(true); };
  const openEditObj = (o: any) => { setEditObj(o); setObjTitle(o.title); setObjDesc(o.description || ''); setObjArea(o.area); setObjDialogOpen(true); };

  const saveObj = async (e: React.FormEvent) => {
    e.preventDefault(); setObjSaving(true);
    const payload: any = { title: objTitle, description: objDesc || null, area: objArea, office_id: officeId };
    if (editObj) {
      await supabase.from('okr_objectives').update(payload).eq('id', editObj.id);
      toast.success('Objetivo atualizado!');
    } else {
      payload.created_by = session?.user?.id;
      await supabase.from('okr_objectives').insert(payload);
      toast.success('Objetivo criado!');
    }
    setObjSaving(false); setObjDialogOpen(false); fetchAll();
  };

  const removeObj = async (id: string) => {
    await supabase.from('okr_objectives').delete().eq('id', id);
    toast.success('Objetivo removido!'); setDeleteTarget(null); fetchAll();
  };

  // KR CRUD
  const openNewKr = (objectiveId: string, area: string) => {
    setEditKr(null); setKrObjectiveId(objectiveId); setKrTitle(''); setKrType('action');
    setKrArea(area); setKrDueDate(''); setKrStatus('pending'); setKrDesc(''); setKrDialogOpen(true);
  };
  const openEditKr = (kr: any) => {
    setEditKr(kr); setKrObjectiveId(kr.objective_id); setKrTitle(kr.title); setKrType(kr.kr_type || 'action');
    setKrArea(kr.area || 'gestao_estrategica'); setKrDueDate(kr.due_date || ''); setKrStatus(kr.status); setKrDesc(kr.description || ''); setKrDialogOpen(true);
  };

  const saveKr = async (e: React.FormEvent) => {
    e.preventDefault(); setKrSaving(true);
    const payload: any = {
      title: krTitle, description: krDesc || null, due_date: krDueDate || null,
      status: krStatus as any, kr_type: krType, area: krArea,
      objective_id: krObjectiveId, office_id: officeId,
    };
    if (editKr) {
      await supabase.from('action_plans').update(payload).eq('id', editKr.id);
      toast.success('KR atualizada!');
    } else {
      payload.created_by = session?.user?.id;
      await supabase.from('action_plans').insert(payload);
      toast.success('KR criada!');
    }
    setKrSaving(false); setKrDialogOpen(false); fetchAll();
  };

  const removeKr = async (id: string) => {
    await supabase.from('action_plans').delete().eq('id', id);
    toast.success('KR removida!'); setDeleteTarget(null); fetchAll();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const getProgress = (objectiveId: string) => {
    const objKrs = krs.filter(k => k.objective_id === objectiveId);
    if (objKrs.length === 0) return 0;
    const done = objKrs.filter(k => k.status === 'done').length;
    return Math.round((done / objKrs.length) * 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{objectives.length} objetivo(s)</p>
        {!isViewer && <Button size="sm" onClick={openNewObj}><Plus className="mr-1 h-4 w-4" />Novo Objetivo</Button>}
      </div>

      {objectives.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Nenhum objetivo no OKR.</div>
      ) : (
        <div className="space-y-3">
          {objectives.map(obj => {
            const progress = getProgress(obj.id);
            const objKrs = krs.filter(k => k.objective_id === obj.id);
            const isOpen = openIds.has(obj.id);
            return (
              <Card key={obj.id} className="overflow-hidden">
                <Collapsible open={isOpen} onOpenChange={() => toggleOpen(obj.id)}>
                  <CollapsibleTrigger asChild>
                    <div className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-3">
                        {isOpen ? <ChevronDown className="h-5 w-5 mt-0.5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 mt-0.5 text-muted-foreground" />}
                        <Target className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{obj.title}</span>
                            <Badge variant="outline" className={`text-xs ${areaColors[obj.area] || ''}`}>{areaLabels[obj.area] || obj.area}</Badge>
                          </div>
                          {obj.description && <p className="text-xs text-muted-foreground mt-0.5">{obj.description}</p>}
                          <div className="flex items-center gap-2 mt-2">
                            <Progress value={progress} className="h-2 flex-1" />
                            <span className="text-xs font-medium text-muted-foreground">{progress}%</span>
                            <span className="text-xs text-muted-foreground">({objKrs.length} KR{objKrs.length !== 1 ? 's' : ''})</span>
                          </div>
                        </div>
                        {!isViewer && (
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <Button size="sm" variant="ghost" onClick={() => openEditObj(obj)}><Edit2 className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteTarget({ type: 'obj', id: obj.id, label: obj.title })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t px-4 pb-4 pt-2 space-y-2">
                      {objKrs.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhuma KR adicionada.</p>}
                      {objKrs.map(kr => (
                        <div key={kr.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/20">
                          <CheckCircle2 className={`h-4 w-4 mt-0.5 flex-shrink-0 ${kr.status === 'done' ? 'text-green-600' : 'text-muted-foreground/40'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm ${kr.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{kr.title}</span>
                              <Badge variant="outline" className="text-xs">{krTypeLabels[kr.kr_type] || 'Ação'}</Badge>
                              <Badge variant="outline" className={`text-xs ${areaColors[kr.area] || ''}`}>{areaLabels[kr.area] || kr.area}</Badge>
                              <Badge variant="secondary" className="text-xs">{statusLabels[kr.status]}</Badge>
                            </div>
                            {kr.description && <p className="text-xs text-muted-foreground mt-0.5">{kr.description}</p>}
                            {kr.due_date && <p className="text-xs text-muted-foreground mt-0.5">Prazo: {format(new Date(kr.due_date), 'dd/MM/yyyy')}</p>}
                            {kr.observations && <p className="text-xs text-muted-foreground mt-1 italic">"{kr.observations}"</p>}
                          </div>
                          {!isViewer && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openEditKr(kr)}><Edit2 className="h-3 w-3" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => setDeleteTarget({ type: 'kr', id: kr.id, label: kr.title })}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                            </div>
                          )}
                        </div>
                      ))}
                      {!isViewer && (
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => openNewKr(obj.id, obj.area)}>
                          <Plus className="mr-1 h-3 w-3" />Nova KR
                        </Button>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      {/* Objective Dialog */}
      <Dialog open={objDialogOpen} onOpenChange={setObjDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editObj ? 'Editar Objetivo' : 'Novo Objetivo'}</DialogTitle></DialogHeader>
          <form onSubmit={saveObj} className="space-y-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={objTitle} onChange={e => setObjTitle(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={objDesc} onChange={e => setObjDesc(e.target.value)} rows={2} /></div>
            <div className="space-y-2">
              <Label>Área *</Label>
              <Select value={objArea} onValueChange={setObjArea}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(areaLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={objSaving}>{objSaving ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* KR Dialog */}
      <Dialog open={krDialogOpen} onOpenChange={setKrDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editKr ? 'Editar KR' : 'Nova KR'}</DialogTitle></DialogHeader>
          <form onSubmit={saveKr} className="space-y-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={krTitle} onChange={e => setKrTitle(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={krDesc} onChange={e => setKrDesc(e.target.value)} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={krType} onValueChange={setKrType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta">Meta</SelectItem>
                    <SelectItem value="action">Ação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Área</Label>
                <Select value={krArea} onValueChange={setKrArea}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(areaLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Prazo</Label><Input type="date" value={krDueDate} onChange={e => setKrDueDate(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={krStatus} onValueChange={setKrStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={krSaving}>{krSaving ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'obj'
                ? `Tem certeza que deseja excluir o objetivo "${deleteTarget.label}" e todas as suas KRs? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir a KR "${deleteTarget?.label}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget?.type === 'obj' ? removeObj(deleteTarget.id) : removeKr(deleteTarget!.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
