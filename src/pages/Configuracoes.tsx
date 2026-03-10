import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Route, Heart, FileText, Zap, Gift, Users, Link2, Globe, ArrowUpDown, ShieldX, Calendar, MessageSquare, CreditCard, Workflow, BarChart3, Eye, Bot, ClipboardList, ScrollText, ChevronRight, GitBranch } from 'lucide-react';
import { ImportExportTab } from '@/components/configuracoes/ImportExportTab';
import { HealthScoreTab } from '@/components/configuracoes/HealthScoreTab';
import { FormTemplatesTab } from '@/components/configuracoes/FormTemplatesTab';
import { BonusCatalogTab } from '@/components/configuracoes/BonusCatalogTab';
import { IntegracoesTab } from '@/components/configuracoes/IntegracoesTab';
import { TemplatesAutomacoesTab } from '@/components/configuracoes/TemplatesAutomacoesTab';
import { PortalSettingsTab } from '@/components/configuracoes/PortalSettingsTab';
import { Visao360ConfigTab } from '@/components/configuracoes/Visao360ConfigTab';
import { AutomationRulesTab } from '@/components/configuracoes/AutomationRulesTab';
import { ChurnReasonsTab } from '@/components/configuracoes/ChurnReasonsTab';
import { CustomFieldsConfigTab } from '@/components/configuracoes/CustomFieldsConfigTab';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { GoogleCalendarConfig } from '@/components/configuracoes/integrations/GoogleCalendarConfig';
import { SlackConfig } from '@/components/configuracoes/integrations/SlackConfig';
import { AsaasConfig } from '@/components/configuracoes/integrations/AsaasConfig';
import { PiperunConfig } from '@/components/configuracoes/integrations/PiperunConfig';
import { FirefliesConfig } from '@/components/configuracoes/integrations/FirefliesConfig';
import { WhatsAppConfig } from '@/components/configuracoes/integrations/WhatsAppConfig';
import { useIntegrationSettings } from '@/hooks/useIntegrationSettings';
import { PlaybooksTab } from '@/components/configuracoes/PlaybooksTab';
import { HierarchyTab } from '@/components/configuracoes/HierarchyTab';

// ─── Inline sub-components (Products, Stages, Users) ─────────
import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

// ─── Products Tab ────────────────────────────────────────────
function ProductsTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [codePrefix, setCodePrefix] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('name');
    setProducts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const openEdit = (p: any) => { setEditProduct(p); setName(p.name); setDescription(p.description || ''); setCodePrefix(p.code_prefix || ''); setIsActive(p.is_active); setDialogOpen(true); };
  const openNew = () => { setEditProduct(null); setName(''); setDescription(''); setCodePrefix(''); setIsActive(true); setDialogOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    if (editProduct) {
      const { error } = await supabase.from('products').update({ name, description: description || null, is_active: isActive, code_prefix: codePrefix.toUpperCase() || null }).eq('id', editProduct.id);
      if (error) toast.error('Erro: ' + error.message); else toast.success('Produto atualizado!');
    } else {
      const { error } = await supabase.from('products').insert({ name, description: description || null, is_active: isActive, code_prefix: codePrefix.toUpperCase() || null });
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
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Prefixo ID</TableHead><TableHead>Descrição</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {products.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="font-mono text-sm">{p.code_prefix || '—'}</TableCell>
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
            <div className="space-y-2">
              <Label>Prefixo do ID</Label>
              <Input value={codePrefix} onChange={e => setCodePrefix(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 5))} placeholder="Ex: ELT, STR, ACL" maxLength={5} className="font-mono uppercase" />
              <p className="text-xs text-muted-foreground">Sigla usada para gerar o código único do escritório (ex: ELT-001)</p>
            </div>
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
  const [deleteStageId, setDeleteStageId] = useState<string | null>(null);

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
    setDeleteStageId(null);
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
                      <Button size="sm" variant="ghost" onClick={() => setDeleteStageId(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
      <ConfirmDeleteDialog open={!!deleteStageId} onOpenChange={o => !o && setDeleteStageId(null)} onConfirm={() => deleteStageId && handleDelete(deleteStageId)} title="Excluir etapa" description="Tem certeza que deseja excluir esta etapa de jornada?" />
    </div>
  );
}

// ─── Users Tab ───────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [authMeta, setAuthMeta] = useState<Record<string, any>>({});
  const [offices, setOffices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('csm');
  const [newOfficeId, setNewOfficeId] = useState('');

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [editTab, setEditTab] = useState<'dados' | 'seguranca' | 'status'>('dados');
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editProductId, setEditProductId] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { user: currentUser } = useAuth();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const [pRes, rRes, oRes, prodRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('user_roles').select('*'),
      supabase.from('offices').select('id, name').order('name'),
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
    ]);
    const roleMap = new Map((rRes.data || []).map(r => [r.user_id, r.role]));
    setUsers((pRes.data || []).map(p => ({ ...p, role: roleMap.get(p.id) || 'sem role' })));
    setOffices(oRes.data || []);
    setProducts(prodRes.data || []);

    // Fetch auth metadata (email, banned status)
    const { data: metaResult } = await supabase.functions.invoke('admin-manage-user', {
      body: { action: 'list' },
    });
    if (metaResult?.users) {
      const map: Record<string, any> = {};
      metaResult.users.forEach((u: any) => { map[u.id] = u; });
      setAuthMeta(map);
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

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

  const openEditDialog = (u: any) => {
    setEditUser(u);
    setEditName(u.full_name || '');
    setEditRole(u.role || 'csm');
    setEditProductId(u.product_id || '');
    setEditWhatsapp(u.whatsapp || '');
    setEditPassword('');
    setEditPasswordConfirm('');
    setEditTab('dados');
    setConfirmDelete(false);
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('admin-manage-user', {
      body: { action: 'update_profile', user_id: editUser.id, full_name: editName, role: editRole, product_id: editProductId === 'none' ? null : editProductId || null, whatsapp: editWhatsapp || null },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Erro ao atualizar');
    } else {
      toast.success('Perfil atualizado!');
      setEditOpen(false);
      fetchUsers();
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (editPassword !== editPasswordConfirm) { toast.error('As senhas não coincidem'); return; }
    if (editPassword.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return; }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('admin-manage-user', {
      body: { action: 'update_password', user_id: editUser.id, password: editPassword },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Erro ao alterar senha');
    } else {
      toast.success('Senha alterada com sucesso!');
      setEditPassword(''); setEditPasswordConfirm('');
    }
    setSaving(false);
  };

  const handleToggleStatus = async () => {
    const banned = authMeta[editUser?.id]?.banned;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('admin-manage-user', {
      body: { action: banned ? 'reactivate' : 'deactivate', user_id: editUser.id },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Erro');
    } else {
      toast.success(banned ? 'Usuário reativado!' : 'Usuário desativado!');
      fetchUsers();
    }
    setSaving(false);
  };

  const handleDeleteUser = async () => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('admin-manage-user', {
      body: { action: 'delete', user_id: editUser.id },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Erro ao excluir');
    } else {
      toast.success('Usuário excluído!');
      setEditOpen(false);
      fetchUsers();
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  const roleLabels: Record<string, string> = { admin: 'Admin', manager: 'Gestor', csm: 'CSM', viewer: 'Viewer', client: 'Cliente' };
  const isBanned = (id: string) => authMeta[id]?.banned;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{users.length} usuário{users.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" />Novo Usuário</Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => {
              const meta = authMeta[u.id];
              const productName = products.find(p => p.id === u.product_id)?.name;
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || 'Sem nome'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{meta?.email || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                      {roleLabels[u.role] || u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{productName || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={meta?.banned ? 'destructive' : 'default'}>
                      {meta?.banned ? 'Inativo' : 'Ativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openEditDialog(u)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Create Dialog */}
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Usuário — {editUser?.full_name || 'Sem nome'}</DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border pb-0">
            {(['dados', 'seguranca', 'status'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setEditTab(tab)}
                className={cn(
                  'px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
                  editTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab === 'dados' ? 'Dados' : tab === 'seguranca' ? 'Segurança' : 'Status'}
              </button>
            ))}
          </div>

          {/* Tab: Dados */}
          {editTab === 'dados' && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={authMeta[editUser?.id]?.email || ''} disabled className="opacity-60" />
                <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado</p>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {editRole === 'csm' && (
                <div className="space-y-2">
                  <Label>Produto do CSM</Label>
                  <Select value={editProductId || 'none'} onValueChange={setEditProductId}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Define de qual produto este CSM é responsável</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input
                  value={editWhatsapp}
                  onChange={e => setEditWhatsapp(e.target.value.replace(/\D/g, ''))}
                  placeholder="11999999999"
                  maxLength={15}
                />
                <p className="text-xs text-muted-foreground">Número com DDD. O sistema adiciona o 55 automaticamente.</p>
              </div>
              <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          )}

          {/* Tab: Segurança */}
          {editTab === 'seguranca' && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nova Senha</Label>
                <Input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="space-y-2">
                <Label>Confirmar Senha</Label>
                <Input type="password" value={editPasswordConfirm} onChange={e => setEditPasswordConfirm(e.target.value)} placeholder="Repita a senha" />
              </div>
              <Button onClick={handleResetPassword} disabled={saving || !editPassword} className="w-full">
                {saving ? 'Alterando...' : 'Redefinir Senha'}
              </Button>
            </div>
          )}

          {/* Tab: Status */}
          {editTab === 'status' && editUser && (
            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div>
                  <p className="text-sm font-medium">Status da Conta</p>
                  <p className="text-xs text-muted-foreground">
                    {isBanned(editUser.id) ? 'Este usuário está desativado e não consegue fazer login' : 'Este usuário está ativo'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={isBanned(editUser.id) ? 'destructive' : 'default'}>
                    {isBanned(editUser.id) ? 'Inativo' : 'Ativo'}
                  </Badge>
                  <Button
                    size="sm"
                    variant={isBanned(editUser.id) ? 'default' : 'outline'}
                    onClick={handleToggleStatus}
                    disabled={saving || editUser.id === currentUser?.id}
                  >
                    {isBanned(editUser.id) ? 'Reativar' : 'Desativar'}
                  </Button>
                </div>
              </div>

              <div className="border border-destructive/30 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-destructive">Zona de Perigo</p>
                <p className="text-xs text-muted-foreground">Excluir o usuário é irreversível. Todos os dados associados serão removidos.</p>
                {!confirmDelete ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setConfirmDelete(true)}
                    disabled={editUser.id === currentUser?.id}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Excluir Usuário
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="destructive" onClick={handleDeleteUser} disabled={saving}>
                      {saving ? 'Excluindo...' : 'Confirmar Exclusão'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sidebar config ──────────────────────────────────────────
interface SidebarSection {
  key: string;
  label: string;
  icon: any;
  category: string;
  adminOnly?: boolean;
  managerVisible?: boolean;
}

const SIDEBAR_SECTIONS: SidebarSection[] = [
  // Produtos
  { key: 'produtos', label: 'Produtos', icon: Package, category: 'Produtos' },
  { key: 'jornada', label: 'Jornadas', icon: Route, category: 'Produtos' },
  { key: 'churn_reasons', label: 'Motivos de Churn', icon: ShieldX, category: 'Produtos', adminOnly: true },
  { key: 'health', label: 'Health Score', icon: Heart, category: 'Produtos', adminOnly: true },
  { key: 'automacoes', label: 'Templates', icon: Zap, category: 'Produtos' },
  // Formulários
  { key: 'formularios', label: 'Builder', icon: FileText, category: 'Formulários' },
  // Visão 360
  { key: '360_campos', label: 'Campos e Indicadores', icon: BarChart3, category: 'Visão 360', adminOnly: true },
  { key: '360_abas', label: 'Abas Visíveis', icon: Eye, category: 'Visão 360', adminOnly: true },
  { key: '360_custom', label: 'Campos Personalizados', icon: ClipboardList, category: 'Visão 360', adminOnly: true },
  { key: '360_header', label: 'Header do 360', icon: Eye, category: 'Visão 360', adminOnly: true },
  // Automações
  { key: 'auto_regras', label: 'Regras de Automação', icon: Workflow, category: 'Automações', adminOnly: true },
  { key: 'playbooks', label: 'Playbooks', icon: ClipboardList, category: 'Automações', adminOnly: true },
  // Integrações
  { key: 'int_gcal', label: 'Google Calendar', icon: Calendar, category: 'Integrações', adminOnly: true },
  { key: 'int_slack', label: 'Slack', icon: MessageSquare, category: 'Integrações', adminOnly: true },
  { key: 'int_asaas', label: 'Asaas', icon: CreditCard, category: 'Integrações', adminOnly: true },
  { key: 'int_piperun', label: 'Piperun', icon: Workflow, category: 'Integrações', adminOnly: true },
  { key: 'int_fireflies', label: 'Fireflies', icon: FileText, category: 'Integrações', adminOnly: true },
  { key: 'int_whatsapp', label: 'WhatsApp', icon: MessageSquare, category: 'Integrações', adminOnly: true },
  // Others
  { key: 'bonus', label: 'Catálogo de Bônus', icon: Gift, category: 'Catálogo de Bônus', adminOnly: true },
  { key: 'importexport', label: 'Importar / Exportar', icon: ArrowUpDown, category: 'Importar / Exportar' },
  { key: 'portal', label: 'Portal do Cliente', icon: Globe, category: 'Portal do Cliente', managerVisible: true },
  { key: 'usuarios', label: 'Usuários', icon: Users, category: 'Usuários & Permissões', adminOnly: true },
  { key: 'hierarquia', label: 'Hierarquia', icon: GitBranch, category: 'Usuários & Permissões', adminOnly: true },
  { key: 'auditoria', label: 'Trilha de Auditoria', icon: ScrollText, category: 'Trilha de Auditoria', adminOnly: true },
];

const CATEGORY_ICONS: Record<string, any> = {
  'Produtos': Package,
  'Formulários': FileText,
  'Visão 360': Eye,
  'Automações': Bot,
  'Integrações': Link2,
  'Catálogo de Bônus': Gift,
  'Importar / Exportar': ArrowUpDown,
  'Portal do Cliente': Globe,
  'Usuários & Permissões': Users,
  'Trilha de Auditoria': ScrollText,
};

function getBreadcrumb(key: string): { category: string; label: string } {
  const s = SIDEBAR_SECTIONS.find(sec => sec.key === key);
  return s ? { category: s.category, label: s.label } : { category: '', label: '' };
}

// ─── Main Page ───────────────────────────────────────────────
export default function Configuracoes() {
  const { isAdmin, isManager, isViewer } = useAuth();
  const isMobile = useIsMobile();
  const [selectedSection, setSelectedSection] = useState('produtos');
  const { settings, upsertSetting } = useIntegrationSettings();

  const visibleSections = SIDEBAR_SECTIONS.filter(s => {
    if (s.adminOnly && !isAdmin) return false;
    if (s.managerVisible && !isAdmin && !isManager) return false;
    return true;
  });

  const categories = Array.from(new Set(visibleSections.map(s => s.category)));

  // Determine which categories have multiple items (expandable) vs standalone
  const categoriesWithSubs = useMemo(() => {
    const set = new Set<string>();
    categories.forEach(cat => {
      const items = visibleSections.filter(s => s.category === cat);
      const isSingle = items.length === 1 && items[0].label === cat;
      if (!isSingle) set.add(cat);
    });
    return set;
  }, [categories, visibleSections]);

  // Derive parent category from selectedSection
  const parentCategory = useMemo(() => {
    const s = SIDEBAR_SECTIONS.find(sec => sec.key === selectedSection);
    if (s && categoriesWithSubs.has(s.category)) return s.category;
    return null;
  }, [selectedSection, categoriesWithSubs]);

  const [expandedCategory, setExpandedCategory] = useState<string | null>(parentCategory);

  // Auto-expand parent on mount or when selectedSection changes
  useEffect(() => {
    if (parentCategory) setExpandedCategory(parentCategory);
  }, [parentCategory]);

  const breadcrumb = getBreadcrumb(selectedSection);

  const renderContent = () => {
    switch (selectedSection) {
      case 'produtos': return <ProductsTab />;
      case 'jornada': return <JourneyStagesTab />;
      case 'churn_reasons': return <ChurnReasonsTab />;
      case 'health': return <HealthScoreTab />;
      case 'automacoes': return <TemplatesAutomacoesTab />;
      case 'formularios': return <FormTemplatesTab />;
      case '360_campos': return <Visao360ConfigTab mode="campos" />;
      case '360_abas': return <Visao360ConfigTab mode="abas" />;
      case '360_custom': return <CustomFieldsConfigTab />;
      case '360_header': return <Visao360ConfigTab mode="header" />;
      case 'auto_regras': return <AutomationRulesTab />;
      case 'playbooks': return <PlaybooksTab />;
      case 'int_gcal': return <GoogleCalendarConfig setting={settings.find(s => s.provider === 'google_calendar')} onSave={upsertSetting} />;
      case 'int_slack': return <SlackConfig setting={settings.find(s => s.provider === 'slack')} onSave={upsertSetting} />;
      case 'int_asaas': return <AsaasConfig setting={settings.find(s => s.provider === 'asaas')} onSave={upsertSetting} />;
      case 'int_piperun': return <PiperunConfig setting={settings.find(s => s.provider === 'piperun')} onSave={upsertSetting} />;
      case 'int_fireflies': return <FirefliesConfig setting={settings.find(s => s.provider === 'fireflies')} onSave={upsertSetting} />;
      case 'int_whatsapp': return <WhatsAppConfig setting={settings.find(s => s.provider === 'whatsapp')} onSave={upsertSetting} />;
      case 'bonus': return <BonusCatalogTab />;
      case 'importexport': return <ImportExportTab />;
      case 'portal': return <PortalSettingsTab />;
      case 'usuarios': return <UsersTab />;
      case 'hierarquia': return <HierarchyTab />;
      case 'auditoria': return <div className="text-sm text-muted-foreground">Veja a trilha de auditoria na página dedicada.</div>;
      default: return null;
    }
  };

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

  // Mobile: dropdown selector
  if (isMobile) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gerencie produtos, etapas, health score e usuários</p>
        </div>
        <Select value={selectedSection} onValueChange={setSelectedSection}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <div key={cat}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat}</div>
                {visibleSections.filter(s => s.category === cat).map(s => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
        <div className="bg-muted/30 rounded-lg p-4">
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-0 -m-6 min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-[240px] flex-shrink-0 bg-card border-r border-border overflow-y-auto">
        <div className="p-4 pb-2">
          <h2 className="text-lg font-semibold">Configurações</h2>
        </div>
        <nav className="px-2 pb-4 space-y-0.5">
          {categories.map(cat => {
            const CatIcon = CATEGORY_ICONS[cat];
            const items = visibleSections.filter(s => s.category === cat);
            const hasSubcategories = categoriesWithSubs.has(cat);
            const isExpanded = expandedCategory === cat;

            // Standalone item (no subcategories)
            if (!hasSubcategories) {
              const item = items[0];
              const isActive = selectedSection === item.key;
              return (
                <button
                  key={cat}
                  onClick={() => { setSelectedSection(item.key); setExpandedCategory(null); }}
                  className={cn(
                    'w-full flex items-center gap-2 text-sm font-medium py-2.5 px-3 rounded-lg transition-colors text-left cursor-pointer',
                    isActive
                      ? 'bg-sidebar-accent text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  {CatIcon && <CatIcon className="h-4 w-4 flex-shrink-0" />}
                  <span className="truncate">{cat}</span>
                </button>
              );
            }

            // Category with subcategories (accordion)
            const hasActiveChild = items.some(s => s.key === selectedSection);
            return (
              <div key={cat}>
                {/* Category header (toggle) */}
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                  className={cn(
                    'w-full flex items-center gap-2 text-sm font-medium py-2.5 px-3 rounded-lg transition-colors text-left cursor-pointer',
                    isExpanded || hasActiveChild
                      ? 'bg-muted/50'
                      : 'hover:bg-muted/50',
                    'text-muted-foreground'
                  )}
                >
                  {CatIcon && <CatIcon className="h-4 w-4 flex-shrink-0" />}
                  <span className="truncate flex-1">{cat}</span>
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 flex-shrink-0 transition-transform duration-200',
                      isExpanded && 'rotate-90'
                    )}
                  />
                </button>

                {/* Subcategories with grid-row animation */}
                <div
                  className="grid transition-all duration-200 ease-in-out"
                  style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden min-h-0">
                    <div className="py-0.5">
                      {items.map(s => {
                        const isActive = selectedSection === s.key;
                        return (
                          <button
                            key={s.key}
                            onClick={() => setSelectedSection(s.key)}
                            className={cn(
                              'w-full flex items-center text-sm py-2 px-3 pl-10 rounded-lg transition-colors text-left',
                              isActive
                                ? 'bg-sidebar-accent text-primary font-medium'
                                : 'text-muted-foreground/80 hover:text-muted-foreground hover:bg-muted/50'
                            )}
                          >
                            <span className="truncate">{s.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 bg-muted/20 p-6 overflow-y-auto">
        {/* Breadcrumb */}
        <div className="text-xs text-muted-foreground mb-1">
          Configurações {breadcrumb.category && `› ${breadcrumb.category}`} {breadcrumb.label !== breadcrumb.category && `› ${breadcrumb.label}`}
        </div>
        <h2 className="text-xl font-semibold mb-4">{breadcrumb.label}</h2>
        {renderContent()}
      </div>
    </div>
  );
}
