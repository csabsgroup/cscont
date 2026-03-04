import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2, Trash2, Edit2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

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
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multi', label: 'Multi-seleção' },
  { value: 'rating', label: 'Rating 1-5' },
  { value: 'nps', label: 'NPS 0-10' },
  { value: 'boolean', label: 'Sim/Não' },
  { value: 'file', label: 'Arquivo' },
];

interface FieldDef {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

export function FormTemplatesTab() {
  const { session } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState('extra');
  const [productId, setProductId] = useState<string>('');
  const [fields, setFields] = useState<FieldDef[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [tRes, pRes] = await Promise.all([
      supabase.from('form_templates').select('*, products:product_id(name)').order('name'),
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
    ]);
    setTemplates(tRes.data || []);
    setProducts(pRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openNew = () => {
    setEditTemplate(null);
    setName(''); setType('extra'); setProductId(''); setFields([]);
    setDialogOpen(true);
  };

  const openEdit = (t: any) => {
    setEditTemplate(t);
    setName(t.name);
    setType(t.type);
    setProductId(t.product_id || '');
    setFields(Array.isArray(t.fields) ? t.fields as FieldDef[] : []);
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTemplate ? 'Editar Template' : 'Novo Template'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
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
                <div key={field.id} className="flex items-start gap-2 p-3 border rounded-md bg-muted/30">
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
                  {(field.type === 'dropdown' || field.type === 'multi') && (
                    <Input
                      placeholder="Opções (separadas por vírgula)"
                      value={field.options?.join(', ') || ''}
                      onChange={e => updateField(idx, { options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })}
                      className="flex-1"
                    />
                  )}
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeField(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>

            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
