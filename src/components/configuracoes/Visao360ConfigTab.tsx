import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, GripVertical, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface Props { mode: 'campos' | 'abas' | 'header'; }

interface ConfigItem { key: string; visible: boolean; order: number; }

const ALL_INDICATORS = [
  { key: 'indicator_health', label: 'Health Score' },
  { key: 'indicator_nps', label: 'NPS' },
  { key: 'indicator_days_no_meeting', label: 'Dias sem Reunião' },
  { key: 'indicator_okr', label: 'Tarefas OKR (X/Y)' },
  { key: 'indicator_overdue', label: 'Parcelas em Atraso' },
  { key: 'indicator_ltv', label: 'LTV Total' },
  { key: 'indicator_coverage', label: 'Cobertura (reunião no mês)' },
  { key: 'indicator_renewal_days', label: 'Dias para Renovação' },
  { key: 'indicator_revenue_month', label: 'Faturamento Mês' },
  { key: 'indicator_revenue_year', label: 'Faturamento Ano' },
  { key: 'indicator_client_count', label: 'Qtd Clientes' },
  { key: 'indicator_employee_count', label: 'Qtd Colaboradores' },
];

const ALL_FIELDS = [
  { key: 'field_revenue_month', label: 'Faturamento Mês' },
  { key: 'field_revenue_year', label: 'Faturamento Ano' },
  { key: 'field_status', label: 'Status' },
  { key: 'field_csm', label: 'CSM' },
  { key: 'field_manager', label: 'Gestor CS' },
  { key: 'field_commercial', label: 'Comercial' },
  { key: 'field_stage', label: 'Etapa/Fase' },
  { key: 'field_cs_feeling', label: 'CS Feeling' },
  { key: 'field_partners', label: 'Sócios/Licenças' },
  { key: 'field_product', label: 'Segmento/Produto' },
  { key: 'field_registration_date', label: 'Data Registro' },
  { key: 'field_city_state', label: 'Cidade/Estado' },
  { key: 'field_whatsapp', label: 'WhatsApp' },
  { key: 'field_email', label: 'Email' },
  { key: 'field_overdue_installments', label: 'Parcelas Vencidas' },
  { key: 'field_renewal_days', label: 'Dias Renovação' },
  { key: 'field_lifetime', label: 'Tempo de Vida' },
  { key: 'field_ltv', label: 'LTV' },
  { key: 'field_cycles', label: 'Ciclos' },
];

const ALL_TABS = [
  { key: 'tab_overview', label: 'Visão 360', locked: true },
  { key: 'tab_activities', label: 'Atividades' },
  { key: 'tab_files', label: 'Arquivos' },
  { key: 'tab_contracts', label: 'Contratos' },
  { key: 'tab_history', label: 'Histórico' },
  { key: 'tab_contacts', label: 'Lista de Contatos' },
  { key: 'tab_notes', label: 'Notas' },
  { key: 'tab_forms', label: 'Formulários' },
  { key: 'tab_okr', label: 'Plano de Ação (OKR)' },
  { key: 'tab_cashback', label: 'Cashback' },
];

const ALL_HEADER_FIELDS = [
  { key: 'header_name', label: 'Nome do escritório', locked: true },
  { key: 'header_logo', label: 'Logo do escritório' },
  { key: 'header_status', label: 'Status' },
  { key: 'header_health', label: 'Health Score' },
  { key: 'header_product', label: 'Produto ativo' },
  { key: 'header_csm', label: 'CSM responsável' },
  { key: 'header_stage', label: 'Etapa da jornada' },
  { key: 'header_activation_date', label: 'Data de ativação' },
  { key: 'header_cycle_start', label: 'Data início ciclo' },
  { key: 'header_cycle_end', label: 'Data fim ciclo' },
  { key: 'header_renewal_days', label: 'Dias para renovação' },
  { key: 'header_overdue', label: 'Parcelas vencidas' },
  { key: 'header_ltv', label: 'LTV' },
  { key: 'header_revenue', label: 'Faturamento mensal' },
  { key: 'header_city_state', label: 'Cidade/Estado' },
  { key: 'header_cnpj', label: 'CNPJ' },
  { key: 'header_whatsapp', label: 'WhatsApp' },
  { key: 'header_email', label: 'Email' },
];

function buildDefaults(allItems: { key: string }[]): ConfigItem[] {
  return allItems.map((item, i) => ({ key: item.key, visible: true, order: i }));
}

export function Visao360ConfigTab({ mode }: Props) {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // For "campos" mode: indicators + fields
  const [indicators, setIndicators] = useState<ConfigItem[]>([]);
  const [fields, setFields] = useState<ConfigItem[]>([]);
  // For "abas" mode: tabs
  const [tabs, setTabs] = useState<ConfigItem[]>([]);
  // For "header" mode
  const [headerFields, setHeaderFields] = useState<ConfigItem[]>([]);
  const [customHeaderFields, setCustomHeaderFields] = useState<{ key: string; label: string }[]>([]);

  useEffect(() => {
    supabase.from('products').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => { const p = data || []; setProducts(p); if (p.length > 0) setSelectedProduct(p[0].id); setLoading(false); });
  }, []);

  const fetchConfig = useCallback(async () => {
    if (!selectedProduct) return;
    setLoading(true);

    if (mode === 'campos') {
      const [indRes, fldRes] = await Promise.all([
        supabase.from('product_360_config' as any).select('*').eq('product_id', selectedProduct).eq('config_type', 'indicators').maybeSingle(),
        supabase.from('product_360_config' as any).select('*').eq('product_id', selectedProduct).eq('config_type', 'fields').maybeSingle(),
      ]);
      setIndicators(mergeConfig(ALL_INDICATORS, (indRes.data as any)?.items));
      setFields(mergeConfig(ALL_FIELDS, (fldRes.data as any)?.items));
    } else if (mode === 'header') {
      // Fetch custom fields with position='header'
      const [headerRes, customRes] = await Promise.all([
        supabase.from('product_360_config' as any).select('*').eq('product_id', selectedProduct).eq('config_type', 'header').maybeSingle(),
        supabase.from('custom_fields' as any).select('slug, name').eq('position', 'header').eq('is_visible', true).order('sort_order'),
      ]);
      const customDefs = ((customRes.data as any[]) || []).map((cf: any) => ({ key: cf.slug, label: cf.name }));
      setCustomHeaderFields(customDefs);
      const allDefs = [...ALL_HEADER_FIELDS, ...customDefs];
      setHeaderFields(mergeConfig(allDefs, (headerRes.data as any)?.items));
    } else {
      const { data } = await supabase.from('product_360_config' as any).select('*').eq('product_id', selectedProduct).eq('config_type', 'tabs').maybeSingle();
      setTabs(mergeConfig(ALL_TABS, (data as any)?.items));
    }
    setLoading(false);
  }, [selectedProduct, mode]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  function mergeConfig(allItems: { key: string }[], saved: ConfigItem[] | undefined | null): ConfigItem[] {
    if (!saved || !Array.isArray(saved)) return buildDefaults(allItems);
    const savedMap = new Map(saved.map(s => [s.key, s]));
    const merged = allItems.map((item, i) => {
      const s = savedMap.get(item.key);
      return s ? { ...s } : { key: item.key, visible: true, order: i };
    });
    return merged.sort((a, b) => a.order - b.order);
  }

  const saveConfig = async (configType: string, items: ConfigItem[]) => {
    setSaving(true);
    const ordered = items.map((item, i) => ({ ...item, order: i }));
    const { data: existing } = await supabase.from('product_360_config' as any).select('id').eq('product_id', selectedProduct).eq('config_type', configType).maybeSingle();
    if (existing) {
      await supabase.from('product_360_config' as any).update({ items: ordered, updated_at: new Date().toISOString() }).eq('id', (existing as any).id);
    } else {
      await supabase.from('product_360_config' as any).insert({ product_id: selectedProduct, config_type: configType, items: ordered });
    }
    toast.success('Configuração salva!');
    setSaving(false);
  };

  const handleDragEnd = (list: ConfigItem[], setList: (v: ConfigItem[]) => void) => (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(list);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setList(items);
  };

  const toggleItem = (list: ConfigItem[], setList: (v: ConfigItem[]) => void, key: string) => {
    setList(list.map(item => item.key === key ? { ...item, visible: !item.visible } : item));
  };

  const renderDraggableList = (
    items: ConfigItem[],
    setItems: (v: ConfigItem[]) => void,
    allDefs: { key: string; label: string; locked?: boolean }[],
    droppableId: string,
  ) => {
    const labelMap = new Map(allDefs.map(d => [d.key, d]));
    return (
      <DragDropContext onDragEnd={handleDragEnd(items, setItems)}>
        <Droppable droppableId={droppableId}>
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
              {items.map((item, index) => {
                const def = labelMap.get(item.key);
                const isLocked = (def as any)?.locked;
                return (
                  <Draggable key={item.key} draggableId={item.key} index={index} isDragDisabled={isLocked}>
                    {(prov) => (
                      <div ref={prov.innerRef} {...prov.draggableProps} className="flex items-center gap-3 bg-white border rounded-lg px-3 py-2">
                        <div {...prov.dragHandleProps} className="cursor-grab">
                          <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                        <span className="flex-1 text-sm">{def?.label || item.key}</span>
                        <Switch
                          checked={isLocked ? true : item.visible}
                          disabled={isLocked}
                          onCheckedChange={() => toggleItem(items, setItems, item.key)}
                        />
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  };

  if (loading && products.length === 0) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
          <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => toast.info('Selecione o produto de origem para copiar a config')}>
          <Copy className="mr-1 h-3.5 w-3.5" />Copiar de outro produto
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : mode === 'campos' ? (
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-semibold mb-3">Cards de Indicadores</h3>
            {renderDraggableList(indicators, setIndicators, ALL_INDICATORS, 'indicators')}
            <Button className="mt-3" size="sm" onClick={() => saveConfig('indicators', indicators)} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Indicadores'}
            </Button>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">Campos Informativos</h3>
            {renderDraggableList(fields, setFields, ALL_FIELDS, 'fields')}
            <Button className="mt-3" size="sm" onClick={() => saveConfig('fields', fields)} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Campos'}
            </Button>
          </div>
        </div>
      ) : mode === 'header' ? (
        <div>
          <h3 className="text-sm font-semibold mb-3">Campos do Header</h3>
          <p className="text-xs text-muted-foreground mb-3">Configure quais campos aparecem no header do Cliente 360. O nome do escritório é obrigatório.</p>
          {renderDraggableList(headerFields, setHeaderFields, [...ALL_HEADER_FIELDS, ...customHeaderFields], 'header')}
          <Button className="mt-3" size="sm" onClick={() => saveConfig('header', headerFields)} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Header'}
          </Button>
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold mb-3">Abas do 360</h3>
          {renderDraggableList(tabs, setTabs, ALL_TABS, 'tabs')}
          <Button className="mt-3" size="sm" onClick={() => saveConfig('tabs', tabs)} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Abas'}
          </Button>
        </div>
      )}
    </div>
  );
}
