import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2, Edit2, Trash2, GripVertical, X } from 'lucide-react';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const FIELD_TYPES = [
  { value: 'text', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multi_select', label: 'Múltipla escolha' },
  { value: 'boolean', label: 'Sim/Não' },
  { value: 'currency', label: 'Moeda (R$)' },
  { value: 'url', label: 'URL/Link' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefone' },
];

const DATA_SOURCES = [
  { value: 'manual', label: 'Manual' },
  { value: 'form', label: 'Formulário' },
  { value: 'piperun', label: 'Piperun' },
  { value: 'import', label: 'Importação CSV/Excel' },
  { value: 'calculated', label: 'Cálculo automático' },
];

function slugify(text: string): string {
  return 'custom_' + text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

interface CustomField {
  id: string;
  name: string;
  slug: string;
  field_type: string;
  description: string | null;
  scope: string;
  product_id: string | null;
  is_required: boolean;
  default_value: string | null;
  options: string[] | null;
  data_source: string;
  data_source_config: any;
  position: string;
  is_visible: boolean;
  is_editable: boolean;
  sort_order: number;
}

export function CustomFieldsConfigTab() {
  const { user } = useAuth();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editField, setEditField] = useState<CustomField | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState('global');
  const [productId, setProductId] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState('');
  const [dataSource, setDataSource] = useState('manual');
  const [position, setPosition] = useState('body');
  const [isVisible, setIsVisible] = useState(true);
  const [isEditable, setIsEditable] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [fieldsRes, productsRes] = await Promise.all([
      supabase.from('custom_fields' as any).select('*').order('sort_order'),
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
    ]);
    setFields((fieldsRes.data as any[]) || []);
    setProducts(productsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openNew = () => {
    setEditField(null);
    setName(''); setSlug(''); setFieldType('text'); setDescription('');
    setScope('global'); setProductId(''); setIsRequired(false); setDefaultValue('');
    setOptions([]); setNewOption(''); setDataSource('manual'); setPosition('body');
    setIsVisible(true); setIsEditable(true);
    setDialogOpen(true);
  };

  const openEdit = (f: CustomField) => {
    setEditField(f);
    setName(f.name); setSlug(f.slug); setFieldType(f.field_type);
    setDescription(f.description || ''); setScope(f.scope);
    setProductId(f.product_id || ''); setIsRequired(f.is_required);
    setDefaultValue(f.default_value || '');
    setOptions(Array.isArray(f.options) ? f.options : []);
    setNewOption(''); setDataSource(f.data_source); setPosition(f.position);
    setIsVisible(f.is_visible); setIsEditable(f.is_editable);
    setDialogOpen(true);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editField) setSlug(slugify(val));
  };

  const addOption = () => {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      setOptions([...options, newOption.trim()]);
      setNewOption('');
    }
  };

  const removeOption = (idx: number) => {
    setOptions(options.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setSaving(true);

    const payload: any = {
      name: name.trim(),
      slug: slug.trim(),
      field_type: fieldType,
      description: description || null,
      scope,
      product_id: scope === 'product' ? productId || null : null,
      is_required: isRequired,
      default_value: defaultValue || null,
      options: ['dropdown', 'multi_select'].includes(fieldType) ? options : null,
      data_source: dataSource,
      position,
      is_visible: isVisible,
      is_editable: isEditable,
      updated_at: new Date().toISOString(),
    };

    if (editField) {
      const { error } = await supabase.from('custom_fields' as any).update(payload).eq('id', editField.id);
      if (error) toast.error('Erro: ' + error.message);
      else toast.success('Campo atualizado!');
    } else {
      payload.created_by = user?.id;
      payload.sort_order = fields.length;
      const { error } = await supabase.from('custom_fields' as any).insert(payload);
      if (error) toast.error('Erro: ' + error.message);
      else toast.success('Campo criado!');
    }
    setSaving(false);
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este campo personalizado e todos os seus valores?')) return;
    const { error } = await supabase.from('custom_fields' as any).delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Campo removido!'); fetchAll(); }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(fields);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setFields(items);
    // Save order
    for (let i = 0; i < items.length; i++) {
      await supabase.from('custom_fields' as any).update({ sort_order: i }).eq('id', items[i].id);
    }
  };

  const typeLabel = (t: string) => FIELD_TYPES.find(ft => ft.value === t)?.label || t;
  const sourceLabel = (s: string) => DATA_SOURCES.find(ds => ds.value === s)?.label || s;

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{fields.length} campo{fields.length !== 1 ? 's' : ''} personalizado{fields.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Criar campo</Button>
      </div>

      {fields.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum campo personalizado criado.</Card>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="custom-fields">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                {fields.map((f, index) => (
                  <Draggable key={f.id} draggableId={f.id} index={index}>
                    {(prov) => (
                      <div ref={prov.innerRef} {...prov.draggableProps}
                        className="flex items-center gap-3 bg-card border rounded-lg px-3 py-2"
                      >
                        <div {...prov.dragHandleProps} className="cursor-grab">
                          <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{f.name}</span>
                            <Badge variant="outline" className="text-[10px]">{typeLabel(f.field_type)}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{f.position === 'header' ? 'Header' : 'Corpo'}</Badge>
                            {f.scope === 'product' && <Badge variant="secondary" className="text-[10px]">Produto</Badge>}
                            {f.data_source !== 'manual' && <Badge className="text-[10px]">{sourceLabel(f.data_source)}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{f.slug}</p>
                        </div>
                        <Switch checked={f.is_visible} onCheckedChange={async (v) => {
                          await supabase.from('custom_fields' as any).update({ is_visible: v }).eq('id', f.id);
                          fetchAll();
                        }} />
                        <Button size="sm" variant="ghost" onClick={() => openEdit(f)}><Edit2 className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editField ? 'Editar Campo' : 'Novo Campo Personalizado'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={name} onChange={e => handleNameChange(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Slug (auto)</Label>
                <Input value={slug} disabled className="bg-muted" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={fieldType} onValueChange={setFieldType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Posição *</Label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="body">Corpo (Visão 360)</SelectItem>
                    <SelectItem value="header">Header</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição / Tooltip</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Escopo *</Label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (todos)</SelectItem>
                    <SelectItem value="product">Produto específico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {scope === 'product' && (
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fonte de dados</Label>
                <Select value={dataSource} onValueChange={setDataSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DATA_SOURCES.map(ds => <SelectItem key={ds.value} value={ds.value}>{ds.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor padrão</Label>
                <Input value={defaultValue} onChange={e => setDefaultValue(e.target.value)} />
              </div>
            </div>

            {['dropdown', 'multi_select'].includes(fieldType) && (
              <div className="space-y-2">
                <Label>Opções</Label>
                <div className="flex gap-2">
                  <Input value={newOption} onChange={e => setNewOption(e.target.value)} placeholder="Nova opção"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }} />
                  <Button type="button" size="sm" onClick={addOption}>Adicionar</Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {options.map((opt, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {opt}
                      <button type="button" onClick={() => removeOption(i)}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={isRequired} onCheckedChange={setIsRequired} /><Label>Obrigatório</Label></div>
              <div className="flex items-center gap-2"><Switch checked={isVisible} onCheckedChange={setIsVisible} /><Label>Visível</Label></div>
              <div className="flex items-center gap-2"><Switch checked={isEditable} onCheckedChange={setIsEditable} /><Label>Editável</Label></div>
            </div>

            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
