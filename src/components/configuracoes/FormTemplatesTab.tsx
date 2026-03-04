import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2, Trash2, Edit2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const FORM_TYPES = [
  { value: 'kickoff', label: 'Kickoff' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'nutricao', label: 'Nutrição/Acompanhamento' },
  { value: 'renovacao', label: 'Renovação' },
  { value: 'expansao', label: 'Expansão' },
  { value: 'sos', label: 'S.O.S' },
  { value: 'extra', label: 'Extra' },
  { value: 'apresentacao', label: 'Apresentação' },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multi', label: 'Multi-seleção' },
  { value: 'rating', label: 'Rating 1-5' },
  { value: 'nps', label: 'NPS 0-10' },
  { value: 'boolean', label: 'Sim/Não' },
  { value: 'file', label: 'Arquivo' },
];

const MAPPING_OPTIONS = [
  { value: '', label: 'Nenhum' },
  { value: 'office:faturamento_mes', label: 'Percepção: Faturamento mês' },
  { value: 'office:faturamento_ano', label: 'Percepção: Faturamento ano' },
  { value: 'office:qtd_clientes', label: 'Percepção: Qtd clientes' },
  { value: 'office:qtd_colaboradores', label: 'Percepção: Qtd colaboradores' },
  { value: 'health_indicator', label: 'Indicador Health Score' },
  { value: 'metric:nps', label: 'Métrica NPS' },
  { value: 'metric:csat', label: 'Métrica CSAT' },
];

const ACTIVITY_TYPES = [
  { value: 'task', label: 'Tarefa' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'check_in', label: 'Check-in' },
  { value: 'email', label: 'E-mail' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

interface FieldDef {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  mapping?: string;
}

interface PostActions {
  create_activity?: { enabled: boolean; type: string; title: string; days_offset: number };
  move_stage?: { enabled: boolean; stage_id: string };
  notify?: { enabled: boolean; channel: string };
}

export function FormTemplatesTab() {
  const { session } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFields, setPreviewFields] = useState<FieldDef[]>([]);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState('extra');
  const [productId, setProductId] = useState<string>('');
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [postActions, setPostActions] = useState<PostActions>({});

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [tRes, pRes, sRes] = await Promise.all([
      supabase.from('form_templates').select('*, products:product_id(name)').order('name'),
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
      supabase.from('journey_stages').select('id, name, product_id').order('position'),
    ]);
    setTemplates(tRes.data || []);
    setProducts(pRes.data || []);
    setStages(sRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openNew = () => {
    setEditTemplate(null);
    setName(''); setType('extra'); setProductId(''); setFields([]);
    setPostActions({});
    setDialogOpen(true);
  };

  const openEdit = (t: any) => {
    setEditTemplate(t);
    setName(t.name);
    setType(t.type);
    setProductId(t.product_id || '');
    setFields(Array.isArray(t.fields) ? t.fields as FieldDef[] : []);
    setPostActions(t.post_actions && typeof t.post_actions === 'object' ? t.post_actions as PostActions : {});
    setDialogOpen(true);
  };

  const addField = () => {
    setFields(prev => [...prev, { id: crypto.randomUUID(), label: '', type: 'text', required: false }]);
  };

  const updateField = (idx: number, patch: Partial<FieldDef>) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  };

  const removeField = (idx: number) => {
    setFields(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;
    setSaving(true);
    const payload = {
      name,
      type: type as any,
      product_id: productId || null,
      fields: fields as any,
      post_actions: postActions as any,
      created_by: session.user.id,
    };

    if (editTemplate) {
      const { error } = await supabase.from('form_templates').update(payload).eq('id', editTemplate.id);
      if (error) toast.error('Erro: ' + error.message);
      else toast.success('Template atualizado!');
    } else {
      const { error } = await supabase.from('form_templates').insert(payload);
      if (error) toast.error('Erro: ' + error.message);
      else toast.success('Template criado!');
    }
    setSaving(false);
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('form_templates').delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Template removido!'); fetchAll(); }
  };

  const openPreview = (t: any) => {
    setPreviewFields(Array.isArray(t.fields) ? t.fields as FieldDef[] : []);
    setPreviewOpen(true);
  };

  const filteredStages = productId ? stages.filter(s => s.product_id === productId) : stages;

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Novo Template</Button>
      </div>

      {templates.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum template de formulário criado.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Campos</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell><Badge variant="outline">{FORM_TYPES.find(ft => ft.value === t.type)?.label || t.type}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{t.products?.name || 'Todos'}</TableCell>
                  <TableCell className="text-muted-foreground">{Array.isArray(t.fields) ? t.fields.length : 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openPreview(t)}><Eye className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(t)}><Edit2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTemplate ? 'Editar Template' : 'Novo Template'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Tabs defaultValue="fields">
              <TabsList>
                <TabsTrigger value="fields">Campos</TabsTrigger>
                <TabsTrigger value="postactions">Pós-ações</TabsTrigger>
              </TabsList>

              <TabsContent value="fields" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{FORM_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Produto (opcional)</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger><SelectValue placeholder="Todos os produtos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label>Campos do formulário</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addField}><Plus className="mr-1 h-3 w-3" />Campo</Button>
                  </div>
                  {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum campo adicionado.</p>}
                  {fields.map((field, idx) => (
                    <div key={field.id} className="p-3 border rounded-md bg-muted/30 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <Input placeholder="Label do campo" value={field.label} onChange={e => updateField(idx, { label: e.target.value })} />
                          <Select value={field.type} onValueChange={val => updateField(idx, { type: val })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{FIELD_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}</SelectContent>
                          </Select>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" checked={field.required} onChange={e => updateField(idx, { required: e.target.checked })} />
                            <span className="text-sm text-muted-foreground">Obrigatório</span>
                          </div>
                        </div>
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeField(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                      {(field.type === 'dropdown' || field.type === 'multi') && (
                        <Input
                          placeholder="Opções (separadas por vírgula)"
                          value={field.options?.join(', ') || ''}
                          onChange={e => updateField(idx, { options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })}
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Mapear para:</span>
                        <Select value={field.mapping || ''} onValueChange={val => updateField(idx, { mapping: val })}>
                          <SelectTrigger className="w-[250px] h-7 text-xs"><SelectValue placeholder="Nenhum mapeamento" /></SelectTrigger>
                          <SelectContent>{MAPPING_OPTIONS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="postactions" className="space-y-4 mt-4">
                {/* Create Activity */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={postActions.create_activity?.enabled || false}
                      onCheckedChange={val => setPostActions(pa => ({ ...pa, create_activity: { ...pa.create_activity!, enabled: val, type: pa.create_activity?.type || 'task', title: pa.create_activity?.title || '', days_offset: pa.create_activity?.days_offset || 7 } }))}
                    />
                    <Label className="font-medium">Criar atividade</Label>
                  </div>
                  {postActions.create_activity?.enabled && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo</Label>
                        <Select value={postActions.create_activity.type} onValueChange={val => setPostActions(pa => ({ ...pa, create_activity: { ...pa.create_activity!, type: val } }))}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>{ACTIVITY_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Título</Label>
                        <Input className="h-8" value={postActions.create_activity.title} onChange={e => setPostActions(pa => ({ ...pa, create_activity: { ...pa.create_activity!, title: e.target.value } }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Prazo (dias)</Label>
                        <Input className="h-8" type="number" value={postActions.create_activity.days_offset} onChange={e => setPostActions(pa => ({ ...pa, create_activity: { ...pa.create_activity!, days_offset: parseInt(e.target.value) || 7 } }))} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Move Stage */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={postActions.move_stage?.enabled || false}
                      onCheckedChange={val => setPostActions(pa => ({ ...pa, move_stage: { enabled: val, stage_id: pa.move_stage?.stage_id || '' } }))}
                    />
                    <Label className="font-medium">Mover etapa no Kanban</Label>
                  </div>
                  {postActions.move_stage?.enabled && (
                    <div className="space-y-1">
                      <Label className="text-xs">Para qual etapa</Label>
                      <Select value={postActions.move_stage.stage_id} onValueChange={val => setPostActions(pa => ({ ...pa, move_stage: { ...pa.move_stage!, stage_id: val } }))}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{filteredStages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Notify */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={postActions.notify?.enabled || false}
                      onCheckedChange={val => setPostActions(pa => ({ ...pa, notify: { enabled: val, channel: pa.notify?.channel || 'email' } }))}
                    />
                    <Label className="font-medium">Notificar (stub)</Label>
                  </div>
                  {postActions.notify?.enabled && (
                    <Select value={postActions.notify.channel} onValueChange={val => setPostActions(pa => ({ ...pa, notify: { ...pa.notify!, channel: val } }))}>
                      <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="slack">Slack</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Preview do Formulário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {previewFields.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem campos.</p>
            ) : previewFields.map(f => (
              <div key={f.id} className="space-y-1">
                <Label>{f.label}{f.required && ' *'}</Label>
                {f.type === 'text' && <Input disabled placeholder={f.label} />}
                {f.type === 'textarea' && <textarea disabled className="w-full border rounded-md p-2 text-sm bg-muted/30" rows={3} placeholder={f.label} />}
                {f.type === 'number' && <Input disabled type="number" placeholder="0" />}
                {f.type === 'date' && <Input disabled type="date" />}
                {f.type === 'dropdown' && (
                  <Select disabled><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></Select>
                )}
                {f.type === 'multi' && (
                  <div className="flex flex-wrap gap-2">
                    {(f.options || []).map(o => <Badge key={o} variant="outline">{o}</Badge>)}
                  </div>
                )}
                {f.type === 'rating' && (
                  <div className="flex gap-1">{[1,2,3,4,5].map(n => <div key={n} className="w-8 h-8 rounded border flex items-center justify-center text-sm text-muted-foreground">{n}</div>)}</div>
                )}
                {f.type === 'nps' && (
                  <div className="flex gap-1">{[...Array(11)].map((_,n) => <div key={n} className="w-7 h-7 rounded border flex items-center justify-center text-xs text-muted-foreground">{n}</div>)}</div>
                )}
                {f.type === 'boolean' && <Switch disabled />}
                {f.type === 'file' && <Input disabled type="file" />}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
