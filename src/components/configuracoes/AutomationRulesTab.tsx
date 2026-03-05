import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, Loader2, Trash2, Edit2, Zap, Clock, X, Copy, ArrowLeft, ChevronDown, ChevronUp, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  { value: 'office.registered', label: 'Novo cliente registrado (qualquer origem)', category: 'Cliente', timing: 'realtime' },
  { value: 'office.created', label: 'Novo cliente criado (manual)', category: 'Cliente', timing: 'realtime' },
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
  is_empty: { value: 'is_empty', label: 'Está vazio' },
  is_not_empty: { value: 'is_not_empty', label: 'Não está vazio' },
};

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'churn', label: 'Churn' },
  { value: 'nao_renovado', label: 'Não Renovado' },
  { value: 'nao_iniciado', label: 'Não Iniciado' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'bonus_elite', label: 'Bônus Elite' },
  { value: 'pausado', label: 'Pausado' },
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
  { value: 'product_id', label: 'Produto', category: 'Cliente', type: 'uuid', operators: [OPERATORS.equals, OPERATORS.not_equals] },
  { value: 'status', label: 'Status do cliente', category: 'Cliente', type: 'enum', operators: [OPERATORS.equals, OPERATORS.not_equals, OPERATORS.is_in], options: STATUS_OPTIONS },
  { value: 'csm_id', label: 'CSM responsável', category: 'Cliente', type: 'uuid', operators: [OPERATORS.equals, OPERATORS.not_equals, OPERATORS.is_empty, OPERATORS.is_not_empty] },
  { value: 'journey_stage_id', label: 'Etapa da jornada', category: 'Cliente', type: 'uuid', operators: [OPERATORS.equals, OPERATORS.not_equals] },
  { value: 'health_band', label: 'Health Score (faixa)', category: 'Cliente', type: 'enum', operators: [OPERATORS.equals, OPERATORS.not_equals], options: BAND_OPTIONS },
  { value: 'health_score', label: 'Health Score (número)', category: 'Cliente', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'months_as_client', label: 'Tempo como cliente (meses)', category: 'Cliente', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'nps_score', label: 'NPS (última nota)', category: 'Cliente', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.equals] },
  { value: 'ltv', label: 'LTV', category: 'Cliente', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'okr_completion', label: '% OKR concluído', category: 'Cliente', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than] },
  { value: 'partner_count', label: 'Qtd de sócios', category: 'Cliente', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.equals] },
  { value: 'days_since_creation', label: 'Dias desde criação', category: 'Datas', type: 'number', operators: [OPERATORS.days_greater_than, OPERATORS.days_less_than, OPERATORS.days_equal, OPERATORS.between], suffix: 'dias' },
  { value: 'days_since_activation', label: 'Dias desde ativação', category: 'Datas', type: 'number', operators: [OPERATORS.days_greater_than, OPERATORS.days_less_than, OPERATORS.days_equal, OPERATORS.between], suffix: 'dias' },
  { value: 'days_since_onboarding', label: 'Dias desde onboarding', category: 'Datas', type: 'number', operators: [OPERATORS.days_greater_than, OPERATORS.days_less_than, OPERATORS.days_equal, OPERATORS.between], suffix: 'dias' },
  { value: 'days_since_first_signature', label: 'Dias desde primeira assinatura', category: 'Datas', type: 'number', operators: [OPERATORS.days_greater_than, OPERATORS.days_less_than, OPERATORS.days_equal, OPERATORS.between], suffix: 'dias' },
  { value: 'last_activity_completed_days', label: 'Dias desde última atividade concluída', category: 'Datas', type: 'number', operators: [OPERATORS.days_greater_than, OPERATORS.days_less_than, OPERATORS.days_equal], suffix: 'dias' },
  { value: 'last_meeting_days', label: 'Dias desde última reunião', category: 'Datas', type: 'number', operators: [OPERATORS.days_greater_than, OPERATORS.days_less_than, OPERATORS.days_equal], suffix: 'dias' },
  { value: 'days_without_meeting', label: 'Dias sem reunião', category: 'Datas', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than], suffix: 'dias' },
  { value: 'days_to_renewal', label: 'Dias para renovação', category: 'Datas', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between], suffix: 'dias' },
  { value: 'days_to_contract_end', label: 'Dias para fim do contrato', category: 'Datas', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between], suffix: 'dias' },
  { value: 'days_since_cycle_start', label: 'Dias no ciclo atual', category: 'Datas', type: 'number', operators: [OPERATORS.days_greater_than, OPERATORS.days_less_than, OPERATORS.between], suffix: 'dias' },
  { value: 'days_since_churn', label: 'Dias desde churn', category: 'Churn', type: 'number', operators: [OPERATORS.days_greater_than, OPERATORS.days_less_than, OPERATORS.days_equal], suffix: 'dias' },
  { value: 'churn_reason', label: 'Motivo do churn', category: 'Churn', type: 'text', operators: [OPERATORS.equals, OPERATORS.not_equals, OPERATORS.is_empty, OPERATORS.is_not_empty] },
  { value: 'segment', label: 'Segmento', category: 'Empresa', type: 'text', operators: [OPERATORS.equals, OPERATORS.not_equals, OPERATORS.contains] },
  { value: 'city', label: 'Cidade', category: 'Empresa', type: 'text', operators: [OPERATORS.equals, OPERATORS.contains] },
  { value: 'state', label: 'Estado', category: 'Empresa', type: 'text', operators: [OPERATORS.equals] },
  { value: 'tags', label: 'Tags', category: 'Empresa', type: 'text', operators: [OPERATORS.contains] },
  { value: 'cnpj', label: 'CNPJ', category: 'Empresa', type: 'text', operators: [OPERATORS.equals, OPERATORS.contains, OPERATORS.is_empty, OPERATORS.is_not_empty] },
  { value: 'qtd_clientes', label: 'Qtd de clientes da empresa', category: 'Empresa', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'qtd_colaboradores', label: 'Qtd de colaboradores', category: 'Empresa', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'faturamento_mensal', label: 'Faturamento mensal', category: 'Empresa', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'faturamento_anual', label: 'Faturamento anual', category: 'Empresa', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'contract_status', label: 'Status do contrato', category: 'Contrato', type: 'enum', operators: [OPERATORS.equals, OPERATORS.not_equals], options: CONTRACT_STATUS_OPTIONS },
  { value: 'contract_monthly_value', label: 'Valor mensal do contrato', category: 'Contrato', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'contract_total_value', label: 'Valor total do contrato', category: 'Contrato', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.between] },
  { value: 'installments_overdue', label: 'Parcelas vencidas', category: 'Contrato', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.equals] },
  { value: 'installments_total', label: 'Total de parcelas', category: 'Contrato', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.equals] },
  { value: 'open_activities_count', label: 'Qtd atividades abertas', category: 'Atividades', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.equals] },
  { value: 'overdue_activities_count', label: 'Qtd atividades atrasadas', category: 'Atividades', type: 'number', operators: [OPERATORS.greater_than, OPERATORS.less_than, OPERATORS.equals] },
];

const CONDITION_CATEGORIES = [...new Set(CONDITION_FIELDS.map(f => f.category))];

// ─── Types ───────────────────────────────────────────────────
interface Condition {
  field: string;
  operator: string;
  value: any;
  value2?: any;
}

interface ConditionGroup {
  id: string;
  logic: 'and' | 'or';
  conditions: Condition[];
}

interface ActionConfig {
  id: string;
  type: string;
  config: Record<string, any>;
}

interface ScheduleConfig {
  start_date?: string;
  frequency?: string;
  stop_type?: 'never' | 'on_date' | 'after_count';
  stop_date?: string;
  stop_count?: number;
  retrigger?: 'always' | 'never' | 'interval';
  retrigger_days?: number;
}

interface RuleFormData {
  name: string;
  description: string;
  is_active: boolean;
  trigger_type: string;
  trigger_params: Record<string, any>;
  condition_groups: ConditionGroup[];
  group_logic: 'and' | 'or';
  product_id: string;
  target_type: 'client' | 'contact';
  actions: ActionConfig[];
  schedule_config: ScheduleConfig;
}

const genId = () => crypto.randomUUID();

const EMPTY_FORM: RuleFormData = {
  name: '',
  description: '',
  is_active: true,
  trigger_type: '',
  trigger_params: {},
  condition_groups: [{ id: genId(), logic: 'and', conditions: [] }],
  group_logic: 'and',
  product_id: '',
  target_type: 'client',
  actions: [],
  schedule_config: { frequency: 'once', stop_type: 'never', retrigger: 'always' },
};

const ACTION_TYPES = [
  { value: 'create_activity', label: 'Criar Atividade' },
  { value: 'send_notification', label: 'Enviar Notificação' },
  { value: 'send_email', label: 'Enviar Email' },
  { value: 'move_journey_stage', label: 'Mover Etapa da Jornada' },
  { value: 'change_status', label: 'Alterar Status' },
  { value: 'create_action_plan', label: 'Criar Plano de Ação' },
];

const FREQUENCY_OPTIONS = [
  { value: 'once', label: '1 única vez' },
  { value: 'daily', label: 'Todos os dias' },
  { value: 'weekly', label: 'Toda semana' },
  { value: 'monthly', label: 'Todo mês' },
  { value: 'last_day_month', label: 'Último dia do mês' },
];

// ─── Main Component ──────────────────────────────────────────
export function AutomationRulesTab() {
  const { user } = useAuth();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

  // Reference data
  const [products, setProducts] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [csms, setCsms] = useState<any[]>([]);
  const [formTemplates, setFormTemplates] = useState<any[]>([]);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('automation_rules_v2' as any).select('*').order('created_at', { ascending: false });
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
    setForm({ ...EMPTY_FORM, condition_groups: [{ id: genId(), logic: 'and', conditions: [] }] });
    setActiveStep(1);
    setEditorOpen(true);
  };

  const openEdit = (rule: any) => {
    setEditingId(rule.id);
    // Parse legacy flat conditions to groups
    let groups: ConditionGroup[] = [];
    const rawConditions = rule.conditions;
    if (rawConditions?.groups) {
      groups = rawConditions.groups.map((g: any) => ({ ...g, id: g.id || genId() }));
    } else if (Array.isArray(rawConditions) && rawConditions.length > 0) {
      groups = [{ id: genId(), logic: rule.condition_logic || 'and', conditions: rawConditions }];
    } else {
      groups = [{ id: genId(), logic: 'and', conditions: [] }];
    }

    const actions: ActionConfig[] = Array.isArray(rule.actions) ? rule.actions.map((a: any) => ({ ...a, id: a.id || genId() })) : [];

    setForm({
      name: rule.name,
      description: rule.description || '',
      is_active: rule.is_active,
      trigger_type: rule.trigger_type,
      trigger_params: rule.trigger_params || {},
      condition_groups: groups,
      group_logic: rawConditions?.logic || rule.condition_logic || 'and',
      product_id: rule.product_id || '',
      target_type: (rule as any).target_type || 'client',
      actions,
      schedule_config: (rule as any).schedule_config || { frequency: 'once', stop_type: 'never', retrigger: 'always' },
    });
    setActiveStep(1);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.trigger_type) {
      toast.error('Nome e trigger são obrigatórios');
      return;
    }
    setSaving(true);

    const conditionsPayload = {
      logic: form.group_logic,
      groups: form.condition_groups.map(g => ({
        id: g.id,
        logic: g.logic,
        conditions: g.conditions,
      })),
    };

    const payload: any = {
      name: form.name,
      description: form.description || null,
      is_active: form.is_active,
      trigger_type: form.trigger_type,
      trigger_params: form.trigger_params,
      conditions: conditionsPayload,
      condition_logic: form.group_logic,
      actions: form.actions,
      product_id: form.product_id || null,
      target_type: form.target_type,
      schedule_config: form.schedule_config,
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
    setEditorOpen(false);
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

  // ─── Condition Group helpers ─────────────────────────────────
  const addGroup = () => {
    setForm(f => ({
      ...f,
      condition_groups: [...f.condition_groups, { id: genId(), logic: 'and', conditions: [] }],
    }));
  };

  const duplicateGroup = (groupId: string) => {
    setForm(f => {
      const src = f.condition_groups.find(g => g.id === groupId);
      if (!src) return f;
      return {
        ...f,
        condition_groups: [...f.condition_groups, { id: genId(), logic: src.logic, conditions: [...src.conditions.map(c => ({ ...c }))] }],
      };
    });
  };

  const removeGroup = (groupId: string) => {
    setForm(f => ({
      ...f,
      condition_groups: f.condition_groups.filter(g => g.id !== groupId),
    }));
  };

  const updateGroupLogic = (groupId: string, logic: 'and' | 'or') => {
    setForm(f => ({
      ...f,
      condition_groups: f.condition_groups.map(g => g.id === groupId ? { ...g, logic } : g),
    }));
  };

  const addConditionToGroup = (groupId: string) => {
    setForm(f => ({
      ...f,
      condition_groups: f.condition_groups.map(g =>
        g.id === groupId ? { ...g, conditions: [...g.conditions, { field: '', operator: '', value: '' }] } : g
      ),
    }));
  };

  const updateConditionInGroup = (groupId: string, idx: number, patch: Partial<Condition>) => {
    setForm(f => ({
      ...f,
      condition_groups: f.condition_groups.map(g => {
        if (g.id !== groupId) return g;
        const conds = [...g.conditions];
        conds[idx] = { ...conds[idx], ...patch };
        if (patch.field) { conds[idx].operator = ''; conds[idx].value = ''; conds[idx].value2 = undefined; }
        return { ...g, conditions: conds };
      }),
    }));
  };

  const removeConditionFromGroup = (groupId: string, idx: number) => {
    setForm(f => ({
      ...f,
      condition_groups: f.condition_groups.map(g =>
        g.id === groupId ? { ...g, conditions: g.conditions.filter((_, i) => i !== idx) } : g
      ),
    }));
  };

  const copyConditionInGroup = (groupId: string, idx: number) => {
    setForm(f => ({
      ...f,
      condition_groups: f.condition_groups.map(g => {
        if (g.id !== groupId) return g;
        const conds = [...g.conditions];
        conds.splice(idx + 1, 0, { ...conds[idx] });
        return { ...g, conditions: conds };
      }),
    }));
  };

  // ─── Action helpers ──────────────────────────────────────────
  const addAction = () => {
    setForm(f => ({ ...f, actions: [...f.actions, { id: genId(), type: '', config: {} }] }));
  };

  const updateAction = (id: string, patch: Partial<ActionConfig>) => {
    setForm(f => ({
      ...f,
      actions: f.actions.map(a => a.id === id ? { ...a, ...patch } : a),
    }));
  };

  const removeAction = (id: string) => {
    setForm(f => ({ ...f, actions: f.actions.filter(a => a.id !== id) }));
  };

  // ─── Render helpers ────────────────────────────────────────
  const triggerDef = TRIGGERS.find(t => t.value === form.trigger_type);

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

  const renderConditionValue = (cond: Condition, groupId: string, idx: number) => {
    const fieldDef = CONDITION_FIELDS.find(f => f.value === cond.field);
    if (!fieldDef) return null;
    if (['is_empty', 'is_not_empty'].includes(cond.operator)) return null;

    if (fieldDef.options) {
      if (cond.operator === 'is_in') {
        return <Input placeholder="Valores separados por vírgula" value={cond.value || ''} onChange={e => updateConditionInGroup(groupId, idx, { value: e.target.value })} className="flex-1" />;
      }
      return (
        <Select value={cond.value || ''} onValueChange={v => updateConditionInGroup(groupId, idx, { value: v })}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Valor" /></SelectTrigger>
          <SelectContent>{fieldDef.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      );
    }
    if (fieldDef.value === 'product_id') {
      return (
        <Select value={cond.value || ''} onValueChange={v => updateConditionInGroup(groupId, idx, { value: v })}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Produto" /></SelectTrigger>
          <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      );
    }
    if (fieldDef.value === 'csm_id') {
      return (
        <Select value={cond.value || ''} onValueChange={v => updateConditionInGroup(groupId, idx, { value: v })}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="CSM" /></SelectTrigger>
          <SelectContent>{csms.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name || 'Sem nome'}</SelectItem>)}</SelectContent>
        </Select>
      );
    }
    if (fieldDef.value === 'journey_stage_id') {
      return (
        <Select value={cond.value || ''} onValueChange={v => updateConditionInGroup(groupId, idx, { value: v })}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      );
    }

    const hasSuffix = !!fieldDef.suffix;
    if (cond.operator === 'between') {
      return (
        <div className="flex gap-2 flex-1 items-center">
          <Input type="number" placeholder="De" value={cond.value || ''} onChange={e => updateConditionInGroup(groupId, idx, { value: e.target.value })} />
          <Input type="number" placeholder="Até" value={cond.value2 || ''} onChange={e => updateConditionInGroup(groupId, idx, { value2: e.target.value })} />
          {hasSuffix && <span className="text-xs text-muted-foreground whitespace-nowrap">{fieldDef.suffix}</span>}
        </div>
      );
    }

    return (
      <div className="flex gap-2 flex-1 items-center">
        <Input type={fieldDef.type === 'number' ? 'number' : 'text'} placeholder="Valor" value={cond.value || ''} onChange={e => updateConditionInGroup(groupId, idx, { value: e.target.value })} className="flex-1" />
        {hasSuffix && <span className="text-xs text-muted-foreground whitespace-nowrap">{fieldDef.suffix}</span>}
      </div>
    );
  };

  const renderActionConfig = (action: ActionConfig) => {
    const updateConfig = (patch: Record<string, any>) => {
      updateAction(action.id, { config: { ...action.config, ...patch } });
    };

    switch (action.type) {
      case 'create_activity':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1"><Label className="text-xs">Título da atividade *</Label><Input value={action.config.title || ''} onChange={e => updateConfig({ title: e.target.value })} placeholder="Ex: Ligar para cliente" /></div>
            <div className="col-span-2 space-y-1"><Label className="text-xs">Descrição / Instruções</Label><Textarea value={action.config.description || ''} onChange={e => updateConfig({ description: e.target.value })} rows={2} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Prioridade</Label>
              <Select value={action.config.priority || 'medium'} onValueChange={v => updateConfig({ priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prazo (dias após trigger)</Label>
              <Input type="number" value={action.config.due_days || ''} onChange={e => updateConfig({ due_days: e.target.value })} placeholder="Ex: 3" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Responsável</Label>
              <Select value={action.config.assignee || 'csm_do_cliente'} onValueChange={v => updateConfig({ assignee: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csm_do_cliente">CSM do cliente</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  {csms.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name || 'Sem nome'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={action.config.activity_type || 'task'} onValueChange={v => updateConfig({ activity_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Tarefa</SelectItem>
                  <SelectItem value="call">Ligação</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Reunião</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'send_notification':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Destinatário</Label>
              <Select value={action.config.recipient || 'csm'} onValueChange={v => updateConfig({ recipient: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csm">CSM do cliente</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Título</Label><Input value={action.config.title || ''} onChange={e => updateConfig({ title: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Mensagem</Label><Textarea value={action.config.message || ''} onChange={e => updateConfig({ message: e.target.value })} rows={2} /></div>
          </div>
        );

      case 'send_email':
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Destinatário</Label>
              <Select value={action.config.recipient || 'csm'} onValueChange={v => updateConfig({ recipient: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csm">CSM do cliente</SelectItem>
                  <SelectItem value="cliente">Email do escritório</SelectItem>
                  <SelectItem value="contato_principal">Contato principal</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Assunto</Label><Input value={action.config.subject || ''} onChange={e => updateConfig({ subject: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Corpo</Label><Textarea value={action.config.body || ''} onChange={e => updateConfig({ body: e.target.value })} rows={3} /></div>
          </div>
        );

      case 'move_journey_stage':
        return (
          <div className="space-y-1">
            <Label className="text-xs">Etapa destino</Label>
            <Select value={action.config.stage_id || ''} onValueChange={v => updateConfig({ stage_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
              <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        );

      case 'change_status':
        return (
          <div className="space-y-1">
            <Label className="text-xs">Novo status</Label>
            <Select value={action.config.new_status || ''} onValueChange={v => updateConfig({ new_status: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
              <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        );

      case 'create_action_plan':
        return (
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Título</Label><Input value={action.config.title || ''} onChange={e => updateConfig({ title: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Descrição</Label><Textarea value={action.config.description || ''} onChange={e => updateConfig({ description: e.target.value })} rows={2} /></div>
            <div className="space-y-1"><Label className="text-xs">Prazo (dias)</Label><Input type="number" value={action.config.due_days || ''} onChange={e => updateConfig({ due_days: e.target.value })} /></div>
          </div>
        );

      default:
        return <p className="text-xs text-muted-foreground">Selecione o tipo de ação acima.</p>;
    }
  };

  // ─── Loading state ─────────────────────────────────────────
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const getTriggerLabel = (type: string) => TRIGGERS.find(t => t.value === type)?.label || type;
  const getTriggerTiming = (type: string) => TRIGGERS.find(t => t.value === type)?.timing;

  const countConditions = (rule: any) => {
    const conds = rule.conditions;
    if (conds?.groups) return conds.groups.reduce((acc: number, g: any) => acc + (g.conditions?.length || 0), 0);
    if (Array.isArray(conds)) return conds.length;
    return 0;
  };

  const steps = [
    { num: 1, label: 'Informações' },
    { num: 2, label: 'Condições' },
    { num: 3, label: 'Agendamento' },
    { num: 4, label: 'Ações' },
  ];

  // ─── List View ─────────────────────────────────────────────
  if (!editorOpen) {
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
                  <TableHead>Ações</TableHead>
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
                    <TableCell className="text-muted-foreground text-sm">{countConditions(r)} condição(ões)</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{Array.isArray(r.actions) ? r.actions.length : 0} ação(ões)</TableCell>
                    <TableCell><Switch checked={r.is_active} onCheckedChange={() => toggleActive(r.id, r.is_active)} /></TableCell>
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
      </div>
    );
  }

  // ─── Editor View (4-Step) ──────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setEditorOpen(false)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold">{editingId ? 'Editar Regra' : 'Nova Regra de Automação'}</h2>
      </div>

      {/* Step Navigation */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
        {steps.map(s => (
          <button
            key={s.num}
            onClick={() => setActiveStep(s.num)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${activeStep === s.num ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${activeStep === s.num ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20'}`}>{s.num}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Step 1: Informações */}
      {activeStep === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">1. Informações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da regra *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Notificar CSM quando health cair" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                  <span className="text-sm">{form.is_active ? 'Ativa' : 'Inativa'}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Descrição opcional..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Produto (escopo)</Label>
                <Select value={form.product_id} onValueChange={v => setForm(f => ({ ...f, product_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Todos os produtos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os produtos</SelectItem>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Atingir</Label>
                <Select value={form.target_type} onValueChange={(v: 'client' | 'contact') => setForm(f => ({ ...f, target_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Cliente</SelectItem>
                    <SelectItem value="contact">Contato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Trigger (SE)</Label>
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
                            <span className="text-[10px] text-muted-foreground">({t.timing === 'cron' ? 'Cron' : 'Tempo real'})</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {triggerDef?.params && triggerDef.params.length > 0 && (
                <div className="grid grid-cols-2 gap-3 pl-3 border-l-2 border-primary/20">
                  {triggerDef.params.map(p => renderTriggerParam(p))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Condições (Groups) */}
      {activeStep === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">2. Condições</CardTitle>
              {form.condition_groups.length > 1 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Lógica entre grupos:</span>
                  <Select value={form.group_logic} onValueChange={(v: 'and' | 'or') => setForm(f => ({ ...f, group_logic: v }))}>
                    <SelectTrigger className="h-7 w-[80px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="and">E (AND)</SelectItem>
                      <SelectItem value="or">OU (OR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {form.condition_groups.map((group, gIdx) => (
              <div key={group.id}>
                {gIdx > 0 && (
                  <div className="flex justify-center py-2">
                    <Badge variant="secondary" className="text-xs">{form.group_logic === 'and' ? 'E' : 'OU'}</Badge>
                  </div>
                )}
                <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">Grupo {String.fromCharCode(65 + gIdx)}</h4>
                      {group.conditions.length > 1 && (
                        <Select value={group.logic} onValueChange={(v: 'and' | 'or') => updateGroupLogic(group.id, v)}>
                          <SelectTrigger className="h-6 w-[70px] text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="and">E (AND)</SelectItem>
                            <SelectItem value="or">OU (OR)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => duplicateGroup(group.id)}>
                        <Copy className="h-3 w-3 mr-1" />Duplicar
                      </Button>
                      {form.condition_groups.length > 1 && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => removeGroup(group.id)}>
                          <Trash2 className="h-3 w-3 mr-1" />Excluir
                        </Button>
                      )}
                    </div>
                  </div>

                  {group.conditions.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma condição neste grupo.</p>
                  )}

                  {group.conditions.map((cond, idx) => {
                    const fieldDef = CONDITION_FIELDS.find(f => f.value === cond.field);
                    return (
                      <div key={idx}>
                        {idx > 0 && (
                          <div className="flex justify-center py-1">
                            <Badge variant="outline" className="text-[10px]">{group.logic === 'and' ? 'E' : 'OU'}</Badge>
                          </div>
                        )}
                        <div className="flex items-start gap-2 bg-background rounded-lg p-2 border border-border/50">
                          <Select value={cond.field} onValueChange={v => updateConditionInGroup(group.id, idx, { field: v })}>
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
                          {fieldDef && (
                            <Select value={cond.operator} onValueChange={v => updateConditionInGroup(group.id, idx, { operator: v })}>
                              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Operador" /></SelectTrigger>
                              <SelectContent>{fieldDef.operators.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                          )}
                          {fieldDef && cond.operator && renderConditionValue(cond, group.id, idx)}
                          <div className="flex gap-0.5 flex-shrink-0">
                            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => copyConditionInGroup(group.id, idx)}><Copy className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => removeConditionFromGroup(group.id, idx)}><X className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <Button variant="outline" size="sm" onClick={() => addConditionToGroup(group.id)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />Adicionar condição
                  </Button>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addGroup}>
              <Plus className="mr-1 h-3.5 w-3.5" />Adicionar Grupo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Agendamento e Recorrência */}
      {activeStep === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-base">3. Agendamento e Recorrência</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.schedule_config.start_date ? format(new Date(form.schedule_config.start_date), 'dd/MM/yyyy') : 'Hoje'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={form.schedule_config.start_date ? new Date(form.schedule_config.start_date) : undefined}
                      onSelect={d => setForm(f => ({ ...f, schedule_config: { ...f.schedule_config, start_date: d?.toISOString() } }))}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Executar regra</Label>
                <Select value={form.schedule_config.frequency || 'once'} onValueChange={v => setForm(f => ({ ...f, schedule_config: { ...f.schedule_config, frequency: v } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQUENCY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Parar execução</Label>
              <RadioGroup
                value={form.schedule_config.stop_type || 'never'}
                onValueChange={v => setForm(f => ({ ...f, schedule_config: { ...f.schedule_config, stop_type: v as any } }))}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="never" id="stop-never" /><Label htmlFor="stop-never" className="font-normal">Nunca</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="on_date" id="stop-date" /><Label htmlFor="stop-date" className="font-normal">Em uma data específica</Label>
                  {form.schedule_config.stop_type === 'on_date' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="ml-2">
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {form.schedule_config.stop_date ? format(new Date(form.schedule_config.stop_date), 'dd/MM/yyyy') : 'Selecionar'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={form.schedule_config.stop_date ? new Date(form.schedule_config.stop_date) : undefined}
                          onSelect={d => setForm(f => ({ ...f, schedule_config: { ...f.schedule_config, stop_date: d?.toISOString() } }))}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="after_count" id="stop-count" /><Label htmlFor="stop-count" className="font-normal">Após</Label>
                  {form.schedule_config.stop_type === 'after_count' && (
                    <div className="flex items-center gap-2 ml-2">
                      <Input type="number" className="w-20 h-8" value={form.schedule_config.stop_count || ''} onChange={e => setForm(f => ({ ...f, schedule_config: { ...f.schedule_config, stop_count: Number(e.target.value) } }))} />
                      <span className="text-sm text-muted-foreground">ocorrências</span>
                    </div>
                  )}
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Atingir novamente o mesmo cliente</Label>
              <Select
                value={form.schedule_config.retrigger || 'always'}
                onValueChange={v => setForm(f => ({ ...f, schedule_config: { ...f.schedule_config, retrigger: v as any } }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">Sempre</SelectItem>
                  <SelectItem value="never">Nunca</SelectItem>
                  <SelectItem value="interval">A cada intervalo de X dias</SelectItem>
                </SelectContent>
              </Select>
              {form.schedule_config.retrigger === 'interval' && (
                <div className="flex items-center gap-2">
                  <Input type="number" className="w-24" value={form.schedule_config.retrigger_days || ''} onChange={e => setForm(f => ({ ...f, schedule_config: { ...f.schedule_config, retrigger_days: Number(e.target.value) } }))} placeholder="Dias" />
                  <span className="text-sm text-muted-foreground">dias</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Ações */}
      {activeStep === 4 && (
        <Card>
          <CardHeader><CardTitle className="text-base">4. Ações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {form.actions.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma ação configurada. Adicione pelo menos uma ação.</p>
            )}

            {form.actions.map((action, aIdx) => (
              <div key={action.id} className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Ação {aIdx + 1}</h4>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => removeAction(action.id)}>
                    <Trash2 className="h-3 w-3 mr-1" />Remover
                  </Button>
                </div>
                <Select value={action.type} onValueChange={v => updateAction(action.id, { type: v, config: {} })}>
                  <SelectTrigger><SelectValue placeholder="Tipo de ação" /></SelectTrigger>
                  <SelectContent>{ACTION_TYPES.map(at => <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>)}</SelectContent>
                </Select>
                {action.type && renderActionConfig(action)}
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addAction}>
              <Plus className="mr-1 h-3.5 w-3.5" />Adicionar Ação
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center pt-2 border-t border-border">
        <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button>
        <div className="flex items-center gap-2">
          {activeStep > 1 && <Button variant="outline" onClick={() => setActiveStep(s => s - 1)}>Anterior</Button>}
          {activeStep < 4 && <Button onClick={() => setActiveStep(s => s + 1)}>Próximo</Button>}
          {activeStep === 4 && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Atualizar Regra' : 'Criar Regra'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
