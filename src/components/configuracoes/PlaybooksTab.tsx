import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Loader2, Trash2, Edit2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';

const TYPE_LABELS: Record<string, string> = {
  task: 'Tarefa', follow_up: 'Follow-up', onboarding: 'Onboarding', renewal: 'Renovação',
  ligacao: 'Ligação', check_in: 'Check-in', email: 'E-mail', whatsapp: 'WhatsApp',
  planejamento: 'Planejamento', meeting: 'Reunião', other: 'Outro',
};

const PRIORITY_LABELS: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };

interface PlaybookActivity {
  id: string;
  title: string;
  type: string;
  description: string;
  due_days_offset: number;
  priority: string;
  responsible_type: string;
}

const genId = () => crypto.randomUUID();

const emptyActivity = (): PlaybookActivity => ({
  id: genId(), title: '', type: 'task', description: '', due_days_offset: 1, priority: 'medium', responsible_type: 'office_csm',
});

export function PlaybooksTab() {
  const { user } = useAuth();
  const [playbooks, setPlaybooks] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [productId, setProductId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [advanceToStageId, setAdvanceToStageId] = useState('');
  const [activities, setActivities] = useState<PlaybookActivity[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [pbRes, prodRes, stagesRes] = await Promise.all([
      supabase.from('playbook_templates' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
      supabase.from('journey_stages').select('id, name, product_id').order('position'),
    ]);
    setPlaybooks((pbRes.data as any[]) || []);
    setProducts(prodRes.data || []);
    setStages(stagesRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openNew = () => {
    setEditingId(null); setName(''); setDescription(''); setProductId('');
    setIsActive(true); setAutoAdvance(false); setAdvanceToStageId('');
    setActivities([emptyActivity()]);
    setEditorOpen(true);
  };

  const openEdit = (pb: any) => {
    setEditingId(pb.id); setName(pb.name); setDescription(pb.description || '');
    setProductId(pb.product_id || ''); setIsActive(pb.is_active);
    setAutoAdvance(pb.auto_advance_journey || false);
    setAdvanceToStageId(pb.advance_to_stage_id || '');
    const acts = Array.isArray(pb.activities) ? pb.activities.map((a: any) => ({ ...a, id: a.id || genId() })) : [emptyActivity()];
    setActivities(acts);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (activities.some(a => !a.title.trim())) { toast.error('Todas as atividades precisam de título'); return; }
    setSaving(true);
    const payload = {
      name, description: description || null,
      product_id: productId || null, is_active: isActive,
      auto_advance_journey: autoAdvance,
      advance_to_stage_id: autoAdvance && advanceToStageId ? advanceToStageId : null,
      activities: activities.map((a, i) => ({ ...a, order: i + 1 })),
      created_by: user?.id,
    };
    if (editingId) {
      const { error } = await supabase.from('playbook_templates' as any).update(payload).eq('id', editingId);
      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }
      toast.success('Playbook atualizado!');
    } else {
      const { error } = await supabase.from('playbook_templates' as any).insert(payload);
      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }
      toast.success('Playbook criado!');
    }
    setSaving(false); setEditorOpen(false); fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este playbook?')) return;
    await supabase.from('playbook_templates' as any).delete().eq('id', id);
    toast.success('Playbook excluído'); fetchAll();
  };

  const updateActivity = (actId: string, patch: Partial<PlaybookActivity>) => {
    setActivities(prev => prev.map(a => a.id === actId ? { ...a, ...patch } : a));
  };

  const removeActivity = (actId: string) => {
    setActivities(prev => prev.filter(a => a.id !== actId));
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const arr = [...activities];
    const [moved] = arr.splice(result.source.index, 1);
    arr.splice(result.destination.index, 0, moved);
    setActivities(arr);
  };

  const filteredStages = stages.filter(s => !productId || s.product_id === productId);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{playbooks.length} playbook{playbooks.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Novo Playbook</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Atividades</TableHead>
              <TableHead>Auto-Avançar</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {playbooks.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum playbook configurado.</TableCell></TableRow>
            ) : playbooks.map(pb => (
              <TableRow key={pb.id}>
                <TableCell className="font-medium">{pb.name}</TableCell>
                <TableCell className="text-muted-foreground">{products.find(p => p.id === pb.product_id)?.name || 'Todos'}</TableCell>
                <TableCell><Badge variant="secondary">{Array.isArray(pb.activities) ? pb.activities.length : 0}</Badge></TableCell>
                <TableCell>{pb.auto_advance_journey ? <Badge variant="default">Sim</Badge> : <span className="text-muted-foreground">Não</span>}</TableCell>
                <TableCell><Badge variant={pb.is_active ? 'default' : 'secondary'}>{pb.is_active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(pb)}><Edit2 className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(pb.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? '✏️ Editar Playbook' : '📋 Novo Playbook'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2"><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <div className="space-y-2 col-span-2"><Label>Descrição</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
              <div className="space-y-2">
                <Label>Produto</Label>
                <Select value={productId || 'all'} onValueChange={v => setProductId(v === 'all' ? '' : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={isActive} onCheckedChange={setIsActive} /><Label>Ativo</Label>
              </div>
            </div>

            {/* Auto-advance */}
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <Checkbox checked={autoAdvance} onCheckedChange={v => setAutoAdvance(!!v)} />
                <Label className="text-sm">Avançar automaticamente para próxima etapa da jornada ao concluir</Label>
              </div>
              {autoAdvance && (
                <Select value={advanceToStageId || ''} onValueChange={setAdvanceToStageId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a etapa destino" /></SelectTrigger>
                  <SelectContent>
                    {filteredStages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Activities */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Atividades do Playbook</Label>
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="playbook-activities">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="mt-2 space-y-2">
                      {activities.map((act, index) => (
                        <Draggable key={act.id} draggableId={act.id} index={index}>
                          {(prov) => (
                            <div ref={prov.innerRef} {...prov.draggableProps} className="border rounded-lg p-3 bg-card space-y-2">
                              <div className="flex items-center gap-2">
                                <div {...prov.dragHandleProps}><GripVertical className="h-4 w-4 text-muted-foreground" /></div>
                                <span className="text-xs font-bold text-muted-foreground">{index + 1}.</span>
                                <Input placeholder="Título da atividade *" value={act.title} onChange={e => updateActivity(act.id, { title: e.target.value })} className="flex-1 h-8 text-sm" />
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeActivity(act.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                <Select value={act.type} onValueChange={v => updateActivity(act.id, { type: v })}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                                </Select>
                                <div className="flex items-center gap-1">
                                  <Input type="number" className="h-8 text-xs w-16" value={act.due_days_offset} onChange={e => updateActivity(act.id, { due_days_offset: parseInt(e.target.value) || 0 })} />
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">dias</span>
                                </div>
                                <Select value={act.priority} onValueChange={v => updateActivity(act.id, { priority: v })}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={act.responsible_type} onValueChange={v => updateActivity(act.id, { responsible_type: v })}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="office_csm">CSM do escritório</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Textarea placeholder="Descrição..." value={act.description} onChange={e => updateActivity(act.id, { description: e.target.value })} rows={1} className="text-xs" />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setActivities(prev => [...prev, emptyActivity()])}>
                <Plus className="mr-1 h-3 w-3" />Adicionar atividade
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Playbook'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
