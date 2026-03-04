import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus, Search, Loader2, Filter, X, Save, Eye, Heart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { differenceInDays, format } from 'date-fns';

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
  csmName?: string | null;
}

interface Product { id: string; name: string; }

const statusColors: Record<string, string> = {
  ativo: 'bg-success/10 text-success border-success/20',
  churn: 'bg-destructive/10 text-destructive border-destructive/20',
  nao_renovado: 'bg-warning/10 text-warning border-warning/20',
  nao_iniciado: 'bg-muted text-muted-foreground border-border',
  upsell: 'bg-primary/10 text-primary border-primary/20',
  bonus_elite: 'bg-primary/10 text-primary border-primary/20',
};

const statusLabels: Record<string, string> = {
  ativo: 'Ativo', churn: 'Churn', nao_renovado: 'Não Renovado',
  nao_iniciado: 'Não Iniciado', upsell: 'Upsell', bonus_elite: 'Bônus Elite',
};

const healthBandColors: Record<string, string> = {
  green: 'text-success', yellow: 'text-warning', red: 'text-destructive',
};

type ColumnKey = 'name' | 'sponsor' | 'product' | 'city' | 'status' | 'health' | 'ltv' | 'installments' | 'renewal' | 'lastMeeting' | 'stage' | 'csm' | 'contact';

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'name', label: 'Escritório' },
  { key: 'sponsor', label: 'Sponsor' },
  { key: 'csm', label: 'CSM' },
  { key: 'product', label: 'Produto' },
  { key: 'stage', label: 'Etapa' },
  { key: 'health', label: 'Health' },
  { key: 'status', label: 'Status' },
  { key: 'city', label: 'Cidade/UF' },
  { key: 'ltv', label: 'LTV' },
  { key: 'installments', label: 'Parc. Vencidas' },
  { key: 'renewal', label: 'Dias Renovação' },
  { key: 'lastMeeting', label: 'Última Reunião' },
  { key: 'contact', label: 'Contato' },
];

const DEFAULT_COLUMNS: ColumnKey[] = ['name', 'sponsor', 'product', 'stage', 'health', 'status', 'city', 'contact'];

export default function Clientes() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterHealth, setFilterHealth] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCnpj, setNewCnpj] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newProductId, setNewProductId] = useState('');
  const [creating, setCreating] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS);
  const [savedViews, setSavedViews] = useState<any[]>([]);
  const [viewName, setViewName] = useState('');
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const { isViewer, user } = useAuth();
  const navigate = useNavigate();

  const fetchOffices = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [officesRes, contactsRes, healthRes, contractsRes, meetingsRes, stagesRes, journeysRes, profilesRes] = await Promise.all([
      supabase.from('offices').select('*, products:active_product_id(name)').order('name'),
      supabase.from('contacts').select('name, office_id').eq('is_main_contact', true),
      supabase.from('health_scores').select('office_id, score, band'),
      supabase.from('contracts').select('office_id, monthly_value, value, installments_overdue, renewal_date, status'),
      supabase.from('meetings').select('office_id, scheduled_at, status').eq('status', 'completed'),
      supabase.from('journey_stages').select('id, name'),
      supabase.from('office_journey').select('office_id, journey_stage_id'),
      supabase.from('profiles').select('id, full_name'),
    ]);
    if (officesRes.error) { setError(officesRes.error.message); setLoading(false); return; }

    const contactMap = new Map((contactsRes.data || []).map(c => [c.office_id, c.name]));
    const healthMap = new Map((healthRes.data || []).map(h => [h.office_id, h]));
    const stageMap = new Map((stagesRes.data || []).map(s => [s.id, s.name]));
    const journeyMap = new Map((journeysRes.data || []).map(j => [j.office_id, j.journey_stage_id]));
    const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p.full_name]));

    // LTV & installments per office
    const ltvMap: Record<string, number> = {};
    const installmentsMap: Record<string, number> = {};
    const renewalMap: Record<string, number | null> = {};
    (contractsRes.data || []).forEach(c => {
      ltvMap[c.office_id] = (ltvMap[c.office_id] || 0) + (c.value || 0);
      if (c.status === 'ativo') {
        installmentsMap[c.office_id] = (installmentsMap[c.office_id] || 0) + (c.installments_overdue || 0);
        if (c.renewal_date) {
          const d = differenceInDays(new Date(c.renewal_date), new Date());
          renewalMap[c.office_id] = d;
        }
      }
    });

    // Last meeting per office
    const lastMeetingMap: Record<string, string> = {};
    (meetingsRes.data || []).forEach(m => {
      if (!lastMeetingMap[m.office_id] || m.scheduled_at > lastMeetingMap[m.office_id]) lastMeetingMap[m.office_id] = m.scheduled_at;
    });

    setOffices((officesRes.data || []).map((o: any) => {
      const h = healthMap.get(o.id);
      const stageId = journeyMap.get(o.id);
      return {
        ...o,
        mainContact: contactMap.get(o.id) || null,
        healthScore: h?.score ?? null,
        healthBand: h?.band ?? null,
        ltv: ltvMap[o.id] || 0,
        installmentsOverdue: installmentsMap[o.id] || 0,
        daysToRenewal: renewalMap[o.id] ?? null,
        lastMeeting: lastMeetingMap[o.id] || null,
        journeyStage: stageId ? stageMap.get(stageId) || null : null,
        csmName: o.csm_id ? profileMap.get(o.csm_id) || null : null,
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
    const { data } = await supabase.from('user_table_views' as any).select('*').eq('user_id', user.id).eq('page', 'clientes').order('created_at');
    setSavedViews(data || []);
  }, [user]);

  useEffect(() => { fetchOffices(); fetchProducts(); fetchViews(); }, [fetchOffices, fetchProducts, fetchViews]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const { error: err } = await supabase.from('offices').insert({
      name: newName, cnpj: newCnpj || null, city: newCity || null,
      state: newState || null, email: newEmail || null, phone: newPhone || null,
      active_product_id: newProductId || null, status: 'nao_iniciado',
    });
    if (err) toast.error('Erro ao criar escritório: ' + err.message);
    else {
      toast.success('Escritório criado!');
      setDialogOpen(false); setNewName(''); setNewCnpj(''); setNewCity(''); setNewState(''); setNewEmail(''); setNewPhone(''); setNewProductId('');
      fetchOffices();
    }
    setCreating(false);
  };

  const handleSaveView = async () => {
    if (!user || !viewName.trim()) return;
    const { error } = await supabase.from('user_table_views' as any).insert({
      user_id: user.id, page: 'clientes', name: viewName, columns: visibleColumns,
    });
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Visão salva!'); setSaveViewOpen(false); setViewName(''); fetchViews(); }
  };

  const loadView = (view: any) => {
    const cols = Array.isArray(view.columns) ? view.columns : DEFAULT_COLUMNS;
    setVisibleColumns(cols as ColumnKey[]);
    toast.success(`Visão "${view.name}" carregada`);
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const hasActiveFilters = filterStatus !== 'all' || filterProduct !== 'all' || filterHealth !== 'all';

  const filtered = offices.filter(o => {
    const matchSearch = o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.city?.toLowerCase().includes(search.toLowerCase()) ||
      o.state?.toLowerCase().includes(search.toLowerCase()) ||
      o.mainContact?.toLowerCase().includes(search.toLowerCase()) ||
      o.csmName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchProduct = filterProduct === 'all' || o.active_product_id === filterProduct;
    const matchHealth = filterHealth === 'all' || o.healthBand === filterHealth;
    return matchSearch && matchStatus && matchProduct && matchHealth;
  });

  const renderCell = (office: Office, col: ColumnKey) => {
    switch (col) {
      case 'name': return <TableCell key={col} className="font-medium">{office.name}</TableCell>;
      case 'sponsor': return <TableCell key={col} className="text-muted-foreground text-sm">{office.mainContact || '—'}</TableCell>;
      case 'csm': return <TableCell key={col} className="text-muted-foreground text-sm">{office.csmName || '—'}</TableCell>;
      case 'product': return <TableCell key={col} className="text-muted-foreground">{office.products?.name || '—'}</TableCell>;
      case 'stage': return <TableCell key={col} className="text-muted-foreground text-sm">{office.journeyStage || '—'}</TableCell>;
      case 'health': return (
        <TableCell key={col}>
          {office.healthScore != null ? (
            <span className={`font-medium ${healthBandColors[office.healthBand || ''] || ''}`}>
              {office.healthScore}
            </span>
          ) : '—'}
        </TableCell>
      );
      case 'status': return (
        <TableCell key={col}>
          <Badge variant="outline" className={statusColors[office.status] || ''}>{statusLabels[office.status] || office.status}</Badge>
        </TableCell>
      );
      case 'city': return <TableCell key={col} className="text-muted-foreground">{[office.city, office.state].filter(Boolean).join('/') || '—'}</TableCell>;
      case 'ltv': return <TableCell key={col} className="text-muted-foreground">{office.ltv ? `R$ ${office.ltv.toLocaleString('pt-BR')}` : '—'}</TableCell>;
      case 'installments': return (
        <TableCell key={col}>
          {(office.installmentsOverdue || 0) > 0 ? <span className="text-destructive font-medium">{office.installmentsOverdue}</span> : <span className="text-muted-foreground">0</span>}
        </TableCell>
      );
      case 'renewal': return (
        <TableCell key={col}>
          {office.daysToRenewal != null ? (
            <span className={office.daysToRenewal <= 30 ? 'text-warning font-medium' : 'text-muted-foreground'}>{office.daysToRenewal}d</span>
          ) : '—'}
        </TableCell>
      );
      case 'lastMeeting': return (
        <TableCell key={col} className="text-muted-foreground text-sm">
          {office.lastMeeting ? `${differenceInDays(new Date(), new Date(office.lastMeeting))}d atrás` : '—'}
        </TableCell>
      );
      case 'contact': return <TableCell key={col} className="text-muted-foreground text-sm">{office.email || office.phone || '—'}</TableCell>;
      default: return <TableCell key={col}>—</TableCell>;
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-destructive">Erro ao carregar clientes: {error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchOffices}>Tentar novamente</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {offices.length} escritório{offices.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Saved views */}
          {savedViews.length > 0 && (
            <Popover>
              <PopoverTrigger asChild><Button variant="outline" size="sm"><Eye className="h-4 w-4 mr-1" />Visões</Button></PopoverTrigger>
              <PopoverContent className="w-48 p-2">
                {savedViews.map(v => (
                  <Button key={v.id} variant="ghost" size="sm" className="w-full justify-start text-sm" onClick={() => loadView(v)}>{v.name}</Button>
                ))}
              </PopoverContent>
            </Popover>
          )}

          {/* Column config */}
          <Popover>
            <PopoverTrigger asChild><Button variant="outline" size="sm">Colunas</Button></PopoverTrigger>
            <PopoverContent className="w-56 p-3">
              <div className="space-y-2">
                {ALL_COLUMNS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={visibleColumns.includes(col.key)} onCheckedChange={() => toggleColumn(col.key)} />
                    {col.label}
                  </label>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t">
                <Button size="sm" variant="outline" className="w-full" onClick={() => setSaveViewOpen(true)}>
                  <Save className="h-3 w-3 mr-1" />Salvar visão
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {!isViewer && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo Escritório</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Escritório</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2"><Label>Nome *</Label><Input value={newName} onChange={e => setNewName(e.target.value)} required /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>CNPJ</Label><Input value={newCnpj} onChange={e => setNewCnpj(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Produto</Label>
                      <Select value={newProductId} onValueChange={setNewProductId}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Cidade</Label><Input value={newCity} onChange={e => setNewCity(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Estado</Label><Input value={newState} onChange={e => setNewState(e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Telefone</Label><Input value={newPhone} onChange={e => setNewPhone(e.target.value)} /></div>
                  </div>
                  <Button type="submit" className="w-full" disabled={creating}>{creating ? 'Criando...' : 'Criar Escritório'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, cidade, CSM..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-full bg-muted/50 border-0 focus-visible:ring-1" />
        </div>
        <Button variant={showFilters || hasActiveFilters ? 'default' : 'outline'} size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4 mr-1" />Filtros
          {hasActiveFilters && <Badge variant="secondary" className="ml-1 text-xs h-5 px-1">!</Badge>}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStatus('all'); setFilterProduct('all'); setFilterHealth('all'); }}>
            <X className="h-4 w-4 mr-1" />Limpar
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="flex gap-4 items-end flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Produto</Label>
            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Health</Label>
            <Select value={filterHealth} onValueChange={setFilterHealth}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="green">Verde</SelectItem>
                <SelectItem value="yellow">Amarelo</SelectItem>
                <SelectItem value="red">Vermelho</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="p-4 space-y-0">
            <div className="bg-muted/50 h-11 flex items-center px-4 gap-12 rounded-t-lg">
              {visibleColumns.map((col) => <div key={col} className="h-3 w-16 rounded skeleton-shimmer" />)}
            </div>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="border-b border-border/50 px-4 py-3 flex items-center gap-12">
                {visibleColumns.map((col) => <div key={col} className="h-4 w-20 rounded skeleton-shimmer" />)}
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{search || hasActiveFilters ? 'Nenhum escritório encontrado.' : 'Nenhum escritório cadastrado.'}</p>
            {!search && !hasActiveFilters && !isViewer && (
              <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Cadastrar</Button>
            )}
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map(col => (
                  <TableHead key={col}>{ALL_COLUMNS.find(c => c.key === col)?.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(office => (
                <TableRow key={office.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/clientes/${office.id}`)}>
                  {visibleColumns.map(col => renderCell(office, col))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Save view dialog */}
      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Salvar Visão</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome da visão</Label><Input value={viewName} onChange={e => setViewName(e.target.value)} placeholder="Ex: Minha visão padrão" /></div>
            <Button className="w-full" onClick={handleSaveView} disabled={!viewName.trim()}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
