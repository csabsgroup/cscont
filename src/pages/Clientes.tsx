import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus, Search, Filter, X, Save, Eye, ChevronUp, ChevronDown, ChevronsUpDown, GripVertical, Trash2, Pencil, Check as CheckIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { differenceInDays, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { CreateClientWizard } from '@/components/clientes/CreateClientWizard';
import { PaginationWithPageSize } from '@/components/shared/PaginationWithPageSize';

// ─── Types ───────────────────────────────────────────────────────
interface Office {
  id: string;
  name: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  status: string;
  email: string | null;
  phone: string | null;
  csm_id: string | null;
  active_product_id: string | null;
  tags: string[] | null;
  created_at: string;
  onboarding_date: string | null;
  activation_date: string | null;
  products?: { name: string } | null;
  mainContact?: string | null;
  healthScore?: number | null;
  healthBand?: string | null;
  ltv?: number;
  installmentsOverdue?: number;
  daysToRenewal?: number | null;
  lastMeeting?: string | null;
  journeyStage?: string | null;
  journeyStageId?: string | null;
  csmName?: string | null;
  nextStep?: string | null;
  office_code?: string | null;
  cycle_start_date?: string | null;
  cycle_end_date?: string | null;
  churn_date?: string | null;
  churnReasonName?: string | null;
}

interface Product { id: string; name: string; }
interface CSMProfile { id: string; full_name: string | null; }
interface JourneyStage { id: string; name: string; product_id: string; }

// ─── Column definitions ─────────────────────────────────────────
type ColumnKey = 'officeCode' | 'csm' | 'name' | 'product' | 'status' | 'stage' | 'health' | 'ltv' | 'lastMeeting' | 'nextStep' | 'city' | 'installments' | 'renewal' | 'sponsor' | 'contact' | 'activationDate' | 'cycleStart' | 'cycleEnd' | 'churnDate' | 'churnReason';

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'officeCode', label: 'ID' },
  { key: 'csm', label: 'CSM' },
  { key: 'name', label: 'Escritório' },
  { key: 'product', label: 'Produto' },
  { key: 'status', label: 'Status' },
  { key: 'stage', label: 'Etapa' },
  { key: 'health', label: 'Health Score' },
  { key: 'ltv', label: 'LTV' },
  { key: 'lastMeeting', label: 'Último Contato' },
  { key: 'nextStep', label: 'Próximo Passo' },
  { key: 'city', label: 'Cidade/UF' },
  { key: 'installments', label: 'Parc. Vencidas' },
  { key: 'renewal', label: 'Dias Renovação' },
  { key: 'sponsor', label: 'Sponsor' },
  { key: 'contact', label: 'Contato' },
  { key: 'activationDate', label: 'Data Ativação' },
  { key: 'cycleStart', label: 'Início Ciclo' },
  { key: 'cycleEnd', label: 'Fim Ciclo' },
  { key: 'churnDate', label: 'Data Churn' },
  { key: 'churnReason', label: 'Motivo Churn' },
];

const DEFAULT_COLUMNS: ColumnKey[] = ['csm', 'name', 'product', 'status', 'stage', 'health', 'ltv', 'lastMeeting', 'city'];

const statusColors: Record<string, string> = {
  ativo: 'bg-success/10 text-success border-success/20',
  churn: 'bg-destructive/10 text-destructive border-destructive/20',
  nao_renovado: 'bg-warning/10 text-warning border-warning/20',
  nao_iniciado: 'bg-muted text-muted-foreground border-border',
  upsell: 'bg-blue-50 text-blue-700 border-blue-200',
  bonus_elite: 'bg-amber-50 text-amber-700 border-amber-200',
  pausado: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
};

const statusLabels: Record<string, string> = {
  ativo: 'Ativo', churn: 'Churn', nao_renovado: 'Não Renovado',
  nao_iniciado: 'Não Iniciado', upsell: 'Upsell', bonus_elite: 'Bônus Elite',
  pausado: 'Pausado',
};

const healthDotColors: Record<string, string> = {
  green: 'bg-success', yellow: 'bg-warning', red: 'bg-destructive',
};

// ─── Filter state type ──────────────────────────────────────────
interface FilterState {
  csms: string[];
  products: string[];
  statuses: string[];
  stages: string[];
  health: string[];
  tags: string[];
  noMeeting30d: boolean;
  overdueInstallments: boolean;
  renewal30d: boolean;
}

const emptyFilters: FilterState = {
  csms: [], products: [], statuses: [], stages: [], health: [], tags: [],
  noMeeting30d: false, overdueInstallments: false, renewal30d: false,
};

type SortDir = 'asc' | 'desc' | null;

// ─── Multi-select filter dropdown ───────────────────────────────
function MultiFilterDropdown({ label, options, selected, onToggle }: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
          {label}
          {selected.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{selected.length}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2 max-h-60 overflow-y-auto" align="start">
        {options.map(o => (
          <label key={o.value} className="flex items-center gap-2 text-sm py-1 px-2 rounded-md cursor-pointer hover:bg-muted/50">
            <Checkbox checked={selected.includes(o.value)} onCheckedChange={() => onToggle(o.value)} />
            {o.label}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export default function Clientes() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [csmList, setCsmList] = useState<CSMProfile[]>([]);
  const [stages, setStages] = useState<JourneyStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS);
  const [sortColumn, setSortColumn] = useState<ColumnKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // URL filter preset
  const [searchParams, setSearchParams] = useSearchParams();
  const activePresetFilter = searchParams.get('filter');

  // Saved views
  const [savedViews, setSavedViews] = useState<any[]>([]);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [renameViewId, setRenameViewId] = useState<string | null>(null);
  const [renameViewName, setRenameViewName] = useState('');
  const defaultViewLoadedRef = useRef(false);
  const [deleteViewId, setDeleteViewId] = useState<string | null>(null);

  // Create office wizard
  const [wizardOpen, setWizardOpen] = useState(false);

  // Bulk actions
  const [bulkCsmOpen, setBulkCsmOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkCsmId, setBulkCsmId] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Drag state
  const [dragCol, setDragCol] = useState<ColumnKey | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColumnKey | null>(null);

  const { isViewer, isAdmin, isManager, user } = useAuth();
  const navigate = useNavigate();

  // ─── Debounce search ────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset page on filter/search change
  useEffect(() => { setPage(1); }, [debouncedSearch, filters]);

  // Apply URL preset filter
  useEffect(() => {
    if (!activePresetFilter) return;
    switch (activePresetFilter) {
      case 'ativos': setFilters({ ...emptyFilters, statuses: ['ativo', 'bonus_elite', 'upsell'] }); break;
      case 'health_vermelho': setFilters({ ...emptyFilters, health: ['red'] }); break;
      case 'health_amarelo': setFilters({ ...emptyFilters, health: ['yellow'] }); break;
      case 'health_verde': setFilters({ ...emptyFilters, health: ['green'] }); break;
      case 'churn': setFilters({ ...emptyFilters, statuses: ['churn', 'nao_renovado'] }); break;
      case 'renovam_30d': setFilters({ ...emptyFilters, renewal30d: true }); break;
      case 'renovam_60d': setFilters({ ...emptyFilters, renewal30d: true }); break; // reuses renewal filter with 60d logic in filtered
      case 'renovam_90d': setFilters({ ...emptyFilters, renewal30d: true }); break; // reuses renewal filter with 90d logic in filtered
      case 'sem_reuniao_30d': setFilters({ ...emptyFilters, noMeeting30d: true }); break;
      case 'nps_detratores': setFilters({ ...emptyFilters }); break; // handled in filtered
      case 'atividades_atrasadas': setFilters({ ...emptyFilters }); break; // handled in filtered
    }
  }, [activePresetFilter]);

  // ─── Data fetching ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [officesRes, contactsRes, healthRes, contractsRes, meetingsRes, stagesRes, journeysRes, profilesRes, rolesRes, activitiesRes, churnReasonsRes] = await Promise.all([
      supabase.from('offices').select('*, products:active_product_id(name)').order('name'),
      supabase.from('contacts').select('name, office_id').eq('is_main_contact', true),
      supabase.from('health_scores').select('office_id, score, band').order('calculated_at', { ascending: false }),
      supabase.from('contracts').select('office_id, monthly_value, value, renewal_date, status'),
      supabase.from('meetings').select('office_id, scheduled_at, status').eq('status', 'completed'),
      supabase.from('journey_stages').select('id, name, product_id'),
      supabase.from('office_journey').select('office_id, journey_stage_id'),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('user_roles').select('user_id, role').eq('role', 'csm'),
      supabase.from('activities').select('office_id, title, due_date').is('completed_at', null).order('due_date', { ascending: true }),
      supabase.from('churn_reasons').select('id, name'),
    ]);

    const churnReasonMap = new Map((churnReasonsRes.data || []).map((r: any) => [r.id, r.name]));

    if (officesRes.error) { setError(officesRes.error.message); setLoading(false); return; }

    const contactMap = new Map((contactsRes.data || []).map(c => [c.office_id, c.name]));
    // Deduplicate health scores: keep first (latest) per office_id
    const healthMap = new Map<string, any>();
    for (const h of (healthRes.data || [])) {
      if (!healthMap.has(h.office_id)) healthMap.set(h.office_id, h);
    }
    const stagesData = stagesRes.data || [];
    const stageMap = new Map(stagesData.map(s => [s.id, s]));
    const journeyMap = new Map((journeysRes.data || []).map(j => [j.office_id, j.journey_stage_id]));
    const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p.full_name]));

    // CSM list
    const csmIds = new Set((rolesRes.data || []).map(r => r.user_id));
    const csms = (profilesRes.data || []).filter(p => csmIds.has(p.id));
    setCsmList(csms);
    setStages(stagesData as JourneyStage[]);

    // Next step per office (first pending activity) + overdue tracking
    const nextStepMap = new Map<string, string>();
    const overdueOfficeIds = new Set<string>();
    const todayDate = new Date(); todayDate.setHours(0,0,0,0);
    (activitiesRes.data || []).forEach(a => {
      if (a.office_id && !nextStepMap.has(a.office_id)) {
        nextStepMap.set(a.office_id, a.title);
      }
      if (a.office_id && a.due_date) {
        const d = new Date(a.due_date); d.setHours(0,0,0,0);
        if (d < todayDate) overdueOfficeIds.add(a.office_id);
      }
    });

    // LTV, installments, renewal
    const ltvMap: Record<string, number> = {};
    const installmentsMap: Record<string, number> = {};
    const renewalMap: Record<string, number | null> = {};
    (contractsRes.data || []).forEach(c => {
      ltvMap[c.office_id] = (ltvMap[c.office_id] || 0) + (c.value || 0);
      if (c.status === 'ativo') {
        installmentsMap[c.office_id] = (installmentsMap[c.office_id] || 0) + (c.installments_overdue || 0);
        if (c.renewal_date) {
          const d = differenceInDays(new Date(c.renewal_date), new Date());
          if (renewalMap[c.office_id] == null || d < (renewalMap[c.office_id] as number)) renewalMap[c.office_id] = d;
        }
      }
    });

    const lastMeetingMap: Record<string, string> = {};
    (meetingsRes.data || []).forEach(m => {
      if (!lastMeetingMap[m.office_id] || m.scheduled_at > lastMeetingMap[m.office_id]) lastMeetingMap[m.office_id] = m.scheduled_at;
    });

    setOffices((officesRes.data || []).map((o: any) => {
      const h = healthMap.get(o.id);
      const stageId = journeyMap.get(o.id);
      const stg = stageId ? stageMap.get(stageId) : null;
      return {
        ...o,
        mainContact: contactMap.get(o.id) || null,
        healthScore: h?.score ?? null,
        healthBand: h?.band ?? null,
        ltv: ltvMap[o.id] || 0,
        installmentsOverdue: installmentsMap[o.id] || 0,
        daysToRenewal: renewalMap[o.id] ?? null,
        lastMeeting: lastMeetingMap[o.id] || null,
        journeyStage: stg?.name || null,
        journeyStageId: stageId || null,
        csmName: o.csm_id ? profileMap.get(o.csm_id) || null : null,
        nextStep: nextStepMap.get(o.id) || null,
        churnReasonName: o.churn_reason_id ? churnReasonMap.get(o.churn_reason_id) || null : null,
        hasOverdueActivities: overdueOfficeIds.has(o.id),
      };
    }));
    setLoading(false);
  }, []);

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase.from('products').select('id, name').eq('is_active', true);
    setProducts(data || []);
  }, []);

  const fetchViews = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('user_table_views' as any).select('*').or(`user_id.eq.${user.id},is_default.eq.true`).eq('page', 'clientes').order('created_at');
    setSavedViews(data || []);
  }, [user]);

  useEffect(() => { fetchData(); fetchProducts(); fetchViews(); }, [fetchData, fetchProducts, fetchViews]);

  // Auto-load global default view on initial mount
  useEffect(() => {
    if (defaultViewLoadedRef.current || savedViews.length === 0) return;
    const defaultView = savedViews.find((v: any) => v.is_default);
    if (defaultView) {
      const cols = Array.isArray(defaultView.columns) ? defaultView.columns as ColumnKey[] : DEFAULT_COLUMNS;
      setVisibleColumns(cols);
      if (defaultView.filters?.filters) {
        setFilters(defaultView.filters.filters);
      }
      if (defaultView.filters?.sort) {
        setSortColumn(defaultView.filters.sort.column || null);
        setSortDir(defaultView.filters.sort.dir || null);
      }
      setActiveViewId(defaultView.id);
    }
    defaultViewLoadedRef.current = true;
  }, [savedViews]);

  // ─── Filtering ──────────────────────────────────────────────
  const hasActiveFilters = useMemo(() =>
    filters.csms.length > 0 || filters.products.length > 0 || filters.statuses.length > 0 ||
    filters.stages.length > 0 || filters.health.length > 0 || filters.tags.length > 0 ||
    filters.noMeeting30d || filters.overdueInstallments || filters.renewal30d,
  [filters]);

  const filtered = useMemo(() => {
    let result = offices;
    const s = debouncedSearch.toLowerCase();
    if (s) {
      result = result.filter(o =>
        o.name.toLowerCase().includes(s) || o.city?.toLowerCase().includes(s) ||
        o.mainContact?.toLowerCase().includes(s) || o.csmName?.toLowerCase().includes(s) ||
        o.office_code?.toLowerCase().includes(s)
      );
    }
    if (filters.csms.length > 0) result = result.filter(o => o.csm_id && filters.csms.includes(o.csm_id));
    if (filters.products.length > 0) result = result.filter(o => o.active_product_id && filters.products.includes(o.active_product_id));
    if (filters.statuses.length > 0) result = result.filter(o => filters.statuses.includes(o.status));
    if (filters.stages.length > 0) result = result.filter(o => o.journeyStageId && filters.stages.includes(o.journeyStageId));
    if (filters.health.length > 0) result = result.filter(o => o.healthBand && filters.health.includes(o.healthBand));
    if (filters.tags.length > 0) result = result.filter(o => o.tags && filters.tags.some(t => o.tags!.includes(t)));
    if (filters.noMeeting30d) result = result.filter(o => !o.lastMeeting || differenceInDays(new Date(), new Date(o.lastMeeting)) > 30);
    if (filters.overdueInstallments) result = result.filter(o => (o.installmentsOverdue || 0) > 0);
    if (filters.renewal30d) {
      const renewalDays = activePresetFilter === 'renovam_90d' ? 90 : activePresetFilter === 'renovam_60d' ? 60 : 30;
      result = result.filter(o => o.daysToRenewal != null && o.daysToRenewal <= renewalDays);
    }
    // URL preset filters
    if (activePresetFilter === 'nps_detratores') result = result.filter(o => (o as any).last_nps != null && Number((o as any).last_nps) <= 6);
    if (activePresetFilter === 'atividades_atrasadas') result = result.filter(o => (o as any).hasOverdueActivities);
    return result;
  }, [offices, debouncedSearch, filters, activePresetFilter]);

  // ─── Sorting ────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortColumn || !sortDir) return filtered;
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let va: any, vb: any;
      switch (sortColumn) {
        case 'name': va = a.name; vb = b.name; break;
        case 'csm': va = a.csmName || ''; vb = b.csmName || ''; break;
        case 'product': va = a.products?.name || ''; vb = b.products?.name || ''; break;
        case 'status': va = a.status; vb = b.status; break;
        case 'stage': va = a.journeyStage || ''; vb = b.journeyStage || ''; break;
        case 'health': va = a.healthScore ?? -1; vb = b.healthScore ?? -1; break;
        case 'ltv': va = a.ltv || 0; vb = b.ltv || 0; break;
        case 'lastMeeting': va = a.lastMeeting || ''; vb = b.lastMeeting || ''; break;
        case 'city': va = a.city || ''; vb = b.city || ''; break;
        case 'installments': va = a.installmentsOverdue || 0; vb = b.installmentsOverdue || 0; break;
        case 'renewal': va = a.daysToRenewal ?? 9999; vb = b.daysToRenewal ?? 9999; break;
        case 'sponsor': va = a.mainContact || ''; vb = b.mainContact || ''; break;
        case 'officeCode': {
          const numA = parseInt((a.office_code || '').replace(/\D/g, '').slice(-3) || '0', 10);
          const numB = parseInt((b.office_code || '').replace(/\D/g, '').slice(-3) || '0', 10);
          va = numA; vb = numB; break;
        }
        case 'contact': va = a.mainContact || ''; vb = b.mainContact || ''; break;
        case 'activationDate': va = a.activation_date || ''; vb = b.activation_date || ''; break;
        case 'cycleStart': va = a.cycle_start_date || ''; vb = b.cycle_start_date || ''; break;
        case 'cycleEnd': va = a.cycle_end_date || ''; vb = b.cycle_end_date || ''; break;
        case 'nextStep': va = a.nextStep || ''; vb = b.nextStep || ''; break;
        case 'churnDate': va = a.churn_date || ''; vb = b.churn_date || ''; break;
        case 'churnReason': va = a.churnReasonName || ''; vb = b.churnReasonName || ''; break;
        default: va = ''; vb = ''; break;
      }
      if (typeof va === 'string') return dir * va.localeCompare(vb);
      return dir * ((va as number) - (vb as number));
    });
    return arr;
  }, [filtered, sortColumn, sortDir]);

  // ─── Pagination ─────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page, pageSize]);

  // ─── Column drag & drop ────────────────────────────────────
  const handleDragStart = (col: ColumnKey) => setDragCol(col);
  const handleDragOver = (e: React.DragEvent, col: ColumnKey) => { e.preventDefault(); setDragOverCol(col); };
  const handleDragEnd = () => { setDragCol(null); setDragOverCol(null); };
  const handleDrop = (targetCol: ColumnKey) => {
    if (!dragCol || dragCol === targetCol) { handleDragEnd(); return; }
    setVisibleColumns(prev => {
      const arr = [...prev];
      const fromIdx = arr.indexOf(dragCol);
      const toIdx = arr.indexOf(targetCol);
      if (fromIdx < 0 || toIdx < 0) return prev;
      arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, dragCol);
      return arr;
    });
    handleDragEnd();
  };

  // ─── Sort toggle ───────────────────────────────────────────
  const toggleSort = (col: ColumnKey) => {
    if (sortColumn !== col) { setSortColumn(col); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortColumn(null); setSortDir(null); }
  };

  // ─── Selection ─────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    const pageIds = paginated.map(o => o.id);
    const allSelected = pageIds.every(id => selectedIds.has(id));
    if (allSelected) setSelectedIds(prev => { const n = new Set(prev); pageIds.forEach(id => n.delete(id)); return n; });
    else setSelectedIds(prev => { const n = new Set(prev); pageIds.forEach(id => n.add(id)); return n; });
  };

  // ─── Filter toggle helpers ─────────────────────────────────
  const toggleFilter = (key: 'csms' | 'products' | 'statuses' | 'stages' | 'health' | 'tags', value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter(v => v !== value) : [...prev[key], value],
    }));
  };

  // Stage options filtered by selected products
  const stageOptions = useMemo(() => {
    if (filters.products.length === 0) return stages.map(s => ({ value: s.id, label: s.name }));
    return stages.filter(s => filters.products.includes(s.product_id)).map(s => ({ value: s.id, label: s.name }));
  }, [stages, filters.products]);

  // Active filter chips
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    filters.csms.forEach(id => {
      const name = csmList.find(c => c.id === id)?.full_name || id;
      chips.push({ key: `csm-${id}`, label: `CSM: ${name}`, onRemove: () => toggleFilter('csms', id) });
    });
    filters.products.forEach(id => {
      const name = products.find(p => p.id === id)?.name || id;
      chips.push({ key: `prod-${id}`, label: `Produto: ${name}`, onRemove: () => toggleFilter('products', id) });
    });
    filters.statuses.forEach(s => {
      chips.push({ key: `st-${s}`, label: `Status: ${statusLabels[s] || s}`, onRemove: () => toggleFilter('statuses', s) });
    });
    filters.stages.forEach(id => {
      const name = stages.find(s => s.id === id)?.name || id;
      chips.push({ key: `stg-${id}`, label: `Etapa: ${name}`, onRemove: () => toggleFilter('stages', id) });
    });
    filters.health.forEach(h => {
      const labels: Record<string, string> = { green: 'Verde', yellow: 'Amarelo', red: 'Vermelho' };
      chips.push({ key: `h-${h}`, label: `Health: ${labels[h] || h}`, onRemove: () => toggleFilter('health', h) });
    });
    if (filters.noMeeting30d) chips.push({ key: 'nm30', label: '+30d sem reunião', onRemove: () => setFilters(p => ({ ...p, noMeeting30d: false })) });
    if (filters.overdueInstallments) chips.push({ key: 'oi', label: 'Parcelas vencidas', onRemove: () => setFilters(p => ({ ...p, overdueInstallments: false })) });
    if (filters.renewal30d) chips.push({ key: 'r30', label: 'Renovação ≤30d', onRemove: () => setFilters(p => ({ ...p, renewal30d: false })) });
    return chips;
  }, [filters, csmList, products, stages]);

  // ─── Views ──────────────────────────────────────────────────
  const handleSaveView = async () => {
    if (!user || !viewName.trim()) return;
    const config = { columns: visibleColumns, filters, sort: { column: sortColumn, dir: sortDir } };
    const { error } = await supabase.from('user_table_views' as any).insert({
      user_id: user.id, page: 'clientes', name: viewName, columns: config.columns, filters: config,
    });
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Visão salva!'); setSaveViewOpen(false); setViewName(''); fetchViews(); }
  };

  const loadView = (view: any) => {
    const cols = Array.isArray(view.columns) ? view.columns as ColumnKey[] : DEFAULT_COLUMNS;
    setVisibleColumns(cols);
    if (view.filters?.filters) {
      setFilters(view.filters.filters);
    } else {
      setFilters(emptyFilters);
    }
    if (view.filters?.sort) {
      setSortColumn(view.filters.sort.column || null);
      setSortDir(view.filters.sort.dir || null);
    }
    setActiveViewId(view.id);
    toast.success(`Visão "${view.name}" carregada`);
  };

  const handleDeleteView = async () => {
    if (!deleteViewId) return;
    await supabase.from('user_table_views' as any).delete().eq('id', deleteViewId);
    setDeleteViewId(null);
    fetchViews();
    toast.success('Visão excluída');
  };

  const handleRenameView = async () => {
    if (!renameViewId || !renameViewName.trim()) return;
    await supabase.from('user_table_views' as any).update({ name: renameViewName }).eq('id', renameViewId);
    setRenameViewId(null);
    setRenameViewName('');
    fetchViews();
    toast.success('Visão renomeada');
  };

  const handleSetDefaultView = async (viewId: string) => {
    // Remove default from all, then set
    await supabase.from('user_table_views' as any).update({ is_default: false }).eq('page', 'clientes').eq('is_default', true);
    await supabase.from('user_table_views' as any).update({ is_default: true }).eq('id', viewId);
    fetchViews();
    toast.success('Visão definida como padrão global');
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  // ─── Create office (via wizard) ─────────────────────────────

  // ─── Bulk actions ──────────────────────────────────────────
  const handleBulkCsm = async () => {
    if (!bulkCsmId) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('offices').update({ csm_id: bulkCsmId }).in('id', ids);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success(`CSM reatribuído para ${ids.length} escritório(s)`); setSelectedIds(new Set()); setBulkCsmOpen(false); fetchData(); }
    setBulkLoading(false);
  };

  const handleBulkStatus = async () => {
    if (!bulkStatus) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('offices').update({ status: bulkStatus as any }).in('id', ids);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success(`Status alterado para ${ids.length} escritório(s)`); setSelectedIds(new Set()); setBulkStatusOpen(false); fetchData(); }
    setBulkLoading(false);
  };

  // ─── Render cell ───────────────────────────────────────────
  const renderCell = (office: Office, col: ColumnKey) => {
    switch (col) {
      case 'csm': return (
        <TableCell key={col}>
          {office.csmName ? (
            <UserAvatar
              name={office.csmName}
              avatarUrl={(office as any).csmAvatarUrl}
              size="xs"
            />
          ) : <span className="text-muted-foreground">—</span>}
        </TableCell>
      );
      case 'name': return <TableCell key={col} className="font-medium">{office.name}</TableCell>;
      case 'sponsor': return <TableCell key={col} className="text-muted-foreground text-sm">{office.mainContact || '—'}</TableCell>;
      case 'product': return <TableCell key={col} className="text-muted-foreground">{office.products?.name || '—'}</TableCell>;
      case 'stage': return (
        <TableCell key={col}>
          {office.journeyStage ? <Badge variant="outline" className="text-xs">{office.journeyStage}</Badge> : <span className="text-muted-foreground">—</span>}
        </TableCell>
      );
      case 'health': return (
        <TableCell key={col}>
          {office.healthScore != null ? (
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${healthDotColors[office.healthBand || ''] || 'bg-muted'}`} />
              <span className="text-sm font-medium">{Math.round(office.healthScore)}</span>
            </div>
          ) : <span className="text-muted-foreground">—</span>}
        </TableCell>
      );
      case 'status': return (
        <TableCell key={col}>
          <Badge variant="outline" className={`${statusColors[office.status] || ''} rounded-full text-xs`}>{statusLabels[office.status] || office.status}</Badge>
        </TableCell>
      );
      case 'ltv': return <TableCell key={col} className="text-muted-foreground tabular-nums">{office.ltv ? `R$ ${office.ltv.toLocaleString('pt-BR')}` : '—'}</TableCell>;
      case 'lastMeeting': return (
        <TableCell key={col} className="text-muted-foreground text-sm">
          {office.lastMeeting ? formatDistanceToNow(new Date(office.lastMeeting), { addSuffix: true, locale: ptBR }) : '—'}
        </TableCell>
      );
      case 'nextStep': return <TableCell key={col} className="text-muted-foreground text-sm max-w-[180px] truncate">{office.nextStep || '—'}</TableCell>;
      case 'city': return <TableCell key={col} className="text-muted-foreground">{[office.city, office.state].filter(Boolean).join('/') || '—'}</TableCell>;
      case 'installments': return (
        <TableCell key={col}>
          {(office.installmentsOverdue || 0) > 0
            ? <span className="text-destructive font-medium">{office.installmentsOverdue}</span>
            : <span className="text-muted-foreground">0</span>}
        </TableCell>
      );
      case 'renewal': return (
        <TableCell key={col}>
          {office.daysToRenewal != null ? (
            <span className={
              office.daysToRenewal < 15 ? 'text-destructive font-medium' :
              office.daysToRenewal < 30 ? 'text-warning font-medium' : 'text-muted-foreground'
            }>{office.daysToRenewal}d</span>
          ) : '—'}
        </TableCell>
      );
      case 'contact': return <TableCell key={col} className="text-muted-foreground text-sm">{office.email || office.phone || '—'}</TableCell>;
      case 'activationDate': return <TableCell key={col} className="text-muted-foreground text-sm">{(office as any).activation_date ? formatDistanceToNow(new Date((office as any).activation_date), { addSuffix: true, locale: ptBR }) : '—'}</TableCell>;
      case 'cycleStart': return <TableCell key={col} className="text-muted-foreground text-sm">{(office as any).cycle_start_date || '—'}</TableCell>;
      case 'cycleEnd': return <TableCell key={col} className="text-muted-foreground text-sm">{(office as any).cycle_end_date || '—'}</TableCell>;
      case 'churnDate': return <TableCell key={col} className="text-muted-foreground text-sm">{(office as any).churn_date || '—'}</TableCell>;
      case 'churnReason': return <TableCell key={col} className="text-muted-foreground text-sm">{(office as any).churnReasonName || '—'}</TableCell>;
      case 'officeCode': return <TableCell key={col} className="text-muted-foreground text-sm font-mono">{(office as any).office_code || '—'}</TableCell>;
      default: return <TableCell key={col}>—</TableCell>;
    }
  };

  // ─── Sort icon ─────────────────────────────────────────────
  const SortIcon = ({ col }: { col: ColumnKey }) => {
    if (sortColumn !== col) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />;
    if (sortDir === 'asc') return <ChevronUp className="h-3 w-3" />;
    return <ChevronDown className="h-3 w-3" />;
  };

  // ─── Error state ───────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-destructive">Erro ao carregar clientes: {error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchData}>Tentar novamente</Button>
        </CardContent></Card>
      </div>
    );
  }

  const canBulk = (isAdmin || isManager) && !isViewer;

  const presetFilterLabels: Record<string, string> = {
    ativos: 'Clientes Ativos',
    health_vermelho: 'Clientes em Risco (Health Vermelho)',
    health_amarelo: 'Health Amarelo',
    health_verde: 'Health Verde',
    churn: 'Churn / Não Renovado',
    renovam_30d: 'Renovam em 30 dias',
    renovam_60d: 'Renovam em 60 dias',
    renovam_90d: 'Renovam em 90 dias',
    sem_reuniao_30d: 'Sem reunião há +30 dias',
    nps_detratores: 'NPS Detratores',
    atividades_atrasadas: 'Com Atividades Atrasadas',
  };

  const presetFilterColors: Record<string, string> = {
    health_vermelho: 'bg-destructive/10 border-destructive/30 text-destructive',
    health_amarelo: 'bg-warning/10 border-warning/30 text-warning',
    health_verde: 'bg-success/10 border-success/30 text-success',
    churn: 'bg-destructive/10 border-destructive/30 text-destructive',
    atividades_atrasadas: 'bg-destructive/10 border-destructive/30 text-destructive',
    nps_detratores: 'bg-warning/10 border-warning/30 text-warning',
  };

  return (
    <div className="space-y-4">
      {/* Preset filter banner */}
      {activePresetFilter && (
        <div className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${presetFilterColors[activePresetFilter] || 'bg-primary/10 border-primary/30 text-primary'}`}>
          <span className="text-sm font-medium">
            🔍 Filtro ativo: {presetFilterLabels[activePresetFilter] || activePresetFilter}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => { setSearchParams({}); setFilters(emptyFilters); }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Exibindo {Math.min(paginated.length, sorted.length)} de {sorted.length} clientes</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Views dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm"><Eye className="h-4 w-4 mr-1" />Visões{savedViews.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{savedViews.length}</Badge>}</Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="end">
              {savedViews.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Nenhuma visão salva</p>
              ) : savedViews.map(v => (
                <div key={v.id} className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 group ${activeViewId === v.id ? 'bg-muted' : ''}`}>
                  <button className="flex-1 text-left truncate" onClick={() => loadView(v)}>{v.name}</button>
                  {v.is_default && <Badge variant="secondary" className="text-[10px] h-4 px-1">Padrão</Badge>}
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    {isAdmin && !v.is_default && (
                      <button onClick={() => handleSetDefaultView(v.id)} className="p-1 rounded hover:bg-muted" title="Definir como padrão">
                        <CheckIcon className="h-3 w-3" />
                      </button>
                    )}
                    <button onClick={() => { setRenameViewId(v.id); setRenameViewName(v.name); }} className="p-1 rounded hover:bg-muted">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={() => setDeleteViewId(v.id)} className="p-1 rounded hover:bg-muted text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="border-t mt-2 pt-2">
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setSaveViewOpen(true)}>
                  <Save className="h-3 w-3 mr-1" />Salvar visão atual
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Column config */}
          <Popover>
            <PopoverTrigger asChild><Button variant="outline" size="sm">Colunas</Button></PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="end">
              {ALL_COLUMNS.map(col => (
                <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                  <Checkbox checked={visibleColumns.includes(col.key)} onCheckedChange={() => toggleColumn(col.key)} />
                  {col.label}
                </label>
              ))}
            </PopoverContent>
          </Popover>

          {!isViewer && (
            <Button onClick={() => setWizardOpen(true)}><Plus className="mr-2 h-4 w-4" />Novo Cliente</Button>
          )}
        </div>
      </div>

      {/* ─── Search + Filters ──────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, cidade, CSM..." value={searchInput} onChange={e => setSearchInput(e.target.value)} className="pl-9 rounded-full bg-muted/50 border-0 focus-visible:ring-1" />
        </div>

        <MultiFilterDropdown label="CSM" options={csmList.map(c => ({ value: c.id, label: c.full_name || c.id }))} selected={filters.csms} onToggle={v => toggleFilter('csms', v)} />
        <MultiFilterDropdown label="Produto" options={products.map(p => ({ value: p.id, label: p.name }))} selected={filters.products} onToggle={v => toggleFilter('products', v)} />
        <MultiFilterDropdown label="Status" options={Object.entries(statusLabels).map(([k, v]) => ({ value: k, label: v }))} selected={filters.statuses} onToggle={v => toggleFilter('statuses', v)} />
        <MultiFilterDropdown label="Etapa" options={stageOptions} selected={filters.stages} onToggle={v => toggleFilter('stages', v)} />
        <MultiFilterDropdown label="Health" options={[{ value: 'green', label: 'Verde' }, { value: 'yellow', label: 'Amarelo' }, { value: 'red', label: 'Vermelho' }]} selected={filters.health} onToggle={v => toggleFilter('health', v)} />

        {/* Toggle filters */}
        <Button variant={filters.noMeeting30d ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setFilters(p => ({ ...p, noMeeting30d: !p.noMeeting30d }))}>+30d sem reunião</Button>
        <Button variant={filters.overdueInstallments ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setFilters(p => ({ ...p, overdueInstallments: !p.overdueInstallments }))}>Parc. vencidas</Button>
        <Button variant={filters.renewal30d ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setFilters(p => ({ ...p, renewal30d: !p.renewal30d }))}>Renovação ≤30d</Button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFilters(emptyFilters)}>
            <X className="h-3 w-3 mr-1" />Limpar
          </Button>
        )}
      </div>


      {activeChips.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {activeChips.map(chip => (
            <Badge key={chip.key} variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-muted" onClick={chip.onRemove}>
              {chip.label} <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}

      {/* ─── Bulk action bar ───────────────────────────────── */}
      {canBulk && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} selecionado(s)</span>
          <Button size="sm" variant="outline" onClick={() => setBulkCsmOpen(true)}>Reatribuir CSM</Button>
          <Button size="sm" variant="outline" onClick={() => setBulkStatusOpen(true)}>Alterar Status</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Cancelar</Button>
        </div>
      )}

      {/* ─── Table ─────────────────────────────────────────── */}
      <Card>
        {loading ? (
          <div className="p-4 space-y-0">
            <div className="bg-muted/50 h-11 flex items-center px-4 gap-12 rounded-t-lg">
              {visibleColumns.map(col => <div key={col} className="h-3 w-16 rounded skeleton-shimmer" />)}
            </div>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="border-b border-border/50 px-4 py-3 flex items-center gap-12">
                {visibleColumns.map(col => <div key={col} className="h-4 w-20 rounded skeleton-shimmer" />)}
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{debouncedSearch || hasActiveFilters ? 'Nenhum escritório encontrado.' : 'Nenhum escritório cadastrado.'}</p>
            {!debouncedSearch && !hasActiveFilters && !isViewer && (
              <Button variant="outline" className="mt-4" onClick={() => setWizardOpen(true)}><Plus className="mr-2 h-4 w-4" />Cadastrar</Button>
            )}
          </CardContent>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  {canBulk && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={paginated.length > 0 && paginated.every(o => selectedIds.has(o.id))}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                  )}
                  {visibleColumns.map(col => (
                    <TableHead
                      key={col}
                      draggable
                      onDragStart={() => handleDragStart(col)}
                      onDragOver={e => handleDragOver(e, col)}
                      onDrop={() => handleDrop(col)}
                      onDragEnd={handleDragEnd}
                      className={`cursor-grab select-none transition-all ${dragCol === col ? 'opacity-50' : ''} ${dragOverCol === col ? 'border-l-2 border-primary' : ''}`}
                    >
                      <button className="flex items-center gap-1 w-full" onClick={() => toggleSort(col)}>
                        <GripVertical className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                        {ALL_COLUMNS.find(c => c.key === col)?.label}
                        <SortIcon col={col} />
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(office => (
                  <TableRow key={office.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/clientes/${office.id}`)}>
                    {canBulk && (
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selectedIds.has(office.id)} onCheckedChange={() => toggleSelect(office.id)} />
                      </TableCell>
                    )}
                    {visibleColumns.map(col => renderCell(office, col))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* ─── Pagination ──────────────────────────────── */}
            <div className="px-4 border-t border-border/50">
              <PaginationWithPageSize
                totalItems={sorted.length}
                currentPage={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                itemLabel="clientes"
              />
            </div>
          </>
        )}
      </Card>

      {/* ─── Save view dialog ──────────────────────────────── */}
      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Salvar Visão</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome da visão</Label><Input value={viewName} onChange={e => setViewName(e.target.value)} placeholder="Ex: Minha visão padrão" /></div>
            <Button className="w-full" onClick={handleSaveView} disabled={!viewName.trim()}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename view dialog */}
      <Dialog open={!!renameViewId} onOpenChange={open => { if (!open) setRenameViewId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renomear Visão</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Novo nome</Label><Input value={renameViewName} onChange={e => setRenameViewName(e.target.value)} /></div>
            <Button className="w-full" onClick={handleRenameView} disabled={!renameViewName.trim()}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete view dialog */}
      <Dialog open={!!deleteViewId} onOpenChange={open => { if (!open) setDeleteViewId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Visão</DialogTitle><DialogDescription>Tem certeza que deseja excluir esta visão? Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteViewId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteView}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk CSM dialog */}
      <Dialog open={bulkCsmOpen} onOpenChange={setBulkCsmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reatribuir CSM</DialogTitle><DialogDescription>Selecione o CSM para {selectedIds.size} escritório(s)</DialogDescription></DialogHeader>
          <Select value={bulkCsmId} onValueChange={setBulkCsmId}>
            <SelectTrigger><SelectValue placeholder="Selecione o CSM" /></SelectTrigger>
            <SelectContent>{csmList.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name || c.id}</SelectItem>)}</SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkCsmOpen(false)}>Cancelar</Button>
            <Button onClick={handleBulkCsm} disabled={!bulkCsmId || bulkLoading}>{bulkLoading ? 'Salvando...' : 'Confirmar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Status dialog */}
      <Dialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar Status</DialogTitle><DialogDescription>Selecione o novo status para {selectedIds.size} escritório(s)</DialogDescription></DialogHeader>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
            <SelectContent>{Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkStatusOpen(false)}>Cancelar</Button>
            <Button onClick={handleBulkStatus} disabled={!bulkStatus || bulkLoading}>{bulkLoading ? 'Salvando...' : 'Confirmar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Client Wizard */}
      <CreateClientWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        products={products}
        csmList={csmList}
        onCreated={fetchData}
      />
    </div>
  );
}
