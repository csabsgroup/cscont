import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Constants } from '@/integrations/supabase/types';

interface ActivityTemplate {
  id: string;
  type: string;
  title: string;
  due_days: number;
  description: string;
}

export function AutomationOnboardingTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<ActivityTemplate[]>([]);
  const [ruleId, setRuleId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('products').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => { const p = data || []; setProducts(p); if (p.length > 0) setSelectedProduct(p[0].id); setLoading(false); });
  }, []);

  const fetchRule = useCallback(async () => {
    if (!selectedProduct) return;
    const { data } = await supabase.from('automation_rules' as any).select('*')
      .eq('product_id', selectedProduct).eq('rule_type', 'onboarding_tasks').maybeSingle();
    if (data) {
      setTemplates(((data as any).config?.templates as ActivityTemplate[]) || []);
      setRuleId((data as any).id);
    } else {
      setTemplates([]);
      setRuleId(null);
    }
  }, [selectedProduct]);

  useEffect(() => { fetchRule(); }, [fetchRule]);

  const addTemplate = () => {
    setTemplates(prev => [...prev, { id: crypto.randomUUID(), type: 'task', title: '', due_days: 1, description: '' }]);
  };

  const updateTemplate = (id: string, field: string, value: any) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(templates);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setTemplates(items);
  };

  const handleSave = async () => {
    setSaving(true);
    const config = { templates };
    if (ruleId) {
      await supabase.from('automation_rules' as any).update({ config, updated_at: new Date().toISOString() }).eq('id', ruleId);
    } else {
      await supabase.from('automation_rules' as any).insert({ product_id: selectedProduct, rule_type: 'onboarding_tasks', config });
    }
    toast.success('Atividades de onboarding salvas!');
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const productName = products.find(p => p.id === selectedProduct)?.name || '';

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Configure atividades criadas automaticamente ao adicionar um novo cliente.</p>
      <Select value={selectedProduct} onValueChange={setSelectedProduct}>
        <SelectTrigger className="w-[220px]"><SelectValue placeholder="Produto" /></SelectTrigger>
        <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
      </Select>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="onboarding-templates">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
              {templates.map((t, index) => (
                <Draggable key={t.id} draggableId={t.id} index={index}>
                  {(prov) => (
                    <Card ref={prov.innerRef} {...prov.draggableProps}>
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <div {...prov.dragHandleProps} className="cursor-grab"><GripVertical className="h-4 w-4 text-muted-foreground/40" /></div>
                          <span className="text-xs text-muted-foreground font-medium">#{index + 1}</span>
                          <div className="flex-1" />
                          <Button size="sm" variant="ghost" onClick={() => removeTemplate(t.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Tipo</Label>
                            <Select value={t.type} onValueChange={v => updateTemplate(t.id, 'type', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Constants.public.Enums.activity_type.map(at => (
                                  <SelectItem key={at} value={at}>{at}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Título</Label>
                            <Input className="h-8 text-xs" value={t.title} onChange={e => updateTemplate(t.id, 'title', e.target.value)} placeholder="Título da atividade" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Prazo (dias após entrada)</Label>
                            <Input className="h-8 text-xs" type="number" min={0} value={t.due_days} onChange={e => updateTemplate(t.id, 'due_days', parseInt(e.target.value) || 0)} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Descrição (opcional)</Label>
                          <Textarea className="text-xs" rows={2} value={t.description} onChange={e => updateTemplate(t.id, 'description', e.target.value)} />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <Button variant="outline" size="sm" onClick={addTemplate}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar Atividade</Button>

      {templates.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Ao criar um cliente {productName}, serão geradas {templates.length} atividades automaticamente.
        </p>
      )}

      <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Onboarding'}</Button>
    </div>
  );
}
