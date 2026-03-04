import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2, Package, Route, Users, Trash2, Edit2, Heart, FileText, Gift, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { HealthScoreTab } from '@/components/configuracoes/HealthScoreTab';
import { FormTemplatesTab } from '@/components/configuracoes/FormTemplatesTab';
import { BonusCatalogTab } from '@/components/configuracoes/BonusCatalogTab';
import { IntegracoesTab } from '@/components/configuracoes/IntegracoesTab';

// ─── Products Tab ────────────────────────────────────────────
function ProductsTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('name');
    setProducts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const openEdit = (p: any) => {
    setEditProduct(p);
    setName(p.name);
    setDescription(p.description || '');
    setIsActive(p.is_active);
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditProduct(null);
    setName('');
    setDescription('');
    setIsActive(true);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editProduct) {
      const { error } = await supabase.from('products').update({ name, description: description || null, is_active: isActive }).eq('id', editProduct.id);
      if (error) toast.error('Erro: ' + error.message);
      else toast.success('Produto atualizado!');
    } else {
      const { error } = await supabase.from('products').insert({ name, description: description || null, is_active: isActive });
      if (error) toast.error('Erro: ' + error.message);
      else toast.success('Produto criado!');
    }
    setSaving(false);
    setDialogOpen(false);
    fetch();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{products.length} produto{products.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Novo Produto</Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{p.description || '—'}</TableCell>
                <TableCell>
                  <Badge variant={p.is_active ? 'default' : 'secondary'}>
                    {p.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Ativo</Label>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Journey Stages Tab ──────────────────────────────────────
function JourneyStagesTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editStage, setEditStage] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [slaDays, setSlaDays] = useState('');
  const [position, setPosition] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('products').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => {
        const prods = data || [];
        setProducts(prods);
        if (prods.length > 0) setSelectedProduct(prods[0].id);
        setLoading(false);
      });
  }, []);

  const fetchStages = useCallback(async () => {
    if (!selectedProduct) return;
    const { data } = await supabase.from('journey_stages').select('*').eq('product_id', selectedProduct).order('position');
    setStages(data || []);
  }, [selectedProduct]);

  useEffect(() => { fetchStages(); }, [fetchStages]);

  const openNew = () => {
    setEditStage(null); setName(''); setDescription(''); setSlaDays(''); setPosition(String(stages.length)); setDialogOpen(true);
  };
  const openEdit = (s: any) => {
    setEditStage(s); setName(s.name); setDescription(s.description || ''); setSlaDays(s.sla_days ? String(s.sla_days) : ''); setPosition(String(s.position)); setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const payload = { name, description: description || null, sla_days: slaDays ? parseInt(slaDays) : null, position: parseInt(position) || 0, product_id: selectedProduct };
    if (editStage) {
      const { error } = await supabase.from('journey_stages').update(payload).eq('id', editStage.id);
      if (error) toast.error('Erro: ' + error.message); else toast.success('Etapa atualizada!');
    } else {
      const { error } = await supabase.from('journey_stages').insert(payload);
      if (error) toast.error('Erro: ' + error.message); else toast.success('Etapa criada!');
    }
    setSaving(false); setDialogOpen(false); fetchStages();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('journey_stages').delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message); else { toast.success('Etapa removida!'); fetchStages(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Produto" /></SelectTrigger>
          <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={openNew} disabled={!selectedProduct}><Plus className="mr-1 h-4 w-4" />Nova Etapa</Button>
      </div>
      {stages.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma etapa configurada.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Posição</TableHead><TableHead>Nome</TableHead><TableHead>Descrição</TableHead><TableHead>SLA (dias)</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {stages.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="text-muted-foreground">{s.position}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{s.description || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{s.sla_days || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Edit2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editStage ? 'Editar Etapa' : 'Nova Etapa'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Posição</Label><Input type="number" value={position} onChange={e => setPosition(e.target.value)} /></div>
              <div className="space-y-2"><Label>SLA (dias)</Label><Input type="number" value={slaDays} onChange={e => setSlaDays(e.target.value)} /></div>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Users Tab ───────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*').order('full_name');
    const { data: roles } = await supabase.from('user_roles').select('*');
    const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));
    setUsers((profiles || []).map(p => ({ ...p, role: roleMap.get(p.id) || 'sem role' })));
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const updateRole = async (userId: string, newRole: string) => {
    const { data: existing } = await supabase.from('user_roles').select('id').eq('user_id', userId).single();
    if (existing) {
      const { error } = await supabase.from('user_roles').update({ role: newRole as any }).eq('user_id', userId);
      if (error) toast.error('Erro: ' + error.message); else { toast.success('Role atualizado!'); fetch(); }
    } else {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole as any });
      if (error) toast.error('Erro: ' + error.message); else { toast.success('Role atribuído!'); fetch(); }
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const roleLabels: Record<string, string> = { admin: 'Admin', manager: 'Gestor', csm: 'CSM', viewer: 'Viewer', client: 'Cliente' };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{users.length} usuário{users.length !== 1 ? 's' : ''}</p>
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Role</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name || 'Sem nome'}</TableCell>
                <TableCell className="text-muted-foreground">{u.phone || '—'}</TableCell>
                <TableCell>
                  <Select value={u.role} onValueChange={(val) => updateRole(u.id, val)}>
                    <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function Configuracoes() {
  const { isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie produtos, etapas, health score e usuários</p>
      </div>

      <Tabs defaultValue="produtos" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="produtos" className="gap-1.5">
            <Package className="h-4 w-4" />Produtos
          </TabsTrigger>
          <TabsTrigger value="jornada" className="gap-1.5">
            <Route className="h-4 w-4" />Etapas da Jornada
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5">
            <Heart className="h-4 w-4" />Health Score
          </TabsTrigger>
          <TabsTrigger value="formularios" className="gap-1.5">
            <FileText className="h-4 w-4" />Formulários
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="bonus" className="gap-1.5">
              <Gift className="h-4 w-4" />Catálogo de Bônus
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="usuarios" className="gap-1.5">
              <Users className="h-4 w-4" />Usuários & Roles
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="integracoes" className="gap-1.5">
              <Link2 className="h-4 w-4" />Integrações
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="produtos"><ProductsTab /></TabsContent>
        <TabsContent value="jornada"><JourneyStagesTab /></TabsContent>
        <TabsContent value="health"><HealthScoreTab /></TabsContent>
        <TabsContent value="formularios"><FormTemplatesTab /></TabsContent>
        {isAdmin && <TabsContent value="bonus"><BonusCatalogTab /></TabsContent>}
        {isAdmin && <TabsContent value="usuarios"><UsersTab /></TabsContent>}
        {isAdmin && <TabsContent value="integracoes"><IntegracoesTab /></TabsContent>}
      </Tabs>
    </div>
  );
}
