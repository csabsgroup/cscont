import { useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  Library, Wrench, Plus, Trash2, Save, Pin, BarChart3, TrendingUp, Heart,
  Users, DollarSign, Route, AlertTriangle, ArrowUpRight, X,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { differenceInDays, subMonths, subDays, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, format } from 'date-fns';

// ─── Types ───
interface IndicatorConfig {
  source: string;
  metric: string;
  metric_field: string | null;
  filters: { field: string; operator: string; value: string }[];
  group_by: string;
  period: string;
  custom_period?: { start: string; end: string } | null;
}

interface SavedIndicator {
  id: string;
  name: string;
  description: string | null;
  config: IndicatorConfig;
  visualization_type: string;
  is_predefined: boolean;
  pinned_to_dashboard: boolean;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  product_filter: string | null;
  created_at: string;
}

// ─── Constants ───
const SOURCES: { value: string; label: string }[] = [
  { value: 'offices', label: 'Escritórios' },
  { value: 'contracts', label: 'Contratos' },
  { value: 'activities', label: 'Atividades' },
  { value: 'meetings', label: 'Reuniões' },
  { value: 'health_scores', label: 'Health Score' },
  { value: 'office_metrics_history', label: 'Métricas Históricas' },
  { value: 'form_submissions', label: 'Formulários' },
  { value: 'events', label: 'Eventos' },
  { value: 'bonus_grants', label: 'Bônus' },
];

const NUMERIC_FIELDS: Record<string, { value: string; label: string }[]> = {
  offices: [
    { value: 'mrr', label: 'MRR' },
    { value: 'last_nps', label: 'NPS' },
    { value: 'last_csat', label: 'CSAT' },
    { value: 'faturamento_mensal', label: 'Faturamento Mensal' },
    { value: 'faturamento_anual', label: 'Faturamento Anual' },
    { value: 'qtd_clientes', label: 'Qtd Clientes' },
    { value: 'qtd_colaboradores', label: 'Qtd Colaboradores' },
  ],
  contracts: [
    { value: 'value', label: 'Valor Total' },
    { value: 'monthly_value', label: 'Valor Mensal' },
    { value: 'installments_total', label: 'Parcelas Totais' },
    { value: 'installments_overdue', label: 'Parcelas Vencidas' },
  ],
  activities: [],
  meetings: [],
  health_scores: [{ value: 'score', label: 'Score' }],
  office_metrics_history: [
    { value: 'faturamento_mensal', label: 'Faturamento Mensal' },
    { value: 'faturamento_anual', label: 'Faturamento Anual' },
    { value: 'qtd_clientes', label: 'Qtd Clientes' },
    { value: 'qtd_colaboradores', label: 'Qtd Colaboradores' },
    { value: 'nps_score', label: 'NPS' },
    { value: 'csat_score', label: 'CSAT' },
    { value: 'health_score', label: 'Health Score' },
  ],
  form_submissions: [],
  events: [],
  bonus_grants: [
    { value: 'quantity', label: 'Quantidade' },
    { value: 'used', label: 'Usados' },
    { value: 'available', label: 'Disponíveis' },
  ],
};

const METRICS = [
  { value: 'count', label: 'Contagem (COUNT)' },
  { value: 'sum', label: 'Soma (SUM)' },
  { value: 'avg', label: 'Média (AVG)' },
  { value: 'min', label: 'Mínimo (MIN)' },
  { value: 'max', label: 'Máximo (MAX)' },
  { value: 'percentage', label: 'Porcentagem (%)' },
];

const GROUP_BY_OPTIONS = [
  { value: 'none', label: 'Nenhum' },
  { value: 'product', label: 'Produto' },
  { value: 'csm', label: 'CSM' },
  { value: 'status', label: 'Status' },
  { value: 'month', label: 'Mês' },
  { value: 'stage', label: 'Etapa da Jornada' },
];

const PERIOD_OPTIONS = [
  { value: 'last_30', label: 'Últimos 30 dias' },
  { value: 'last_60', label: 'Últimos 60 dias' },
  { value: 'last_90', label: 'Últimos 90 dias' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês anterior' },
  { value: 'this_quarter', label: 'Este trimestre' },
  { value: 'this_year', label: 'Este ano' },
  { value: 'all', label: 'Todo o período' },
];

const VIZ_OPTIONS = [
  { value: 'number', label: 'Número', icon: '🔢' },
  { value: 'line', label: 'Linha', icon: '📈' },
  { value: 'bar', label: 'Barra', icon: '📊' },
  { value: 'pie', label: 'Pizza', icon: '🥧' },
  { value: 'table', label: 'Tabela', icon: '📋' },
];

const OPERATORS = [
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'contains', label: 'Contém' },
  { value: 'gt', label: 'Maior que' },
  { value: 'lt', label: 'Menor que' },
  { value: 'gte', label: 'Maior ou igual' },
  { value: 'lte', label: 'Menor ou igual' },
  { value: 'is_null', label: 'É vazio' },
  { value: 'is_not_null', label: 'Não é vazio' },
];

const CHART_COLORS = [
  'hsl(var(--primary))', 'hsl(142.1,76.2%,36.3%)', 'hsl(45.4,93.4%,47.5%)',
  'hsl(200,70%,50%)', 'hsl(280,60%,55%)', 'hsl(20,80%,55%)',
];

// ─── Predefined metrics library ───
interface PredefinedMetric {
  id: string;
  name: string;
  category: string;
  config: Partial<IndicatorConfig>;
  defaultViz: string;
}

const PREDEFINED_CATEGORIES = [
  { key: 'retention', label: 'Retenção & Churn', icon: TrendingUp },
  { key: 'revenue', label: 'Receita', icon: DollarSign },
  { key: 'engagement', label: 'Engajamento', icon: Users },
  { key: 'satisfaction', label: 'Satisfação', icon: Heart },
  { key: 'health', label: 'Saúde', icon: Heart },
  { key: 'journey', label: 'Jornada', icon: Route },
  { key: 'financial', label: 'Financeiro', icon: AlertTriangle },
  { key: 'growth', label: 'Crescimento do Cliente', icon: ArrowUpRight },
];

const PREDEFINED_METRICS: PredefinedMetric[] = [
  // Retenção & Churn
  { id: 'churn_rate_monthly', name: 'Taxa de Churn mensal (%)', category: 'retention', config: { source: 'offices', metric: 'percentage', filters: [{ field: 'status', operator: 'equals', value: 'churn' }] }, defaultViz: 'number' },
  { id: 'churn_by_product', name: 'Taxa de Churn por produto', category: 'retention', config: { source: 'offices', metric: 'percentage', group_by: 'product', filters: [{ field: 'status', operator: 'equals', value: 'churn' }] }, defaultViz: 'bar' },
  { id: 'churn_by_reason', name: 'Churn por motivo (breakdown)', category: 'retention', config: { source: 'offices', metric: 'count', group_by: 'status', filters: [{ field: 'status', operator: 'equals', value: 'churn' }] }, defaultViz: 'pie' },
  { id: 'retention_rate', name: 'Taxa de Retenção (%)', category: 'retention', config: { source: 'offices', metric: 'percentage', filters: [{ field: 'status', operator: 'equals', value: 'ativo' }] }, defaultViz: 'number' },
  { id: 'nrr', name: 'Net Revenue Retention (NRR)', category: 'retention', config: { source: 'offices', metric: 'sum', metric_field: 'mrr' }, defaultViz: 'number' },
  { id: 'grr', name: 'Gross Revenue Retention (GRR)', category: 'retention', config: { source: 'offices', metric: 'sum', metric_field: 'mrr' }, defaultViz: 'number' },
  { id: 'avg_time_to_churn', name: 'Tempo médio até churn (dias)', category: 'retention', config: { source: 'offices', metric: 'count', filters: [{ field: 'status', operator: 'equals', value: 'churn' }] }, defaultViz: 'number' },
  { id: 'at_risk_clients', name: 'Clientes em risco de churn', category: 'retention', config: { source: 'health_scores', metric: 'count', filters: [{ field: 'band', operator: 'equals', value: 'red' }] }, defaultViz: 'number' },
  // Receita
  { id: 'mrr_total', name: 'MRR Total', category: 'revenue', config: { source: 'offices', metric: 'sum', metric_field: 'mrr', filters: [{ field: 'status', operator: 'equals', value: 'ativo' }] }, defaultViz: 'number' },
  { id: 'mrr_by_product', name: 'MRR por produto', category: 'revenue', config: { source: 'offices', metric: 'sum', metric_field: 'mrr', group_by: 'product' }, defaultViz: 'bar' },
  { id: 'mrr_variation', name: 'Variação MRR mensal', category: 'revenue', config: { source: 'offices', metric: 'sum', metric_field: 'mrr', group_by: 'month' }, defaultViz: 'line' },
  { id: 'net_new_mrr', name: 'Net New MRR (novo - churn)', category: 'revenue', config: { source: 'offices', metric: 'sum', metric_field: 'mrr' }, defaultViz: 'number' },
  { id: 'expansion_mrr', name: 'Expansion MRR (upsell)', category: 'revenue', config: { source: 'offices', metric: 'sum', metric_field: 'mrr', filters: [{ field: 'status', operator: 'equals', value: 'upsell' }] }, defaultViz: 'number' },
  { id: 'contraction_mrr', name: 'Contraction MRR (downgrade)', category: 'revenue', config: { source: 'offices', metric: 'sum', metric_field: 'mrr' }, defaultViz: 'number' },
  { id: 'avg_ltv', name: 'LTV médio por produto', category: 'revenue', config: { source: 'contracts', metric: 'avg', metric_field: 'value', group_by: 'product' }, defaultViz: 'bar' },
  { id: 'arpu', name: 'ARPU (receita média por cliente)', category: 'revenue', config: { source: 'offices', metric: 'avg', metric_field: 'mrr', filters: [{ field: 'status', operator: 'equals', value: 'ativo' }] }, defaultViz: 'number' },
  // Engajamento
  { id: 'meeting_coverage', name: 'Cobertura de reuniões (%)', category: 'engagement', config: { source: 'meetings', metric: 'percentage' }, defaultViz: 'number' },
  { id: 'avg_days_no_meeting', name: 'Dias médios sem reunião', category: 'engagement', config: { source: 'meetings', metric: 'avg' }, defaultViz: 'number' },
  { id: 'activities_per_csm', name: 'Atividades por CSM', category: 'engagement', config: { source: 'activities', metric: 'count', group_by: 'csm' }, defaultViz: 'bar' },
  { id: 'overdue_activities_csm', name: 'Atividades atrasadas por CSM', category: 'engagement', config: { source: 'activities', metric: 'count', group_by: 'csm' }, defaultViz: 'bar' },
  { id: 'forms_filled', name: 'Formulários preenchidos por período', category: 'engagement', config: { source: 'form_submissions', metric: 'count', group_by: 'month' }, defaultViz: 'line' },
  { id: 'event_participation', name: 'Participação em eventos (%)', category: 'engagement', config: { source: 'events', metric: 'percentage' }, defaultViz: 'number' },
  // Satisfação
  { id: 'avg_nps', name: 'NPS médio (global e por produto)', category: 'satisfaction', config: { source: 'offices', metric: 'avg', metric_field: 'last_nps' }, defaultViz: 'number' },
  { id: 'avg_csat', name: 'CSAT médio', category: 'satisfaction', config: { source: 'offices', metric: 'avg', metric_field: 'last_csat' }, defaultViz: 'number' },
  { id: 'nps_by_csm', name: 'NPS por CSM', category: 'satisfaction', config: { source: 'offices', metric: 'avg', metric_field: 'last_nps', group_by: 'csm' }, defaultViz: 'bar' },
  { id: 'nps_distribution', name: '% Promotores / Neutros / Detratores', category: 'satisfaction', config: { source: 'offices', metric: 'count', group_by: 'status' }, defaultViz: 'pie' },
  { id: 'nps_evolution', name: 'Evolução NPS trimestral', category: 'satisfaction', config: { source: 'office_metrics_history', metric: 'avg', metric_field: 'nps_score', group_by: 'month' }, defaultViz: 'line' },
  // Saúde
  { id: 'health_distribution', name: 'Distribuição Health Score', category: 'health', config: { source: 'health_scores', metric: 'count', group_by: 'status' }, defaultViz: 'pie' },
  { id: 'health_by_product', name: 'Health médio por produto', category: 'health', config: { source: 'health_scores', metric: 'avg', metric_field: 'score', group_by: 'product' }, defaultViz: 'bar' },
  { id: 'health_by_csm', name: 'Health médio por CSM', category: 'health', config: { source: 'health_scores', metric: 'avg', metric_field: 'score', group_by: 'csm' }, defaultViz: 'bar' },
  { id: 'health_evolution', name: 'Evolução Health mensal', category: 'health', config: { source: 'office_metrics_history', metric: 'avg', metric_field: 'health_score', group_by: 'month' }, defaultViz: 'line' },
  { id: 'health_band_changes', name: 'Clientes que melhoraram/pioraram', category: 'health', config: { source: 'health_scores', metric: 'count' }, defaultViz: 'bar' },
  // Jornada
  { id: 'avg_time_per_stage', name: 'Tempo médio por etapa', category: 'journey', config: { source: 'offices', metric: 'avg', group_by: 'stage' }, defaultViz: 'bar' },
  { id: 'stage_distribution', name: 'Distribuição por etapa (funil)', category: 'journey', config: { source: 'offices', metric: 'count', group_by: 'stage' }, defaultViz: 'bar' },
  { id: 'stage_advance_rate', name: 'Taxa de avanço entre etapas', category: 'journey', config: { source: 'offices', metric: 'percentage', group_by: 'stage' }, defaultViz: 'bar' },
  { id: 'stagnant_clients', name: 'Clientes estagnados (X dias na mesma etapa)', category: 'journey', config: { source: 'offices', metric: 'count' }, defaultViz: 'table' },
  // Financeiro
  { id: 'total_overdue', name: 'Inadimplência total (R$ e %)', category: 'financial', config: { source: 'contracts', metric: 'sum', metric_field: 'installments_overdue' }, defaultViz: 'number' },
  { id: 'overdue_by_product', name: 'Inadimplência por produto', category: 'financial', config: { source: 'contracts', metric: 'sum', metric_field: 'installments_overdue', group_by: 'product' }, defaultViz: 'bar' },
  { id: 'avg_contract_value', name: 'Valor médio de contrato por produto', category: 'financial', config: { source: 'contracts', metric: 'avg', metric_field: 'value', group_by: 'product' }, defaultViz: 'bar' },
  { id: 'renewal_forecast', name: 'Previsão de renovação (30/60/90 dias)', category: 'financial', config: { source: 'contracts', metric: 'count' }, defaultViz: 'table' },
  // Crescimento
  { id: 'revenue_evolution', name: 'Evolução de faturamento médio', category: 'growth', config: { source: 'office_metrics_history', metric: 'avg', metric_field: 'faturamento_mensal', group_by: 'month' }, defaultViz: 'line' },
  { id: 'clients_evolution', name: 'Evolução de clientes ativos médio', category: 'growth', config: { source: 'office_metrics_history', metric: 'avg', metric_field: 'qtd_clientes', group_by: 'month' }, defaultViz: 'line' },
  { id: 'employees_evolution', name: 'Evolução de colaboradores médio', category: 'growth', config: { source: 'office_metrics_history', metric: 'avg', metric_field: 'qtd_colaboradores', group_by: 'month' }, defaultViz: 'line' },
];

// ─── Helper: compute indicator from data ───
function computeIndicator(
  config: IndicatorConfig,
  data: {
    offices: any[];
    contracts: any[];
    activities: any[];
    meetings: any[];
    healthScores: any[];
    metricsHistory: any[];
    formSubmissions: any[];
    events: any[];
    bonusGrants: any[];
    products: any[];
    csmUsers: any[];
    profileMap: Map<string, string>;
  }
): { value: number | string; chartData: any[]; tableData: any[] } {
  const sourceData = getSourceData(config.source, data);
  const filtered = applyFilters(sourceData, config.filters || []);

  if (config.group_by && config.group_by !== 'none') {
    const groups = groupData(filtered, config.group_by, data);
    const chartData = Object.entries(groups).map(([name, items]) => ({
      name,
      value: computeMetricValue(items as any[], config.metric, config.metric_field),
    }));
    return { value: chartData.reduce((s, d) => s + (typeof d.value === 'number' ? d.value : 0), 0), chartData, tableData: chartData };
  }

  const value = computeMetricValue(filtered, config.metric, config.metric_field);
  return { value, chartData: [], tableData: [] };
}

function getSourceData(source: string, data: any): any[] {
  switch (source) {
    case 'offices': return data.offices;
    case 'contracts': return data.contracts;
    case 'activities': return data.activities;
    case 'meetings': return data.meetings;
    case 'health_scores': return data.healthScores;
    case 'office_metrics_history': return data.metricsHistory;
    case 'form_submissions': return data.formSubmissions;
    case 'events': return data.events;
    case 'bonus_grants': return data.bonusGrants;
    default: return [];
  }
}

function applyFilters(data: any[], filters: IndicatorConfig['filters']): any[] {
  return data.filter(item => {
    return filters.every(f => {
      const val = item[f.field];
      switch (f.operator) {
        case 'equals': return String(val) === f.value;
        case 'not_equals': return String(val) !== f.value;
        case 'contains': return String(val || '').toLowerCase().includes(f.value.toLowerCase());
        case 'gt': return Number(val) > Number(f.value);
        case 'lt': return Number(val) < Number(f.value);
        case 'gte': return Number(val) >= Number(f.value);
        case 'lte': return Number(val) <= Number(f.value);
        case 'is_null': return val == null || val === '';
        case 'is_not_null': return val != null && val !== '';
        default: return true;
      }
    });
  });
}

function groupData(data: any[], groupBy: string, ctx: any): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  data.forEach(item => {
    let key: string;
    switch (groupBy) {
      case 'product': {
        const prod = ctx.products?.find((p: any) => p.id === (item.active_product_id || item.product_id));
        key = prod?.name || 'Sem produto';
        break;
      }
      case 'csm': {
        key = ctx.profileMap?.get(item.csm_id || item.user_id) || 'Sem CSM';
        break;
      }
      case 'status':
        key = item.status || item.band || 'Sem status';
        break;
      case 'month': {
        const d = item.created_at || item.scheduled_at || item.calculated_at || item.submitted_at;
        key = d ? format(new Date(d), 'MM/yy') : 'Sem data';
        break;
      }
      case 'stage':
        key = item.journey_stage_id || 'Sem etapa';
        break;
      default:
        key = 'Total';
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return groups;
}

function computeMetricValue(data: any[], metric: string, field: string | null): number {
  if (data.length === 0) return 0;
  switch (metric) {
    case 'count': return data.length;
    case 'sum': return field ? data.reduce((s, d) => s + (Number(d[field]) || 0), 0) : data.length;
    case 'avg': return field ? Math.round(data.reduce((s, d) => s + (Number(d[field]) || 0), 0) / data.length) : 0;
    case 'min': return field ? Math.min(...data.map(d => Number(d[field]) || 0)) : 0;
    case 'max': return field ? Math.max(...data.map(d => Number(d[field]) || 0)) : 0;
    case 'percentage': return data.length;
    default: return data.length;
  }
}

// ─── Props ───
interface IndicatorBuilderProps {
  offices: any[];
  contracts: any[];
  meetings: any[];
  healthScores: any[];
  activities: any[];
  formSubmissions: any[];
  products: any[];
  csmUsers: any[];
  profileMap: Map<string, string>;
  filterProduct: string;
  filterCsm: string;
}

export default function IndicatorBuilder({
  offices, contracts, meetings, healthScores, activities,
  formSubmissions, products, csmUsers, profileMap, filterProduct, filterCsm,
}: IndicatorBuilderProps) {
  const { user, isAdmin, isManager } = useAuth();
  const canCreate = isAdmin || isManager;

  const [savedIndicators, setSavedIndicators] = useState<SavedIndicator[]>([]);
  const [loadingIndicators, setLoadingIndicators] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<SavedIndicator | null>(null);

  // Builder state
  const [builderName, setBuilderName] = useState('');
  const [builderDesc, setBuilderDesc] = useState('');
  const [builderSource, setBuilderSource] = useState('offices');
  const [builderMetric, setBuilderMetric] = useState('count');
  const [builderField, setBuilderField] = useState<string>('');
  const [builderFilters, setBuilderFilters] = useState<IndicatorConfig['filters']>([]);
  const [builderGroupBy, setBuilderGroupBy] = useState('none');
  const [builderPeriod, setBuilderPeriod] = useState('all');
  const [builderViz, setBuilderViz] = useState('number');
  const [builderPinned, setBuilderPinned] = useState(false);

  // Fetch saved indicators
  const fetchIndicators = useCallback(async () => {
    setLoadingIndicators(true);
    const { data } = await supabase.from('custom_indicators').select('*').eq('is_active', true).order('sort_order');
    setSavedIndicators((data || []) as unknown as SavedIndicator[]);
    setLoadingIndicators(false);
  }, []);

  useState(() => { fetchIndicators(); });

  const dataContext = useMemo(() => ({
    offices, contracts, activities, meetings, healthScores,
    metricsHistory: [], formSubmissions, events: [], bonusGrants: [],
    products, csmUsers, profileMap,
  }), [offices, contracts, activities, meetings, healthScores, formSubmissions, products, csmUsers, profileMap]);

  // Preview computation
  const preview = useMemo(() => {
    const config: IndicatorConfig = {
      source: builderSource,
      metric: builderMetric,
      metric_field: builderField || null,
      filters: builderFilters,
      group_by: builderGroupBy,
      period: builderPeriod,
    };
    return computeIndicator(config, dataContext);
  }, [builderSource, builderMetric, builderField, builderFilters, builderGroupBy, builderPeriod, dataContext]);

  const numericFields = NUMERIC_FIELDS[builderSource] || [];
  const needsField = ['sum', 'avg', 'min', 'max'].includes(builderMetric);

  const resetBuilder = () => {
    setBuilderName('');
    setBuilderDesc('');
    setBuilderSource('offices');
    setBuilderMetric('count');
    setBuilderField('');
    setBuilderFilters([]);
    setBuilderGroupBy('none');
    setBuilderPeriod('all');
    setBuilderViz('number');
    setBuilderPinned(false);
    setEditingIndicator(null);
  };

  const openPredefined = (pm: PredefinedMetric) => {
    setBuilderName(pm.name);
    setBuilderSource(pm.config.source || 'offices');
    setBuilderMetric(pm.config.metric || 'count');
    setBuilderField(pm.config.metric_field || '');
    setBuilderFilters(pm.config.filters || []);
    setBuilderGroupBy(pm.config.group_by || 'none');
    setBuilderPeriod('last_90');
    setBuilderViz(pm.defaultViz);
    setShowBuilder(true);
  };

  const handleSave = async () => {
    if (!builderName.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    const config: IndicatorConfig = {
      source: builderSource,
      metric: builderMetric,
      metric_field: builderField || null,
      filters: builderFilters,
      group_by: builderGroupBy,
      period: builderPeriod,
    };
    const payload = {
      name: builderName,
      description: builderDesc || null,
      config: config as any,
      visualization_type: builderViz,
      pinned_to_dashboard: builderPinned,
      created_by: user?.id || null,
      product_filter: filterProduct !== 'all' ? filterProduct : null,
      is_active: true,
    };

    if (editingIndicator) {
      const { error } = await supabase.from('custom_indicators').update(payload).eq('id', editingIndicator.id);
      if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { error } = await supabase.from('custom_indicators').insert(payload);
      if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    }

    toast({ title: 'Indicador salvo com sucesso!' });
    resetBuilder();
    setShowBuilder(false);
    fetchIndicators();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('custom_indicators').update({ is_active: false }).eq('id', id);
    if (!error) {
      toast({ title: 'Indicador removido' });
      fetchIndicators();
    }
  };

  const handleTogglePin = async (ind: SavedIndicator) => {
    const { error } = await supabase.from('custom_indicators').update({ pinned_to_dashboard: !ind.pinned_to_dashboard }).eq('id', ind.id);
    if (!error) fetchIndicators();
  };

  const addFilter = () => setBuilderFilters([...builderFilters, { field: '', operator: 'equals', value: '' }]);
  const removeFilter = (i: number) => setBuilderFilters(builderFilters.filter((_, idx) => idx !== i));
  const updateFilter = (i: number, key: string, val: string) => {
    const f = [...builderFilters];
    (f[i] as any)[key] = val;
    setBuilderFilters(f);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="library">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <TabsList>
            <TabsTrigger value="library" className="gap-1.5"><Library className="h-4 w-4" />Biblioteca</TabsTrigger>
            <TabsTrigger value="saved" className="gap-1.5"><BarChart3 className="h-4 w-4" />Salvos</TabsTrigger>
            {canCreate && (
              <TabsTrigger value="builder" className="gap-1.5"><Wrench className="h-4 w-4" />Builder</TabsTrigger>
            )}
          </TabsList>
          {canCreate && (
            <Button size="sm" onClick={() => { resetBuilder(); setShowBuilder(true); }}>
              <Plus className="h-4 w-4 mr-1" />Novo Indicador
            </Button>
          )}
        </div>

        {/* Library Tab */}
        <TabsContent value="library" className="space-y-6">
          {PREDEFINED_CATEGORIES.map(cat => {
            const items = PREDEFINED_METRICS.filter(m => m.category === cat.key);
            if (items.length === 0) return null;
            const Icon = cat.icon;
            return (
              <Card key={cat.key}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    {cat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {items.map(m => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 hover:bg-accent/30 cursor-pointer transition-colors"
                        onClick={() => canCreate && openPredefined(m)}
                      >
                        <span className="text-sm">{m.name}</span>
                        {canCreate && (
                          <Badge variant="outline" className="text-[10px]">Configurar</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Saved Tab */}
        <TabsContent value="saved" className="space-y-4">
          {savedIndicators.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhum indicador salvo ainda.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {savedIndicators.map(ind => {
                const result = computeIndicator(ind.config, dataContext);
                return (
                  <Card key={ind.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">{ind.name}</CardTitle>
                        <div className="flex gap-1">
                          {canCreate && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleTogglePin(ind)}>
                                <Pin className={`h-3.5 w-3.5 ${ind.pinned_to_dashboard ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(ind.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <IndicatorPreview result={result} vizType={ind.visualization_type} compact />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Builder Tab */}
        {canCreate && (
          <TabsContent value="builder" className="space-y-4">
            <BuilderForm
              name={builderName} setName={setBuilderName}
              desc={builderDesc} setDesc={setBuilderDesc}
              source={builderSource} setSource={setBuilderSource}
              metric={builderMetric} setMetric={setBuilderMetric}
              field={builderField} setField={setBuilderField}
              filters={builderFilters} addFilter={addFilter} removeFilter={removeFilter} updateFilter={updateFilter}
              groupBy={builderGroupBy} setGroupBy={setBuilderGroupBy}
              period={builderPeriod} setPeriod={setBuilderPeriod}
              viz={builderViz} setViz={setBuilderViz}
              pinned={builderPinned} setPinned={setBuilderPinned}
              numericFields={numericFields} needsField={needsField}
              preview={preview}
              onSave={handleSave}
              onCancel={resetBuilder}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Builder Dialog (from library/new button) */}
      <Dialog open={showBuilder} onOpenChange={v => { if (!v) { resetBuilder(); setShowBuilder(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>🔧 Construtor de Indicador</DialogTitle></DialogHeader>
          <BuilderForm
            name={builderName} setName={setBuilderName}
            desc={builderDesc} setDesc={setBuilderDesc}
            source={builderSource} setSource={setBuilderSource}
            metric={builderMetric} setMetric={setBuilderMetric}
            field={builderField} setField={setBuilderField}
            filters={builderFilters} addFilter={addFilter} removeFilter={removeFilter} updateFilter={updateFilter}
            groupBy={builderGroupBy} setGroupBy={setBuilderGroupBy}
            period={builderPeriod} setPeriod={setBuilderPeriod}
            viz={builderViz} setViz={setBuilderViz}
            pinned={builderPinned} setPinned={setBuilderPinned}
            numericFields={numericFields} needsField={needsField}
            preview={preview}
            onSave={handleSave}
            onCancel={() => { resetBuilder(); setShowBuilder(false); }}
            inDialog
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Builder Form ───
function BuilderForm({
  name, setName, desc, setDesc, source, setSource, metric, setMetric,
  field, setField, filters, addFilter, removeFilter, updateFilter,
  groupBy, setGroupBy, period, setPeriod, viz, setViz,
  pinned, setPinned, numericFields, needsField, preview, onSave, onCancel, inDialog,
}: any) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Nome do Indicador</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Taxa de renovação por produto" />
      </div>
      <div className="space-y-2">
        <Label>Descrição (opcional)</Label>
        <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descrição breve..." rows={2} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Fonte de Dados</Label>
          <Select value={source} onValueChange={v => { setSource(v); setField(''); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Métrica</Label>
          <Select value={metric} onValueChange={setMetric}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {METRICS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {needsField && numericFields.length > 0 && (
        <div className="space-y-2">
          <Label>Campo Numérico</Label>
          <Select value={field} onValueChange={setField}>
            <SelectTrigger><SelectValue placeholder="Selecione o campo" /></SelectTrigger>
            <SelectContent>
              {numericFields.map((f: any) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Filtros</Label>
          <Button variant="outline" size="sm" onClick={addFilter}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
        </div>
        {filters.map((f: any, i: number) => (
          <div key={i} className="flex gap-2 items-center">
            <Input className="flex-1" placeholder="Campo" value={f.field} onChange={e => updateFilter(i, 'field', e.target.value)} />
            <Select value={f.operator} onValueChange={v => updateFilter(i, 'operator', v)}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OPERATORS.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="flex-1" placeholder="Valor" value={f.value} onChange={e => updateFilter(i, 'value', e.target.value)} />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeFilter(i)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Agrupar Por</Label>
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {GROUP_BY_OPTIONS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Período</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Visualization */}
      <div className="space-y-2">
        <Label>Visualização</Label>
        <div className="flex gap-2 flex-wrap">
          {VIZ_OPTIONS.map(v => (
            <Button
              key={v.value}
              variant={viz === v.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViz(v.value)}
            >
              {v.icon} {v.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox checked={pinned} onCheckedChange={setPinned} id="pin-dashboard" />
        <label htmlFor="pin-dashboard" className="text-sm">Fixar no Dashboard</label>
      </div>

      {/* Preview */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Preview</CardTitle></CardHeader>
        <CardContent>
          <IndicatorPreview result={preview} vizType={viz} />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={onSave}><Save className="h-4 w-4 mr-1" />Salvar Indicador</Button>
      </div>
    </div>
  );
}

// ─── Indicator Preview ───
function IndicatorPreview({ result, vizType, compact }: { result: { value: number | string; chartData: any[]; tableData: any[] }; vizType: string; compact?: boolean }) {
  const height = compact ? 160 : 240;

  if (vizType === 'number' || result.chartData.length === 0) {
    return (
      <div className="flex items-center justify-center py-4">
        <span className={`font-bold ${compact ? 'text-2xl' : 'text-4xl'} text-foreground`}>
          {typeof result.value === 'number' ? result.value.toLocaleString('pt-BR') : result.value}
        </span>
      </div>
    );
  }

  if (vizType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={result.chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (vizType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={result.chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {result.chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (vizType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={result.chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={compact ? 50 : 80} label={!compact}>
            {result.chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip />
          {!compact && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (vizType === 'table') {
    return (
      <div className="max-h-60 overflow-y-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border">
            <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Nome</th>
            <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Valor</th>
          </tr></thead>
          <tbody>
            {result.tableData.map((row, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="py-1.5 px-2">{row.name}</td>
                <td className="py-1.5 px-2 text-right font-medium">{typeof row.value === 'number' ? row.value.toLocaleString('pt-BR') : row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground text-center py-4">Selecione um tipo de visualização</p>;
}

export { computeIndicator, type SavedIndicator, type IndicatorConfig };
