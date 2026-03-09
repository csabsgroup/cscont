import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, UserCheck, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Link {
  id: string;
  manager_id: string;
  csm_id: string;
}

export function HierarchyTab() {
  const [managers, setManagers] = useState<Profile[]>([]);
  const [csms, setCsms] = useState<Profile[]>([]);
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedCsm, setSelectedCsm] = useState<Record<string, string>>({});
  const [portalAdminId, setPortalAdminId] = useState<string>('');
  const [savingAdmin, setSavingAdmin] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const [rolesRes, linksRes, settingsRes] = await Promise.all([
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('manager_csm_links').select('*'),
      supabase.from('portal_settings').select('setting_key, setting_value').eq('setting_key', 'portal_contact_admin_id'),
    ]);

    const roles = rolesRes.data || [];
    const managerIds = roles.filter(r => r.role === 'manager').map(r => r.user_id);
    const csmIds = roles.filter(r => r.role === 'csm').map(r => r.user_id);
    const adminIds = roles.filter(r => r.role === 'admin').map(r => r.user_id);

    const allIds = [...new Set([...managerIds, ...csmIds, ...adminIds])];
    let profiles: Profile[] = [];
    if (allIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', allIds);
      profiles = (data || []) as Profile[];
    }

    setManagers(profiles.filter(p => managerIds.includes(p.id)));
    setCsms(profiles.filter(p => csmIds.includes(p.id)));
    setAdmins(profiles.filter(p => adminIds.includes(p.id)));
    setLinks((linksRes.data || []) as Link[]);

    const adminSetting = (settingsRes.data || []).find((s: any) => s.setting_key === 'portal_contact_admin_id');
    if (adminSetting) setPortalAdminId(String(adminSetting.setting_value));

    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const linkedCsmIds = (managerId: string) => links.filter(l => l.manager_id === managerId).map(l => l.csm_id);
  const availableCsms = (managerId: string) => {
    const linked = linkedCsmIds(managerId);
    return csms.filter(c => !linked.includes(c.id));
  };

  const addLink = async (managerId: string) => {
    const csmId = selectedCsm[managerId];
    if (!csmId) return;
    const { error } = await supabase.from('manager_csm_links').insert({ manager_id: managerId, csm_id: csmId });
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('CSM vinculado!');
    setSelectedCsm(prev => ({ ...prev, [managerId]: '' }));
    fetch();
  };

  const removeLink = async (linkId: string) => {
    if (!window.confirm('Remover este vínculo?')) return;
    const { error } = await supabase.from('manager_csm_links').delete().eq('id', linkId);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Vínculo removido!');
    fetch();
  };

  const savePortalAdmin = async () => {
    setSavingAdmin(true);
    const { data: existing } = await supabase.from('portal_settings').select('id').eq('setting_key', 'portal_contact_admin_id');
    if (existing && existing.length > 0) {
      await supabase.from('portal_settings').update({ setting_value: portalAdminId || null } as any).eq('setting_key', 'portal_contact_admin_id');
    } else {
      await supabase.from('portal_settings').insert({ setting_key: 'portal_contact_admin_id', setting_value: portalAdminId || null } as any);
    }
    toast.success('Admin do portal atualizado!');
    setSavingAdmin(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Portal Admin Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Admin de Contato no Portal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Selecione qual Admin aparecerá como contato no Portal do Cliente.
          </p>
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>Admin</Label>
              <Select value={portalAdminId} onValueChange={setPortalAdminId}>
                <SelectTrigger><SelectValue placeholder="Nenhum selecionado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {admins.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name || 'Sem nome'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={savePortalAdmin} disabled={savingAdmin} size="sm">
              {savingAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manager-CSM Hierarchy */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Gestores e CSMs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {managers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum gestor cadastrado.</p>
          ) : (
            managers.map(m => {
              const isOpen = expanded.has(m.id);
              const myCsmIds = linkedCsmIds(m.id);
              const myCsms = csms.filter(c => myCsmIds.includes(c.id));
              const available = availableCsms(m.id);

              return (
                <Collapsible key={m.id} open={isOpen} onOpenChange={() => toggle(m.id)}>
                  <CollapsibleTrigger className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={m.full_name || 'Gestor'} avatarUrl={m.avatar_url} size="sm" />
                      <div className="text-left">
                        <p className="text-sm font-medium">{m.full_name || 'Sem nome'}</p>
                        <p className="text-xs text-muted-foreground">Gestor · {myCsms.length} CSM{myCsms.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 pt-2 space-y-2">
                    {myCsms.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">Nenhum CSM vinculado.</p>
                    )}
                    {myCsms.map(c => {
                      const link = links.find(l => l.manager_id === m.id && l.csm_id === c.id);
                      return (
                        <div key={c.id} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30">
                          <div className="flex items-center gap-2">
                            <UserAvatar name={c.full_name || 'CSM'} avatarUrl={c.avatar_url} size="sm" />
                            <span className="text-sm">{c.full_name || 'Sem nome'}</span>
                            <Badge variant="secondary" className="text-[0.65rem]">CSM</Badge>
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => link && removeLink(link.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                    {available.length > 0 && (
                      <div className="flex items-end gap-2 pt-1">
                        <div className="flex-1">
                          <Select value={selectedCsm[m.id] || ''} onValueChange={v => setSelectedCsm(prev => ({ ...prev, [m.id]: v }))}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Adicionar CSM..." /></SelectTrigger>
                            <SelectContent>
                              {available.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.full_name || 'Sem nome'}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button size="sm" className="h-8" onClick={() => addLink(m.id)} disabled={!selectedCsm[m.id]}>
                          <Plus className="h-3.5 w-3.5 mr-1" />Vincular
                        </Button>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
