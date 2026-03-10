import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2, Trash2, Edit2, Eye, GripVertical, Copy, ChevronDown, Settings2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// ─── Types ──────────────────────────────────────────────

const FIELD_TYPES = [
  { value: 'text', label: '📝 Texto curto', icon: '📝' },
  { value: 'textarea', label: '📄 Texto longo', icon: '📄' },
  { value: 'number', label: '🔢 Número', icon: '🔢' },
  { value: 'currency', label: '💰 Moeda (R$)', icon: '💰' },
  { value: 'date', label: '📅 Data', icon: '📅' },
  { value: 'dropdown', label: '▼ Dropdown', icon: '▼' },
  { value: 'multi_select', label: '☑️ Múltipla escolha', icon: '☑️' },
  { value: 'rating_5', label: '⭐ Rating 1-5', icon: '⭐' },
  { value: 'rating_nps', label: '📊 Rating 0-10 (NPS)', icon: '📊' },
  { value: 'boolean', label: '🔘 Sim/Não', icon: '🔘' },
  { value: 'file', label: '📎 Arquivo', icon: '📎' },
  { value: 'linear_scale', label: '📏 Escala linear', icon: '📏' },
];

const HEADER_MAPPING_TARGETS = [
  { value: 'offices.faturamento_mensal', label: 'Faturamento mensal' },
  { value: 'offices.faturamento_anual', label: 'Faturamento anual' },
  { value: 'offices.qtd_clientes', label: 'Qtd de clientes' },
  { value: 'offices.qtd_colaboradores', label: 'Qtd de colaboradores' },
  { value: 'offices.last_nps', label: 'NPS (última nota)' },
  { value: 'offices.last_csat', label: 'CSAT (última nota)' },
  { value: 'offices.cs_feeling', label: 'CS Feeling' },
];

const CONDITION_OPERATORS: Record<string, { value: string; label: string }[]> = {
  text: [
    { value: 'equals', label: 'Igual a' },
    { value: 'not_equals', label: 'Diferente de' },
    { value: 'contains', label: 'Contém' },
    { value: 'not_contains', label: 'Não contém' },
    { value: 'is_filled', label: 'Está preenchido' },
    { value: 'is_empty', label: 'Está vazio' },
  ],
  textarea: [
    { value: 'is_filled', label: 'Está preenchido' },
    { value: 'is_empty', label: 'Está vazio' },
    { value: 'contains', label: 'Contém' },
  ],
  number: [
    { value: 'equals', label: 'Igual a' },
    { value: 'not_equals', label: 'Diferente de' },
    { value: 'greater_than', label: 'Maior que' },
    { value: 'less_than', label: 'Menor que' },
    { value: 'is_filled', label: 'Está preenchido' },
  ],
  currency: [
    { value: 'equals', label: 'Igual a' },
    { value: 'greater_than', label: 'Maior que' },
    { value: 'less_than', label: 'Menor que' },
    { value: 'is_filled', label: 'Está preenchido' },
  ],
  dropdown: [
    { value: 'equals', label: 'Igual a' },
    { value: 'not_equals', label: 'Diferente de' },
    { value: 'is_filled', label: 'Está preenchido' },
    { value: 'is_empty', label: 'Está vazio' },
  ],
  multi_select: [
    { value: 'contains', label: 'Contém' },
    { value: 'not_contains', label: 'Não contém' },
    { value: 'is_filled', label: 'Está preenchido' },
  ],
  rating_5: [
    { value: 'equals', label: 'Igual a' },
    { value: 'greater_than', label: 'Maior que' },
    { value: 'less_than', label: 'Menor que' },
  ],
  rating_nps: [
    { value: 'equals', label: 'Igual a' },
    { value: 'greater_than', label: 'Maior que' },
    { value: 'less_than', label: 'Menor que' },
  ],
  boolean: [
    { value: 'equals', label: 'Igual a' },
  ],
  date: [
    { value: 'is_filled', label: 'Está preenchido' },
    { value: 'is_empty', label: 'Está vazio' },
  ],
  linear_scale: [
    { value: 'equals', label: 'Igual a' },
    { value: 'greater_than', label: 'Maior que' },
    { value: 'less_than', label: 'Menor que' },
  ],
  file: [
    { value: 'is_filled', label: 'Está preenchido' },
    { value: 'is_empty', label: 'Está vazio' },
  ],
};

const ACTIVITY_TYPES = [
  { value: 'task', label: 'Tarefa' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'check_in', label: 'Check-in' },
  { value: 'email', label: 'E-mail' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

interface ConditionalRule {
  field_id: string;
  operator: string;
  value: string;
}

interface ConditionalLogic {
  enabled: boolean;
  logic_operator: 'and' | 'or';
  rules: ConditionalRule[];
  action: 'show' | 'skip_to_section';
  target_section_id: string | null;
  // Typeform-style answer routing
  routing_type?: 'answer_routing';
  routes?: { answer_value: string; target_section_id: string }[];
  default_target_section_id?: string | null;
}

interface HeaderMapping {
  enabled: boolean;
  target_field: string;
}

interface FieldDef {
  id: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  section_id?: string | null;
  order: number;
  header_mapping: HeaderMapping;
  conditional_logic: ConditionalLogic;
  controls_meeting_date?: boolean;
}

interface SectionDef {
  id: string;
  title: string;
  order: number;
}

interface PostActions {
  create_activity?: { enabled?: boolean; type?: string; title?: string; days_offset?: number };
  move_stage?: { enabled?: boolean; stage_id?: string };
  notify?: { enabled?: boolean; channel?: string };
}

function defaultField(): FieldDef {
  return {
    id: crypto.randomUUID(),
    label: '',
    type: 'text',
    required: false,
    order: 0,
    header_mapping: { enabled: false, target_field: '' },
    conditional_logic: {
      enabled: false,
      logic_operator: 'and',
      rules: [],
      action: 'show',
      target_section_id: null,
    },
  };
}

// ─── Component ──────────────────────────────────────────

export function FormTemplatesTab() {
  const { session } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Editor state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formType, setFormType] = useState<'internal' | 'external'>('internal');
  const [productId, setProductId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [sections, setSections] = useState<SectionDef[]>([]);
  const [postActions, setPostActions] = useState<PostActions>({});
  const [activeTab, setActiveTab] = useState('fields');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [tRes, pRes, sRes, cfRes] = await Promise.all([
      supabase.from('form_templates').select('*').order('name'),
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
      supabase.from('journey_stages').select('id, name, product_id').order('position'),
      supabase.from('custom_fields').select('id, name, slug, field_type').order('sort_order'),
    ]);
    setTemplates(tRes.data || []);
    setProducts(pRes.data || []);
    setStages(sRes.data || []);
    setCustomFields(cfRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const allMappingTargets = [
    ...HEADER_MAPPING_TARGETS,
    ...customFields.map(cf => ({ value: `custom_field:${cf.id}`, label: `📋 ${cf.name}` })),
  ];

  const resetEditor = () => {
    setName(''); setDescription(''); setFormType('internal'); setProductId('');
    setIsActive(true); setFields([]); setSections([]); setPostActions({});
    setActiveTab('fields'); setEditTemplate(null);
  };

  const openNew = () => { resetEditor(); setEditorOpen(true); };

  const openEdit = (t: any) => {
    setEditTemplate(t);
    setName(t.name);
    setDescription((t as any).description || '');
    setFormType((t as any).form_type || 'internal');
    setProductId(t.product_id || '');
    setIsActive((t as any).is_active !== false);
    const rawFields = Array.isArray(t.fields) ? t.fields : [];
    setFields(rawFields.map((f: any, i: number) => ({
      ...defaultField(),
      ...f,
      order: f.order ?? i,
      header_mapping: f.header_mapping || { enabled: false, target_field: '' },
      conditional_logic: f.conditional_logic || { enabled: false, logic_operator: 'and', rules: [], action: 'show', target_section_id: null },
    })));
    setSections(Array.isArray((t as any).sections) ? (t as any).sections : []);
    setPostActions(t.post_actions && typeof t.post_actions === 'object' ? t.post_actions : {});
    setActiveTab('fields');
    setEditorOpen(true);
  };

  const duplicateTemplate = async (t: any) => {
    if (!session?.user?.id) return;
    const payload = {
      name: t.name + ' (cópia)',
      type: t.type,
      form_type: (t as any).form_type || 'internal',
      product_id: t.product_id,
      fields: t.fields,
      sections: (t as any).sections || [],
      post_actions: t.post_actions,
      description: (t as any).description || null,
      is_active: true,
      form_hash: (t as any).form_type === 'external' ? crypto.randomUUID().replace(/-/g, '').slice(0, 16) : null,
      created_by: session.user.id,
    };
    const { error } = await supabase.from('form_templates').insert(payload as any);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Formulário duplicado!'); fetchAll(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este formulário?')) return;
    const { error } = await supabase.from('form_templates').delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Formulário removido!'); fetchAll(); }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from('form_templates').update({ is_active: !currentActive } as any).eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else fetchAll();
  };

  // ─── Field management ───
  const addField = (fieldType: string) => {
    const f = defaultField();
    f.type = fieldType;
    f.order = fields.length;
    // Only set scale properties for linear_scale
    if (fieldType === 'linear_scale') {
      f.scale_min = 1;
      f.scale_max = 10;
    }
    setFields(prev => [...prev, f]);
  };

  const updateField = (idx: number, patch: Partial<FieldDef>) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  };

  const removeField = (idx: number) => setFields(prev => prev.filter((_, i) => i !== idx));

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const items = Array.from(fields);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setFields(items.map((f, i) => ({ ...f, order: i })));
  };

  // ─── Sections ───
  const addSection = () => {
    setSections(prev => [...prev, { id: crypto.randomUUID(), title: 'Nova seção', order: prev.length }]);
  };

  // ─── Save ───
  const handleSave = async () => {
    if (!session?.user?.id || !name.trim()) { toast.error('Preencha o nome'); return; }
    setSaving(true);

    const hash = editTemplate?.form_hash || (formType === 'external' ? crypto.randomUUID().replace(/-/g, '').slice(0, 16) : null);

    const payload: any = {
      name,
      description: description || null,
      form_type: formType,
      type: formType === 'internal' ? 'extra' : 'extra',
      product_id: productId || null,
      fields: fields as any,
      sections: sections as any,
      post_actions: postActions as any,
      is_active: isActive,
      form_hash: hash,
      created_by: session.user.id,
    };

    if (editTemplate) {
      const { error } = await supabase.from('form_templates').update(payload).eq('id', editTemplate.id);
      if (error) toast.error('Erro: ' + error.message);
      else toast.success('Formulário atualizado!');
    } else {
      const { error } = await supabase.from('form_templates').insert(payload);
      if (error) toast.error('Erro: ' + error.message);
      else toast.success('Formulário criado!');
    }
    setSaving(false);
    setEditorOpen(false);
    fetchAll();
  };

  // ─── Preview ───
  const [previewFields, setPreviewFields] = useState<FieldDef[]>([]);
  const openPreview = (fieldsToPreview: FieldDef[]) => {
    setPreviewFields(fieldsToPreview);
    setPreviewOpen(true);
  };

  const filteredStages = productId ? stages.filter(s => s.product_id === productId) : stages;
  const publicFormUrl = (t: any) => {
    const hash = (t as any).form_hash;
    if (!hash) return '';
    return `${window.location.origin}/forms/${hash}`;
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{templates.length} formulário{templates.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Novo formulário</Button>
      </div>

      {/* ─── List ─── */}
      {templates.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum formulário criado.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Campos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <Badge variant={(t as any).form_type === 'external' ? 'default' : 'outline'}>
                      {(t as any).form_type === 'external' ? '📊 Externo' : '📋 Interno'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.product_id ? products.find(p => p.id === t.product_id)?.name || '—' : 'Todos'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{Array.isArray(t.fields) ? t.fields.length : 0}</TableCell>
                  <TableCell>
                    <Switch
                      checked={(t as any).is_active !== false}
                      onCheckedChange={() => handleToggleActive(t.id, (t as any).is_active !== false)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openPreview(Array.isArray(t.fields) ? t.fields as FieldDef[] : [])} title="Preview"><Eye className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(t)} title="Editar"><Edit2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => duplicateTemplate(t)} title="Duplicar"><Copy className="h-4 w-4" /></Button>
                      {(t as any).form_type === 'external' && (t as any).form_hash && (
                        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(publicFormUrl(t)); toast.success('Link copiado!'); }} title="Copiar link"><Link2 className="h-4 w-4" /></Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ─── Editor Sheet ─── */}
      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editTemplate ? 'Editar Formulário' : 'Novo Formulário'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-6 mt-4 pb-20">
            {/* Header info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Nutrição Mensal" />
              </div>
              <div className="space-y-2">
                <Label>Tipo do formulário</Label>
                <div className="flex gap-3">
                  <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${formType === 'internal' ? 'border-primary bg-primary/5' : 'border-border'} ${editTemplate ? 'opacity-60 pointer-events-none' : ''}`}>
                    <input type="radio" name="form_type" value="internal" checked={formType === 'internal'} onChange={() => setFormType('internal')} disabled={!!editTemplate} className="sr-only" />
                    <span className="text-lg">📋</span>
                    <div>
                      <p className="text-sm font-medium">Interno</p>
                      <p className="text-xs text-muted-foreground">CS preenche</p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${formType === 'external' ? 'border-primary bg-primary/5' : 'border-border'} ${editTemplate ? 'opacity-60 pointer-events-none' : ''}`}>
                    <input type="radio" name="form_type" value="external" checked={formType === 'external'} onChange={() => setFormType('external')} disabled={!!editTemplate} className="sr-only" />
                    <span className="text-lg">📊</span>
                    <div>
                      <p className="text-sm font-medium">Externo</p>
                      <p className="text-xs text-muted-foreground">Cliente responde</p>
                    </div>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select value={productId || '__all__'} onValueChange={v => setProductId(v === '__all__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Todos os produtos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex items-end gap-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                    <Label className="text-sm">{isActive ? 'Ativo' : 'Inativo'}</Label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição opcional do formulário" rows={2} />
              </div>
            </div>
            {formType === 'internal' && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">ℹ️ Campos automáticos:</span> CSM (usuário logado) e Cliente (selecionado na reunião ou 360) são vinculados automaticamente ao submeter.
              </div>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="fields">Campos</TabsTrigger>
                <TabsTrigger value="sections">Seções</TabsTrigger>
                <TabsTrigger value="postactions">Pós-ações</TabsTrigger>
              </TabsList>

              {/* ─── Fields Tab ─── */}
              <TabsContent value="fields" className="space-y-3 mt-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold">Campos ({fields.length})</Label>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => openPreview(fields)}><Eye className="mr-1 h-3 w-3" />Preview</Button>
                  </div>
                </div>

                {/* Field type selector */}
                <div className="grid grid-cols-4 gap-2">
                  {FIELD_TYPES.map(ft => (
                    <Button key={ft.value} type="button" variant="outline" size="sm" className="text-xs h-auto py-2 flex flex-col gap-0.5" onClick={() => addField(ft.value)}>
                      <span>{ft.icon}</span>
                      <span>{ft.label.replace(/^[^\s]+ /, '')}</span>
                    </Button>
                  ))}
                </div>

                {/* Fields list with drag & drop */}
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="fields">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                        {fields.map((field, idx) => (
                          <Draggable key={field.id} draggableId={field.id} index={idx}>
                            {(provided) => (
                              <div ref={provided.innerRef} {...provided.draggableProps} className="border rounded-lg bg-card">
                                <div className="p-3 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div {...provided.dragHandleProps} className="cursor-grab text-muted-foreground"><GripVertical className="h-4 w-4" /></div>
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      {FIELD_TYPES.find(ft => ft.value === field.type)?.icon} {FIELD_TYPES.find(ft => ft.value === field.type)?.label.replace(/^[^\s]+ /, '') || field.type}
                                    </Badge>
                                    <Input
                                      className="h-8 flex-1"
                                      placeholder="Label do campo"
                                      value={field.label}
                                      onChange={e => updateField(idx, { label: e.target.value })}
                                    />
                                    <div className="flex items-center gap-1">
                                      <input type="checkbox" checked={field.required} onChange={e => updateField(idx, { required: e.target.checked })} id={`req-${field.id}`} />
                                      <label htmlFor={`req-${field.id}`} className="text-xs text-muted-foreground">Obrig.</label>
                                    </div>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => removeField(idx)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                  </div>

                                  {/* Options for dropdown/multi_select */}
                                  {(field.type === 'dropdown' || field.type === 'multi_select') && (
                                    <div className="space-y-1.5">
                                      {(field.options && field.options.length > 0 ? field.options : ['']).map((opt, optIdx) => (
                                        <div key={optIdx} className="flex items-center gap-2">
                                          <span className="text-[10px] text-muted-foreground w-14 shrink-0">Opção {optIdx + 1}</span>
                                          <Input
                                            className="h-7 text-xs flex-1"
                                            placeholder={`Opção ${optIdx + 1}`}
                                            value={opt}
                                            onChange={e => {
                                              const newOpts = [...(field.options || [''])];
                                              newOpts[optIdx] = e.target.value;
                                              updateField(idx, { options: newOpts });
                                            }}
                                          />
                                          {(field.options || ['']).length > 1 && (
                                            <Button
                                              type="button" size="sm" variant="ghost"
                                              className="h-7 w-7 p-0"
                                              onClick={() => {
                                                const newOpts = (field.options || ['']).filter((_, i) => i !== optIdx);
                                                updateField(idx, { options: newOpts });
                                              }}
                                            >
                                              <Trash2 className="h-3 w-3 text-destructive" />
                                            </Button>
                                          )}
                                        </div>
                                      ))}
                                      <Button
                                        type="button" variant="ghost" size="sm"
                                        className="h-6 text-xs text-primary"
                                        onClick={() => updateField(idx, { options: [...(field.options || ['']), ''] })}
                                      >
                                        <Plus className="h-3 w-3 mr-1" />Adicionar opção
                                      </Button>
                                    </div>
                                  )}

                                  {/* Linear scale config */}
                                  {field.type === 'linear_scale' && (
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-muted-foreground">De</span>
                                      <Input type="number" className="h-7 w-16" value={field.scale_min ?? 1} onChange={e => updateField(idx, { scale_min: parseInt(e.target.value) || 1 })} />
                                      <span className="text-muted-foreground">até</span>
                                      <Input type="number" className="h-7 w-16" value={field.scale_max ?? 10} onChange={e => updateField(idx, { scale_max: parseInt(e.target.value) || 10 })} />
                                    </div>
                                  )}

                                  {/* Advanced options */}
                                  <Collapsible>
                                    <CollapsibleTrigger asChild>
                                      <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground w-full">
                                        <Settings2 className="h-3 w-3 mr-1" />Opções avançadas<ChevronDown className="h-3 w-3 ml-1" />
                                      </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="space-y-3 pt-2 border-t mt-2">
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                          <Label className="text-xs">Placeholder</Label>
                                          <Input className="h-7 text-xs" value={field.placeholder || ''} onChange={e => updateField(idx, { placeholder: e.target.value })} />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">Descrição/ajuda</Label>
                                          <Input className="h-7 text-xs" value={field.description || ''} onChange={e => updateField(idx, { description: e.target.value })} />
                                        </div>
                                      </div>

                                      {/* Section assignment */}
                                      {sections.length > 0 && (
                                        <div className="space-y-1">
                                          <Label className="text-xs">Seção</Label>
                                          <Select value={field.section_id || '__none__'} onValueChange={v => updateField(idx, { section_id: v === '__none__' ? null : v })}>
                                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="__none__">Nenhuma</SelectItem>
                                              {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      )}

                                      {/* Header mapping */}
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Switch
                                            checked={field.header_mapping.enabled}
                                            onCheckedChange={val => updateField(idx, { header_mapping: { ...field.header_mapping, enabled: val } })}
                                          />
                                          <Label className="text-xs">🎯 Mapear para campo do header</Label>
                                        </div>
                                        {field.header_mapping.enabled && (
                                          <Select value={field.header_mapping.target_field} onValueChange={val => updateField(idx, { header_mapping: { ...field.header_mapping, target_field: val } })}>
                                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecione o campo destino" /></SelectTrigger>
                                            <SelectContent>
                                              {allMappingTargets.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        )}
                                      </div>

                                      {/* Controls meeting date (boolean only) */}
                                      {field.type === 'boolean' && formType === 'internal' && (
                                        <div className="flex items-center gap-2">
                                          <Switch
                                            checked={field.controls_meeting_date || false}
                                            onCheckedChange={val => {
                                              // Only 1 field can control meeting date
                                              if (val) {
                                                setFields(prev => prev.map((f, i) => ({
                                                  ...f,
                                                  controls_meeting_date: i === idx ? true : false,
                                                })));
                                              } else {
                                                updateField(idx, { controls_meeting_date: false });
                                              }
                                            }}
                                          />
                                          <Label className="text-xs">🔀 Controla atualização de data da reunião</Label>
                                        </div>
                                      )}

                                      {/* Conditional logic / Answer routing */}
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Switch
                                            checked={field.conditional_logic.enabled}
                                            onCheckedChange={val => updateField(idx, {
                                              conditional_logic: { ...field.conditional_logic, enabled: val },
                                            })}
                                          />
                                          <Label className="text-xs">🔀 Lógica condicional</Label>
                                        </div>
                                        {field.conditional_logic.enabled && (() => {
                                          // Determine if this field supports answer routing (has discrete options)
                                          const hasOptions = ['dropdown', 'multi_select', 'boolean', 'rating_5', 'rating_nps'].includes(field.type);
                                          const getFieldOptions = (): string[] => {
                                            if (field.type === 'boolean') return ['Sim', 'Não'];
                                            if (field.type === 'rating_5') return ['1', '2', '3', '4', '5'];
                                            if (field.type === 'rating_nps') return ['0','1','2','3','4','5','6','7','8','9','10'];
                                            return field.options?.filter(o => o.trim()) || [];
                                          };
                                          const fieldOptions = getFieldOptions();
                                          const isRouting = field.conditional_logic.routing_type === 'answer_routing';

                                          if (hasOptions && sections.length > 0) {
                                            return (
                                              <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                                                <div className="flex items-center gap-2">
                                                  <Label className="text-xs text-muted-foreground">Modo:</Label>
                                                  <Select
                                                    value={isRouting ? 'answer_routing' : 'conditional'}
                                                    onValueChange={val => {
                                                      if (val === 'answer_routing') {
                                                        updateField(idx, {
                                                          conditional_logic: {
                                                            ...field.conditional_logic,
                                                            routing_type: 'answer_routing',
                                                            routes: fieldOptions.map(o => ({ answer_value: o, target_section_id: '' })),
                                                            default_target_section_id: null,
                                                          },
                                                        });
                                                      } else {
                                                        const cl = { ...field.conditional_logic };
                                                        delete cl.routing_type;
                                                        delete cl.routes;
                                                        delete cl.default_target_section_id;
                                                        updateField(idx, { conditional_logic: cl });
                                                      }
                                                    }}
                                                  >
                                                    <SelectTrigger className="h-6 text-xs w-48"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value="conditional">Mostrar/ocultar campo</SelectItem>
                                                      <SelectItem value="answer_routing">Roteamento por resposta</SelectItem>
                                                    </SelectContent>
                                                  </Select>
                                                </div>

                                                {isRouting ? (
                                                  <div className="space-y-2">
                                                    <Label className="text-xs font-medium">Se responder → Ir para seção</Label>
                                                    {fieldOptions.map((opt, oIdx) => {
                                                      const route = (field.conditional_logic.routes || []).find(r => r.answer_value === opt);
                                                      return (
                                                        <div key={oIdx} className="flex items-center gap-2">
                                                          <span className="text-xs min-w-[80px] truncate font-medium">{opt}</span>
                                                          <span className="text-xs text-muted-foreground">→</span>
                                                          <Select
                                                            value={route?.target_section_id || '__next__'}
                                                            onValueChange={val => {
                                                              const routes = fieldOptions.map(o => {
                                                                const existing = (field.conditional_logic.routes || []).find(r => r.answer_value === o);
                                                                if (o === opt) return { answer_value: o, target_section_id: val === '__next__' ? '' : val };
                                                                return existing || { answer_value: o, target_section_id: '' };
                                                              });
                                                              updateField(idx, {
                                                                conditional_logic: { ...field.conditional_logic, routes },
                                                              });
                                                            }}
                                                          >
                                                            <SelectTrigger className="h-6 text-xs flex-1"><SelectValue placeholder="Próxima seção" /></SelectTrigger>
                                                            <SelectContent>
                                                              <SelectItem value="__next__">Próxima seção (padrão)</SelectItem>
                                                              <SelectItem value="__end__">Encerrar formulário</SelectItem>
                                                              {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                                                            </SelectContent>
                                                          </Select>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                ) : (
                                                  // Legacy conditional logic (show/hide)
                                                  <ConditionalRulesEditor field={field} fields={fields} idx={idx} updateField={updateField} sections={sections} />
                                                )}
                                              </div>
                                            );
                                          }

                                          // Non-routable fields: legacy show/hide logic
                                          return (
                                            <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                                              <ConditionalRulesEditor field={field} fields={fields} idx={idx} updateField={updateField} sections={sections} />
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </CollapsibleContent>
                                  </Collapsible>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>

                {fields.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Clique em um tipo de campo acima para adicionar.</p>
                )}
              </TabsContent>

              {/* ─── Sections Tab ─── */}
              <TabsContent value="sections" className="space-y-3 mt-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold">Seções ({sections.length})</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addSection}><Plus className="mr-1 h-3 w-3" />Seção</Button>
                </div>
                {sections.map((section, sIdx) => (
                  <div key={section.id} className="flex items-center gap-2 p-2 border rounded-md">
                    <Input
                      className="h-8 flex-1"
                      value={section.title}
                      onChange={e => setSections(prev => prev.map((s, i) => i === sIdx ? { ...s, title: e.target.value } : s))}
                      placeholder="Nome da seção"
                    />
                    <Button type="button" size="sm" variant="ghost" onClick={() => setSections(prev => prev.filter((_, i) => i !== sIdx))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                ))}
                {sections.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem seções. Campos serão exibidos sequencialmente.</p>}
              </TabsContent>

              {/* ─── Post-actions Tab ─── */}
              <TabsContent value="postactions" className="space-y-4 mt-4">
                {/* Create Activity */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={postActions.create_activity?.enabled || false}
                      onCheckedChange={val => setPostActions(pa => ({
                        ...pa,
                        create_activity: { ...pa.create_activity, enabled: val, type: pa.create_activity?.type || 'task', title: pa.create_activity?.title || '', days_offset: pa.create_activity?.days_offset || 7 },
                      }))}
                    />
                    <Label className="font-medium">Criar atividade</Label>
                  </div>
                  {postActions.create_activity?.enabled && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo</Label>
                        <Select value={postActions.create_activity.type || 'task'} onValueChange={val => setPostActions(pa => ({ ...pa, create_activity: { ...pa.create_activity!, type: val } }))}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>{ACTIVITY_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Título</Label>
                        <Input className="h-8" value={postActions.create_activity.title || ''} onChange={e => setPostActions(pa => ({ ...pa, create_activity: { ...pa.create_activity!, title: e.target.value } }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Prazo (dias)</Label>
                        <Input className="h-8" type="number" value={postActions.create_activity.days_offset || 7} onChange={e => setPostActions(pa => ({ ...pa, create_activity: { ...pa.create_activity!, days_offset: parseInt(e.target.value) || 7 } }))} />
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
                    <Label className="font-medium">Mover etapa</Label>
                  </div>
                  {postActions.move_stage?.enabled && (
                    <Select value={postActions.move_stage.stage_id || ''} onValueChange={val => setPostActions(pa => ({ ...pa, move_stage: { ...pa.move_stage!, stage_id: val } }))}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{filteredStages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
                {/* Notify */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={postActions.notify?.enabled || false}
                      onCheckedChange={val => setPostActions(pa => ({ ...pa, notify: { enabled: val, channel: pa.notify?.channel || 'email' } }))}
                    />
                    <Label className="font-medium">Notificar</Label>
                  </div>
                  {postActions.notify?.enabled && (
                    <Select value={postActions.notify.channel || 'email'} onValueChange={val => setPostActions(pa => ({ ...pa, notify: { ...pa.notify!, channel: val } }))}>
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

            {/* Save button */}
            <div className="sticky bottom-0 pt-4 bg-background border-t">
              <Button onClick={handleSave} className="w-full" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar formulário'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── Preview Dialog ─── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Preview do Formulário</DialogTitle></DialogHeader>
          <FormPreview fields={previewFields} sections={sections} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Preview Component ───

function FormPreview({ fields, sections }: { fields: FieldDef[]; sections: SectionDef[] }) {
  if (fields.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Sem campos.</p>;

  const renderField = (f: FieldDef) => (
    <div key={f.id} className="space-y-1">
      <Label>{f.label || '(sem label)'}{f.required && ' *'}</Label>
      {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
      {f.type === 'text' && <Input disabled placeholder={f.placeholder || f.label} />}
      {f.type === 'textarea' && <Textarea disabled placeholder={f.placeholder} rows={3} />}
      {f.type === 'number' && <Input disabled type="number" placeholder={f.placeholder || '0'} />}
      {f.type === 'currency' && <Input disabled placeholder={f.placeholder || 'R$ 0,00'} />}
      {f.type === 'date' && <Input disabled type="date" />}
      {f.type === 'dropdown' && (
        <Select disabled><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></Select>
      )}
      {f.type === 'multi_select' && (
        <div className="flex flex-wrap gap-2">{(f.options || []).map(o => <Badge key={o} variant="outline">{o}</Badge>)}</div>
      )}
      {f.type === 'rating_5' && (
        <div className="flex gap-1">{[1,2,3,4,5].map(n => <div key={n} className="w-8 h-8 rounded border flex items-center justify-center text-sm text-muted-foreground">{n}</div>)}</div>
      )}
      {f.type === 'rating_nps' && (
        <div className="flex gap-1 flex-wrap">{Array.from({length:11},(_,n)=>n).map(n => <div key={n} className="w-7 h-7 rounded border flex items-center justify-center text-xs text-muted-foreground">{n}</div>)}</div>
      )}
      {f.type === 'boolean' && <Switch disabled />}
      {f.type === 'file' && <Input disabled type="file" />}
      {f.type === 'linear_scale' && (
        <div className="flex gap-1">{Array.from({length: (f.scale_max || 10) - (f.scale_min || 1) + 1}, (_, i) => (f.scale_min || 1) + i).map(n => (
          <div key={n} className="w-8 h-8 rounded border flex items-center justify-center text-xs text-muted-foreground">{n}</div>
        ))}</div>
      )}
    </div>
  );

  // Group by section
  const unsectioned = fields.filter(f => !f.section_id);
  const sectionedGroups = sections.map(s => ({
    section: s,
    fields: fields.filter(f => f.section_id === s.id),
  }));

  return (
    <div className="space-y-4">
      {unsectioned.map(renderField)}
      {sectionedGroups.map(g => (
        <div key={g.section.id} className="space-y-3">
          <div className="border-b pb-1">
            <h3 className="text-sm font-semibold">{g.section.title}</h3>
          </div>
          {g.fields.map(renderField)}
        </div>
      ))}
    </div>
  );
}
