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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2, Package, Route, Users, Trash2, Edit2, Heart, FileText, Gift, Link2, Zap, ShieldX, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { HealthScoreTab } from '@/components/configuracoes/HealthScoreTab';
import { FormTemplatesTab } from '@/components/configuracoes/FormTemplatesTab';
import { BonusCatalogTab } from '@/components/configuracoes/BonusCatalogTab';
import { IntegracoesTab } from '@/components/configuracoes/IntegracoesTab';
import { TemplatesAutomacoesTab } from '@/components/configuracoes/TemplatesAutomacoesTab';
import { PortalSettingsTab } from '@/components/configuracoes/PortalSettingsTab';

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
    setEditProduct(p); setName(p.name); setDescription(p.description || ''); setIsActive(p.is_active); setDialogOpen(true);
  };
  const openNew = () => {
    setEditProduct(null); setName(''); setDescription(''); setIsActive(true); setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    if (editProduct) {
      const { error } = await supabase.from('products').update({ name, description: description || null, is_active: isActive }).eq('id', editProduct.id);
      if (error) toast.error('Erro: ' + error.message); else toast.success('Produto atualizado!');
    } else {
      const { error } = await supabase.from('products').insert({ name, description: description || null, is_active: isActive });
      if (error) toast.error('Erro: ' + error.message); else toast.success('Produto criado!');
    }
    setSaving(false); setDialogOpen(false); fetch();
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
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Descrição</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {products.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{p.description || '—'}</TableCell>
                <TableCell><Badge variant={p.is_active ? 'default' : 'secondary'}>{p.is_active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Edit2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
            <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label>Ativo</Label></div>
            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
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
      .then(({ data }) => { const prods = data || []; setProducts(prods); if (prods.length > 0) setSelectedProduct(prods[0].id); setLoading(false); });
  }, []);

  const fetchStages = useCallback(async () => {
    if (!selectedProduct) return;
    const { data } = await supabase.from('journey_stages').select('*').eq('product_id', selectedProduct).order('position');
    setStages(data || []);
  }, [selectedProduct]);

  useEffect(() => { fetchStages(); }, [fetchStages]);

  const openNew = () => { setEditStage(null); setName(''); setDescription(''); setSlaDays(''); setPosition(String(stages.length)); setDialogOpen(true); };
  const openEdit = (s: any) => { setEditStage(s); setName(s.name); setDescription(s.description || ''); setSlaDays(s.sla_days ? String(s.sla_days) : ''); setPosition(String(s.position)); setDialogOpen(true); };

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
            <TableHeader><TableRow><TableHead>Posição</TableHead><TableHead>Nome</TableHead><TableHead>Descrição</TableHead><TableHead>SLA (dias)</TableHead><TableHead></TableHead></TableRow></TableHeader>
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
  const [offices, setOffices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('csm');
  const [newOfficeId, setNewOfficeId] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const [pRes, rRes, oRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('user_roles').select('*'),
      supabase.from('offices').select('id, name').order('name'),
    ]);
    const roleMap = new Map((rRes.data || []).map(r => [r.user_id, r.role]));
    setUsers((pRes.data || []).map(p => ({ ...p, role: roleMap.get(p.id) || 'sem role' })));
    setOffices(oRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const updateRole = async (userId: string, newRoleVal: string) => {
    const { data: existing } = await supabase.from('user_roles').select('id').eq('user_id', userId).single();
    if (existing) {
      const { error } = await supabase.from('user_roles').update({ role: newRoleVal as any }).eq('user_id', userId);
      if (error) toast.error('Erro: ' + error.message); else { toast.success('Role atualizado!'); fetchUsers(); }
    } else {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: newRoleVal as any });
      if (error) toast.error('Erro: ' + error.message); else { toast.success('Role atribuído!'); fetchUsers(); }
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { email: newEmail, password: newPassword, full_name: newName, role: newRole, office_id: newRole === 'client' ? newOfficeId : undefined },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Erro ao criar usuário');
    } else {
      toast.success('Usuário criado com sucesso!');
      setCreateOpen(false);
      setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('csm'); setNewOfficeId('');
      fetchUsers();
    }
    setCreating(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  const roleLabels: Record<string, string> = { admin: 'Admin', manager: 'Gestor', csm: 'CSM', viewer: 'Viewer', client: 'Cliente' };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{users.length} usuário{users.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" />Novo Usuário</Button>
      </div>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name || 'Sem nome'}</TableCell>
                <TableCell className="text-muted-foreground">{u.phone || '—'}</TableCell>
                <TableCell>
                  <Select value={u.role} onValueChange={(val) => updateRole(u.id, val)}>
                    <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(roleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Usuário</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={newName} onChange={e => setNewName(e.target.value)} /></div>
            <div className="space-y-2"><Label>E-mail *</Label><Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Senha *</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} /></div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {newRole === 'client' && (
              <div className="space-y-2">
                <Label>Vincular ao Escritório</Label>
                <Select value={newOfficeId} onValueChange={setNewOfficeId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={creating}>{creating ? 'Criando...' : 'Criar Usuário'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function Configuracoes() {
  const { isAdmin, isManager, isViewer } = useAuth();

  // Viewer blocked entirely
  if (isViewer) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gerencie produtos, etapas, health score e usuários</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShieldX className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Acesso restrito. Você não tem permissão para acessar configurações.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Manager: Produtos, Jornada, Formulários, Templates/Automações
  // Admin: all tabs
  const showHealth = isAdmin;
  const showBonus = isAdmin;
  const showUsers = isAdmin;
  const showIntegracoes = isAdmin;
  const showPortal = isAdmin || isManager;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie produtos, etapas, health score e usuários</p>
      </div>

      <Tabs defaultValue="produtos" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="produtos" className="gap-1.5"><Package className="h-4 w-4" />Produtos</TabsTrigger>
          <TabsTrigger value="jornada" className="gap-1.5"><Route className="h-4 w-4" />Etapas da Jornada</TabsTrigger>
          {showHealth && <TabsTrigger value="health" className="gap-1.5"><Heart className="h-4 w-4" />Health Score</TabsTrigger>}
          <TabsTrigger value="formularios" className="gap-1.5"><FileText className="h-4 w-4" />Formulários</TabsTrigger>
          <TabsTrigger value="automacoes" className="gap-1.5"><Zap className="h-4 w-4" />Templates/Automações</TabsTrigger>
          {showBonus && <TabsTrigger value="bonus" className="gap-1.5"><Gift className="h-4 w-4" />Catálogo de Bônus</TabsTrigger>}
          {showUsers && <TabsTrigger value="usuarios" className="gap-1.5"><Users className="h-4 w-4" />Usuários & Roles</TabsTrigger>}
          {showIntegracoes && <TabsTrigger value="integracoes" className="gap-1.5"><Link2 className="h-4 w-4" />Integrações</TabsTrigger>}
          {showPortal && <TabsTrigger value="portal" className="gap-1.5"><Globe className="h-4 w-4" />Portal do Cliente</TabsTrigger>}
        </TabsList>

        <TabsContent value="produtos"><ProductsTab /></TabsContent>
        <TabsContent value="jornada"><JourneyStagesTab /></TabsContent>
        {showHealth && <TabsContent value="health"><HealthScoreTab /></TabsContent>}
        <TabsContent value="formularios"><FormTemplatesTab /></TabsContent>
        <TabsContent value="automacoes"><TemplatesAutomacoesTab /></TabsContent>
        {showBonus && <TabsContent value="bonus"><BonusCatalogTab /></TabsContent>}
        {showUsers && <TabsContent value="usuarios"><UsersTab /></TabsContent>}
        {showIntegracoes && <TabsContent value="integracoes"><IntegracoesTab /></TabsContent>}
        {showPortal && <TabsContent value="portal"><PortalSettingsTab /></TabsContent>}
      </Tabs>
    </div>
  );
}
