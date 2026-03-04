import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Constants } from '@/integrations/supabase/types';

interface StageTemplate { id: string; type: string; title: string; due_days: number; description: string; }

export function AutomationStageTasksTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [stages, setStages] = useState<any[]>([]);
  const [selectedStage, setSelectedStage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<StageTemplate[]>([]);
  const [ruleId, setRuleId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('products').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => { const p = data || []; setProducts(p); if (p.length > 0) setSelectedProduct(p[0].id); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;
    supabase.from('journey_stages').select('id, name').eq('product_id', selectedProduct).order('position')
      .then(({ data }) => { const s = data || []; setStages(s); if (s.length > 0) setSelectedStage(s[0].id); });
  }, [selectedProduct]);

  const fetchRule = useCallback(async () => {
    if (!selectedProduct || !selectedStage) return;
    const { data } = await supabase.from('automation_rules' as any).select('*')
      .eq('product_id', selectedProduct).eq('rule_type', 'stage_tasks').maybeSingle();
    if (data) {
      const config = (data as any).config || {};
      const stageTemplates = config.stages?.[selectedStage] || [];
      setTemplates(stageTemplates);
      setRuleId((data as any).id);
    } else {
      setTemplates([]);
      setRuleId(null);
    }
  }, [selectedProduct, selectedStage]);

  useEffect(() => { fetchRule(); }, [fetchRule]);

  const addTemplate = () => {
    setTemplates(prev => [...prev, { id: crypto.randomUUID(), type: 'task', title: '', due_days: 7, description: '' }]);
  };

  const updateTemplate = (id: string, field: string, value: any) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    // Merge with existing stages config
    let existingConfig: any = {};
    if (ruleId) {
      const { data } = await supabase.from('automation_rules' as any).select('config').eq('id', ruleId).single();
      existingConfig = (data as any)?.config || {};
    }
    const stagesConfig = { ...(existingConfig.stages || {}), [selectedStage]: templates };
    const config = { stages: stagesConfig };

    if (ruleId) {
      await supabase.from('automation_rules' as any).update({ config, updated_at: new Date().toISOString() }).eq('id', ruleId);
    } else {
      await supabase.from('automation_rules' as any).insert({ product_id: selectedProduct, rule_type: 'stage_tasks', config });
    }
    toast.success('Atividades por etapa salvas!');
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Configure atividades criadas ao mover um cliente para uma etapa específica.</p>
      <div className="flex gap-3">
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Produto" /></SelectTrigger>
          <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selectedStage} onValueChange={setSelectedStage}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {templates.map((t, index) => (
          <Card key={t.id}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">#{index + 1}</span>
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
                  <Input className="h-8 text-xs" value={t.title} onChange={e => updateTemplate(t.id, 'title', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Prazo (dias após entrar)</Label>
                  <Input className="h-8 text-xs" type="number" min={0} value={t.due_days} onChange={e => updateTemplate(t.id, 'due_days', parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descrição (opcional)</Label>
                <Textarea className="text-xs" rows={2} value={t.description} onChange={e => updateTemplate(t.id, 'description', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addTemplate}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar Atividade</Button>
      <Button onClick={handleSave} disabled={saving} className="ml-3">{saving ? 'Salvando...' : 'Salvar'}</Button>
    </div>
  );
}
