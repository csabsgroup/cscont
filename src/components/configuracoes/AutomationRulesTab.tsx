import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Plus, Loader2, Trash2, Edit2, Zap, Clock, X } from 'lucide-react';
import { toast } from 'sonner';

// ─── Trigger definitions ─────────────────────────────────────
interface TriggerDef {
  value: string;
  label: string;
  category: string;
  timing: 'realtime' | 'cron';
  params?: ParamDef[];
}

interface ParamDef {
  key: string;
  label: string;
  type: 'number' | 'select_stage' | 'select_status' | 'select_form' | 'select_band';
  placeholder?: string;
}

const STAGE_PARAMS: ParamDef[] = [
  { key: 'etapa_origem', label: 'Etapa origem (opcional)', type: 'select_stage' },
  { key: 'etapa_destino', label: 'Etapa destino (opcional)', type: 'select_stage' },
];
const STATUS_PARAMS: ParamDef[] = [
  { key: 'status_anterior', label: 'Status anterior (opcional)', type: 'select_status' },
  { key: 'status_novo', label: 'Status novo (opcional)', type: 'select_status' },
];
const BAND_PARAMS: ParamDef[] = [
  { key: 'faixa_anterior', label: 'Faixa anterior (opcional)', type: 'select_band' },
  { key: 'faixa_nova', label: 'Faixa nova (opcional)', type: 'select_band' },
];

const TRIGGERS: TriggerDef[] = [
  { value: 'office.created', label: 'Novo cliente criado', category: 'Cliente', timing: 'realtime' },
  { value: 'office.status_changed', label: 'Status do cliente mudou', category: 'Cliente', timing: 'realtime', params: STATUS_PARAMS },
  { value: 'office.imported_piperun', label: 'Cliente importado do Piperun', category: 'Cliente', timing: 'realtime' },
  { value: 'office.stage_changed', label: 'Cliente mudou de etapa', category: 'Jornada', timing: 'realtime', params: STAGE_PARAMS },
  { value: 'health.band_changed', label: 'Health Score mudou de faixa', category: 'Health Score', timing: 'realtime', params: BAND_PARAMS },
  { value: 'form.submitted', label: 'Formulário submetido', category: 'Formulários', timing: 'realtime', params: [{ key: 'formulario_id', label: 'Formulário (opcional)', type: 'select_form' }] },
  { value: 'meeting.completed', label: 'Reunião realizada', category: 'Reuniões', timing: 'realtime' },
  { value: 'office.no_meeting', label: 'X dias sem reunião', category: 'Reuniões', timing: 'cron', params: [{ key: 'dias', label: 'Dias sem reunião', type: 'number', placeholder: '30' }] },
  { value: 'payment.overdue', label: 'Parcela venceu', category: 'Financeiro', timing: 'realtime', params: [{ key: 'dias_atraso_min', label: 'Dias de atraso mínimo', type: 'number', placeholder: '1' }] },
  { value: 'office.renewal_approaching', label: 'Renovação em X dias', category: 'Financeiro', timing: 'cron', params: [{ key: 'dias', label: 'Dias para renovação', type: 'number', placeholder: '30' }] },
  { value: 'bonus.requested', label: 'Solicitação de bônus criada', category: 'Bônus', timing: 'realtime' },
  { value: 'activity.overdue', label: 'Atividade atrasada', category: 'Atividades', timing: 'cron', params: [{ key: 'dias_atraso_min', label: 'Dias de atraso mínimo', type: 'number', placeholder: '1' }] },
  { value: 'nps.below_threshold', label: 'NPS abaixo de X', category: 'NPS', timing: 'realtime', params: [{ key: 'nota_min', label: 'Nota mínima', type: 'number', placeholder: '7' }] },
  { value: 'contract.created', label: 'Contrato criado', category: 'Contrato/Contato', timing: 'realtime' },
  { value: 'contact.created', label: 'Contato/sócio adicionado', category: 'Contrato/Contato', timing: 'realtime' },
];

const TRIGGER_CATEGORIES = [...new Set(TRIGGERS.map(t => t.category))];

// ─── Condition field definitions ─────────────────────────────
interface ConditionFieldDef {
  value: string;
  label: string;
  category: string;
  type: 'enum' | 'number' | 'text' | 'uuid';
  operators: { value: string; label: string }[];
  options?: { value: string; label: string }[];
  suffix?: string;
}

const OPERATORS = {
  equals: { value: 'equals', label: 'Igual a' },
  not_equals: { value: 'not_equals', label: 'Diferente de' },
  contains: { value: 'contains', label: 'Contém' },
  greater_than: { value: 'greater_than', label: 'Maior que' },
  less_than: { value: 'less_than', label: 'Menor que' },
  between: { value: 'between', label: 'Entre' },
  is_in: { value: 'is_in', label: 'Está em' },
  days_greater_than: { value: 'days_greater_than', label: 'Há mais de X dias' },
  days_less_than: { value: 'days_less_than', label: 'Há menos de X dias' },
  days_equal: { value: 'days_equal', label: 'Há exatamente X dias' },
};

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'churn', label: 'Churn' },
  { value: 'nao_renovado', label: 'Não Renovado' },
  { value: 'nao_iniciado', label: 'Não Iniciado' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'bonus_elite', label: 'Bônus Elite' },
];

const CONTRACT_STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'encerrado', label: 'Encerrado' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'pendente', label: 'Pendente' },
];

const BAND_OPTIONS = [
  { value: 'green', label: 'Verde' },
  { value: 'yellow', label: 'Amarelo' },
  { value: 'red', label: 'Vermelho' },
];

const CONDITION_FIELDS: ConditionFieldDef[] = [
  // ── Cliente / Geral ──
  { value: 'product_id', label: 'Produto', category: 'Cliente', type: 'uuid', operators: [OPERATORS.equals, OPERATORS.not_equals] },
  { value: 'status', label: 'Status do cliente', category: 'Cliente', type: 'enum', operators: [OPERATORS.equals, OPERATORS.not_equals, OPERATORS.is_in], options: STATUS_OPTIONS },
  { value: 'csm_id', label: 'CSM responsável', category: 'Cliente', type: 'uuid', operators: [OPERATORS.equals, OPERATORS.not_equals] },
  { value: 'journey_stage_id', label: 'Etapa da jornada', category: 'Cliente', type: 'uuid', operators: [OPERATORS.equals, OPERATORS.not_equals] },
  { value: 'health_band', label: 'Health Score (faixa)', category: 'Cliente', type: 'enum', operators: [OPERATORS.equals], options: BAND_OPTIONS },
  { value: 'health_score', label: 'Health Score (número)', category: 'Cliente', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'months_as_client', label: 'Tempo como cliente (meses)', category: 'Cliente', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'nps_score', label: 'NPS (última nota)', category: 'Cliente', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.equals] },
  { value: 'ltv', label: 'LTV', category: 'Cliente', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'okr_completion', label: '% OKR concluído', category: 'Cliente', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than] },
  { value: 'partner_count', label: 'Qtd de sócios', category: 'Cliente', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.equals] },

  // ── Datas Relativas ──
  { value: 'days_since_creation', label: 'Dias desde criação', category: 'Datas', type: 'number', operators: [OPERATORS.days_greater_than, OPERATORS.days_less_than, OPERATORS.days_equal, OPERATORS.between], suffix: 'dias' },
  { value: 'days_since_activation', label: 'Dias desde ativação', category: 'Datas', type: 'number', operators: [OPERATORS.days_greater_than, OPERATORS.days_less_than, OPERATORS.days_equal, OPERATORS.between], suffix: 'dias' },
  { value: 'days_since_onboarding', label: 'Dias desde onboarding', category: 'Datas', type: 'number', operators: [OPERATORS.days_greater_than, OPERATORS.days_less_than, OPERATORS.days_equal, OPERATORS.between], suffix: 'dias' },
  { value: 'days_since_first_signature', label: 'Dias desde primeira assinatura', category: 'Datas', type: 'number', operators: [OPERATORS.days_greater_than, OPERATORS.days_less_than, OPERATORS.days_equal, OPERATORS.between], suffix: 'dias' },
  { value: 'last_activity_completed_days', label: 'Dias desde última atividade concluída', category: 'Datas', type: 'number', operators: [OPERATORS.days_greater_than, OPERATORS.days_less_than, OPERATORS.days_equal], suffix: 'dias' },
  { value: 'last_meeting_days', label: 'Dias desde última reunião', category: 'Datas', type: 'number', operators: [OPERATORS.days_greater_than, OPERATORS.days_less_than, OPERATORS.days_equal], suffix: 'dias' },
  { value: 'days_without_meeting', label: 'Dias sem reunião', category: 'Datas', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than], suffix: 'dias' },
  { value: 'days_to_renewal', label: 'Dias para renovação', category: 'Datas', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between], suffix: 'dias' },
  { value: 'days_to_contract_end', label: 'Dias para fim do contrato', category: 'Datas', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between], suffix: 'dias' },

  // ── Empresa ──
  { value: 'segment', label: 'Segmento', category: 'Empresa', type: 'text', operators: [OPERATORS.equals, OPERATORS.not_equals, OPERATORS.contains] },
  { value: 'city', label: 'Cidade', category: 'Empresa', type: 'text', operators: [OPERATORS.equals, OPERATORS.contains] },
  { value: 'state', label: 'Estado', category: 'Empresa', type: 'text', operators: [OPERATORS.equals] },
  { value: 'tags', label: 'Tags', category: 'Empresa', type: 'text', operators: [OPERATORS.contains] },
  { value: 'cnpj', label: 'CNPJ', category: 'Empresa', type: 'text', operators: [OPERATORS.equals, OPERATORS.contains] },
  { value: 'qtd_clientes', label: 'Qtd de clientes da empresa', category: 'Empresa', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'qtd_colaboradores', label: 'Qtd de colaboradores', category: 'Empresa', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'faturamento_mensal', label: 'Faturamento mensal', category: 'Empresa', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'faturamento_anual', label: 'Faturamento anual', category: 'Empresa', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },

  // ── Contrato ──
  { value: 'contract_status', label: 'Status do contrato', category: 'Contrato', type: 'enum', operators: [OPERATORS.equals, OPERATORS.not_equals], options: CONTRACT_STATUS_OPTIONS },
  { value: 'contract_monthly_value', label: 'Valor mensal do contrato', category: 'Contrato', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'contract_total_value', label: 'Valor total do contrato', category: 'Contrato', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'installments_overdue', label: 'Parcelas vencidas', category: 'Contrato', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.equals] },
  { value: 'installments_total', label: 'Total de parcelas', category: 'Contrato', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.equals] },

  // ── Atividades ──
  { value: 'open_activities_count', label: 'Qtd atividades abertas', category: 'Atividades', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.equals] },
  { value: 'overdue_activities_count', label: 'Qtd atividades atrasadas', category: 'Atividades', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.equals] },
];

const CONDITION_CATEGORIES = [...new Set(CONDITION_FIELDS.map(f => f.category))];

interface Condition {
  field: string;
  operator: string;
  value: any;
  value2?: any; // for "between"
}

interface RuleFormData {
  name: string;
  description: string;
  is_active: boolean;
  trigger_type: string;
  trigger_params: Record<string, any>;
  conditions: Condition[];
  condition_logic: 'and' | 'or';
  product_id: string;
}

const EMPTY_FORM: RuleFormData = {
  name: '',
  description: '',
  is_active: true,
  trigger_type: '',
  trigger_params: {},
  conditions: [],
  condition_logic: 'and',
  product_id: '',
};

// ─── Main Component ──────────────────────────────────────────
export function AutomationRulesTab() {
  const { user } = useAuth();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // Reference data
  const [products, setProducts] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [csms, setCsms] = useState<any[]>([]);
  const [formTemplates, setFormTemplates] = useState<any[]>([]);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('automation_rules_v2' as any)
      .select('*')
      .order('created_at', { ascending: false });
    setRules((data as any[]) || []);
    setLoading(false);
  }, []);

  const fetchRefData = useCallback(async () => {
    const [pRes, sRes, cRes, fRes] = await Promise.all([
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
      supabase.from('journey_stages').select('id, name, product_id').order('position'),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('form_templates').select('id, name').order('name'),
    ]);
    setProducts(pRes.data || []);
    setStages(sRes.data || []);
    setCsms(cRes.data || []);
    setFormTemplates(fRes.data || []);
  }, []);

  useEffect(() => { fetchRules(); fetchRefData(); }, [fetchRules, fetchRefData]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (rule: any) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      description: rule.description || '',
      is_active: rule.is_active,
      trigger_type: rule.trigger_type,
      trigger_params: rule.trigger_params || {},
      conditions: rule.conditions || [],
      condition_logic: rule.condition_logic || 'and',
      product_id: rule.product_id || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.trigger_type) {
      toast.error('Nome e trigger são obrigatórios');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description || null,
      is_active: form.is_active,
      trigger_type: form.trigger_type,
      trigger_params: form.trigger_params,
      conditions: form.conditions,
      condition_logic: form.condition_logic,
      actions: [],
      product_id: form.product_id || null,
      created_by: user?.id,
    };

    if (editingId) {
      const { error } = await (supabase.from('automation_rules_v2' as any) as any).update(payload).eq('id', editingId);
      if (error) toast.error('Erro: ' + error.message);
      else toast.success('Regra atualizada!');
    } else {
      const { error } = await (supabase.from('automation_rules_v2' as any) as any).insert(payload);
      if (error) toast.error('Erro: ' + error.message);
      else toast.success('Regra criada!');
    }
    setSaving(false);
    setDialogOpen(false);
    fetchRules();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase.from('automation_rules_v2' as any) as any).delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Regra removida!'); fetchRules(); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await (supabase.from('automation_rules_v2' as any) as any).update({ is_active: !current }).eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else fetchRules();
  };

  const triggerDef = TRIGGERS.find(t => t.value === form.trigger_type);

  // ─── Condition helpers ───────────────────────────────────────
  const addCondition = () => {
    setForm(f => ({ ...f, conditions: [...f.conditions, { field: '', operator: '', value: '' }] }));
  };

  const updateCondition = (idx: number, patch: Partial<Condition>) => {
    setForm(f => {
      const conds = [...f.conditions];
      conds[idx] = { ...conds[idx], ...patch };
      // Reset operator/value when field changes
      if (patch.field) {
        conds[idx].operator = '';
        conds[idx].value = '';
        conds[idx].value2 = undefined;
      }
      return { ...f, conditions: conds };
    });
  };

  const removeCondition = (idx: number) => {
    setForm(f => ({ ...f, conditions: f.conditions.filter((_, i) => i !== idx) }));
  };

  // ─── Render helpers for trigger params ─────────────────────
  const renderTriggerParam = (param: ParamDef) => {
    const val = form.trigger_params[param.key] ?? '';
    const onChange = (v: string) => setForm(f => ({ ...f, trigger_params: { ...f.trigger_params, [param.key]: v || undefined } }));

    if (param.type === 'number') {
      return (
        <div key={param.key} className="space-y-1">
          <Label className="text-xs">{param.label}</Label>
          <Input type="number" value={val} onChange={e => onChange(e.target.value)} placeholder={param.placeholder} />
        </div>
      );
    }
    if (param.type === 'select_stage') {
      return (
        <div key={param.key} className="space-y-1">
          <Label className="text-xs">{param.label}</Label>
          <Select value={val} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Qualquer</SelectItem>
              {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (param.type === 'select_status') {
      return (
        <div key={param.key} className="space-y-1">
          <Label className="text-xs">{param.label}</Label>
          <Select value={val} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Qualquer</SelectItem>
              {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (param.type === 'select_band') {
      return (
        <div key={param.key} className="space-y-1">
          <Label className="text-xs">{param.label}</Label>
          <Select value={val} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Qualquer</SelectItem>
              {BAND_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (param.type === 'select_form') {
      return (
        <div key={param.key} className="space-y-1">
          <Label className="text-xs">{param.label}</Label>
          <Select value={val} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Qualquer</SelectItem>
              {formTemplates.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }
    return null;
  };

  // ─── Render condition value input ──────────────────────────
  const renderConditionValue = (cond: Condition, idx: number) => {
    const fieldDef = CONDITION_FIELDS.find(f => f.value === cond.field);
    if (!fieldDef) return null;

    if (fieldDef.options) {
      if (cond.operator === 'is_in') {
        // Multi-select not implemented yet; show text input
        return (
          <Input
            placeholder="Valores separados por vírgula"
            value={cond.value || ''}
            onChange={e => updateCondition(idx, { value: e.target.value })}
            className="flex-1"
          />
        );
      }
      return (
        <Select value={cond.value || ''} onValueChange={v => updateCondition(idx, { value: v })}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Valor" /></SelectTrigger>
          <SelectContent>
            {fieldDef.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }

    if (fieldDef.value === 'product_id') {
      return (
        <Select value={cond.value || ''} onValueChange={v => updateCondition(idx, { value: v })}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Produto" /></SelectTrigger>
          <SelectContent>
            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    if (fieldDef.value === 'csm_id') {
      return (
        <Select value={cond.value || ''} onValueChange={v => updateCondition(idx, { value: v })}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="CSM" /></SelectTrigger>
          <SelectContent>
            {csms.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name || 'Sem nome'}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    if (fieldDef.value === 'journey_stage_id') {
      return (
        <Select value={cond.value || ''} onValueChange={v => updateCondition(idx, { value: v })}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>
            {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }

    // Number or text
    const hasSuffix = !!fieldDef.suffix;
    if (cond.operator === 'between') {
      return (
        <div className="flex gap-2 flex-1 items-center">
          <Input type="number" placeholder="De" value={cond.value || ''} onChange={e => updateCondition(idx, { value: e.target.value })} />
          <Input type="number" placeholder="Até" value={cond.value2 || ''} onChange={e => updateCondition(idx, { value2: e.target.value })} />
          {hasSuffix && <span className="text-xs text-muted-foreground whitespace-nowrap">{fieldDef.suffix}</span>}
        </div>
      );
    }

    return (
      <div className="flex gap-2 flex-1 items-center">
        <Input
          type={fieldDef.type === 'number' ? 'number' : 'text'}
          placeholder="Valor"
          value={cond.value || ''}
          onChange={e => updateCondition(idx, { value: e.target.value })}
          className="flex-1"
        />
        {hasSuffix && <span className="text-xs text-muted-foreground whitespace-nowrap">{fieldDef.suffix}</span>}
      </div>
    );
  };

  // ─── Loading state ─────────────────────────────────────────
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const getTriggerLabel = (type: string) => TRIGGERS.find(t => t.value === type)?.label || type;
  const getTriggerTiming = (type: string) => TRIGGERS.find(t => t.value === type)?.timing;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{rules.length} regra{rules.length !== 1 ? 's' : ''} configurada{rules.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Nova Regra</Button>
      </div>

      {rules.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma regra de automação criada.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Condições</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">{getTriggerLabel(r.trigger_type)}</Badge>
                      {getTriggerTiming(r.trigger_type) === 'cron' ? (
                        <Badge variant="secondary" className="text-[10px] gap-0.5"><Clock className="h-3 w-3" />Cron</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] gap-0.5"><Zap className="h-3 w-3" />Tempo real</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {(r.conditions as Condition[])?.length || 0} condição(ões)
                  </TableCell>
                  <TableCell>
                    <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r.id, r.is_active)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Edit2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ─── Rule Editor Dialog ───────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Regra' : 'Nova Regra de Automação'}</DialogTitle>
            <DialogDescription>Configure o trigger, condições e parâmetros da regra.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Section 1: Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Informações</h3>
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Notificar CSM quando health cair" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Descrição opcional..." />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>Ativa</Label>
              </div>
            </div>

            {/* Section 2: Trigger (SE) */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">SE (Trigger)</h3>
              <Select value={form.trigger_type} onValueChange={v => setForm(f => ({ ...f, trigger_type: v, trigger_params: {} }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o trigger..." /></SelectTrigger>
                <SelectContent>
                  {TRIGGER_CATEGORIES.map(cat => (
                    <SelectGroup key={cat}>
                      <SelectLabel>{cat}</SelectLabel>
                      {TRIGGERS.filter(t => t.category === cat).map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          <span className="flex items-center gap-2">
                            {t.label}
                            {t.timing === 'cron' ? (
                              <span className="text-[10px] text-muted-foreground">(Cron diário)</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">(Tempo real)</span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>

              {triggerDef?.params && triggerDef.params.length > 0 && (
                <div className="grid grid-cols-2 gap-3 pl-2 border-l-2 border-primary/20">
                  {triggerDef.params.map(p => renderTriggerParam(p))}
                </div>
              )}
            </div>

            {/* Section 3: Conditions (QUANDO) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">QUANDO (Condições)</h3>
                {form.conditions.length > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Lógica:</span>
                    <Select value={form.condition_logic} onValueChange={(v: 'and' | 'or') => setForm(f => ({ ...f, condition_logic: v }))}>
                      <SelectTrigger className="h-7 w-[80px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="and">E (AND)</SelectItem>
                        <SelectItem value="or">OU (OR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {form.conditions.length === 0 && (
                <p className="text-xs text-muted-foreground">Sem condições — a regra executará para qualquer escritório que dispare o trigger.</p>
              )}

              {form.conditions.map((cond, idx) => {
                const fieldDef = CONDITION_FIELDS.find(f => f.value === cond.field);
                return (
                  <div key={idx}>
                    {idx > 0 && (
                      <div className="flex justify-center py-1">
                        <Badge variant="outline" className="text-[10px]">{form.condition_logic === 'and' ? 'E' : 'OU'}</Badge>
                      </div>
                    )}
                    <div className="flex items-start gap-2 bg-muted/30 rounded-lg p-2">
                      {/* Field */}
                      <Select value={cond.field} onValueChange={v => updateCondition(idx, { field: v })}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Campo" /></SelectTrigger>
                        <SelectContent>
                          {CONDITION_CATEGORIES.map(cat => (
                            <SelectGroup key={cat}>
                              <SelectLabel>{cat}</SelectLabel>
                              {CONDITION_FIELDS.filter(f => f.category === cat).map(f => (
                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Operator */}
                      {fieldDef && (
                        <Select value={cond.operator} onValueChange={v => updateCondition(idx, { operator: v })}>
                          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Operador" /></SelectTrigger>
                          <SelectContent>
                            {fieldDef.operators.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      {/* Value */}
                      {fieldDef && cond.operator && renderConditionValue(cond, idx)}
                      {/* Remove */}
                      <Button size="icon" variant="ghost" className="h-10 w-10 flex-shrink-0" onClick={() => removeCondition(idx)}>
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              <Button variant="outline" size="sm" onClick={addCondition}>
                <Plus className="mr-1 h-3.5 w-3.5" />Adicionar condição
              </Button>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Regra'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
