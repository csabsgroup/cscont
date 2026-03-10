import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Eye, ClipboardList, Paperclip, History, Phone, StickyNote, BarChart3, Target, Gift, PlayCircle, DollarSign, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ClienteHeader } from '@/components/clientes/ClienteHeader';
import { ClienteContatos } from '@/components/clientes/ClienteContatos';
import { ClienteContratos } from '@/components/clientes/ClienteContratos';
import { ClienteNotas } from '@/components/clientes/ClienteNotas';
import { ClienteTimeline } from '@/components/clientes/ClienteTimeline';
import { ClienteOKR } from '@/components/clientes/ClienteOKR';
import { ClienteReunioes } from '@/components/clientes/ClienteReunioes';
import { ClienteJornada } from '@/components/clientes/ClienteJornada';
import { ClienteMetricas } from '@/components/clientes/ClienteMetricas';
import { EditOfficeDialog } from '@/components/clientes/EditOfficeDialog';
import { ClienteBonus } from '@/components/clientes/ClienteBonus';
import { ClienteHistorico } from '@/components/clientes/ClienteHistorico';
import { PortalPreviewModal } from '@/components/clientes/PortalPreviewModal';
import { WhatsAppSendDialog } from '@/components/clientes/WhatsAppSendDialog';
import { ClienteVisao360 } from '@/components/clientes/ClienteVisao360';
import { ClienteArquivos } from '@/components/clientes/ClienteArquivos';
import { StatusChangeModal } from '@/components/clientes/StatusChangeModal';
import { ClienteFinanceiro } from '@/components/clientes/ClienteFinanceiro';
import { ClientAccessDialog } from '@/components/clientes/ClientAccessDialog';
import { ActivityCounterBadges, ActivityCounts } from '@/components/shared/ActivityCounterBadges';
import { Constants } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { applyPlaybook } from '@/lib/playbook-helpers';
import { Progress } from '@/components/ui/progress';

export default function Cliente360() {
  const { id } = useParams<{ id: string }>();
  const { isViewer, isAdmin, isManager, isClient, user } = useAuth();
  const navigate = useNavigate();
  const [office, setOffice] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [actionPlans, setActionPlans] = useState<any[]>([]);
  const [csmProfile, setCsmProfile] = useState<any>(null);
  const [stageName, setStageName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('visao360');

  // Counts for tab badges
  const [activitiesCount, setActivitiesCount] = useState(0);
  const [filesCount, setFilesCount] = useState(0);
  const [notesLines, setNotesLines] = useState(0);
  const [activityCounts, setActivityCounts] = useState<ActivityCounts>({ todas: 0, atrasadas: 0, vencemHoje: 0, aVencer: 0, concluidas: 0 });

  // Quick action dialogs
  const [showReassign, setShowReassign] = useState(false);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [selectedStatusTarget, setSelectedStatusTarget] = useState('');
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [csmList, setCsmList] = useState<any[]>([]);
  const [selectedCsm, setSelectedCsm] = useState('');
  const [quickNoteText, setQuickNoteText] = useState('');
  const [actionSaving, setActionSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [playbookDialogOpen, setPlaybookDialogOpen] = useState(false);
  const [playbooks, setPlaybooks] = useState<any[]>([]);
  const [playbookInstances, setPlaybookInstances] = useState<any[]>([]);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState('');
  const [applyingPlaybook, setApplyingPlaybook] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [officeRes, contactsRes, contractsRes, healthRes, meetingsRes, plansRes, journeyRes] = await Promise.all([
      supabase.from('offices').select('*, products:active_product_id(name)').eq('id', id).single(),
      supabase.from('contacts').select('*').eq('office_id', id).order('is_main_contact', { ascending: false }).order('name'),
      supabase.from('contracts').select('*, products:product_id(name)').eq('office_id', id).order('created_at', { ascending: false }),
      supabase.from('health_scores').select('*').eq('office_id', id).maybeSingle(),
      supabase.from('meetings').select('*').eq('office_id', id).order('scheduled_at', { ascending: false }),
      supabase.from('action_plans').select('*').eq('office_id', id),
      supabase.from('office_journey').select('*, journey_stages(name)').eq('office_id', id).maybeSingle(),
    ]);

    const off = officeRes.data;
    if (off) {
      setOffice(off);
      // Fetch CSM profile if csm_id exists
      if (off.csm_id) {
        const { data: csm } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', off.csm_id).single();
        setCsmProfile(csm);
      }
    }
    setContacts(contactsRes.data || []);
    setContracts(contractsRes.data || []);
    setHealth(healthRes.data);
    setMeetings(meetingsRes.data || []);
    setActionPlans(plansRes.data || []);
    setStageName(journeyRes.data?.journey_stages?.name || null);

    // Fetch counts for badges
    const [activitiesRes, filesRes] = await Promise.all([
      supabase.from('activities').select('id, completed_at, due_date').eq('office_id', id!),
      supabase.from('office_files').select('id', { count: 'exact', head: true }).eq('office_id', id!).is('note_id', null),
    ]);
    const acts = activitiesRes.data || [];
    setActivitiesCount(acts.length);
    setFilesCount(filesRes.count || 0);
    setNotesLines(officeRes.data?.notes ? officeRes.data.notes.split('\n').filter((l: string) => l.trim()).length : 0);

    // Activity counts
    const today = new Date(); today.setHours(0,0,0,0);
    let atrasadas = 0, vencemHoje = 0, aVencer = 0, concluidas = 0;
    acts.forEach((a: any) => {
      if (a.completed_at) { concluidas++; }
      else if (a.due_date) {
        const d = new Date(a.due_date); d.setHours(0,0,0,0);
        if (d < today) atrasadas++;
        else if (d.getTime() === today.getTime()) vencemHoje++;
        else aVencer++;
      } else aVencer++;
    });
    setActivityCounts({ todas: acts.length, atrasadas, vencemHoje, aVencer, concluidas });

    setLoading(false);

    // Fetch playbook instances
    const { data: instData } = await supabase
      .from('playbook_instances' as any)
      .select('*, playbook_templates(*)')
      .eq('office_id', id!)
      .order('applied_at', { ascending: false });
    setPlaybookInstances((instData as any[]) || []);

    // Fetch playbook templates
    const { data: pbData } = await supabase
      .from('playbook_templates' as any)
      .select('*')
      .eq('is_active', true);
    setPlaybooks((pbData as any[]) || []);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-sync Asaas financial data when office has CNPJ
  useEffect(() => {
    if (!office?.cnpj || !id) return;
    supabase.functions.invoke('integration-asaas', {
      body: { action: 'getFinancialByOffice', office_id: id },
    }).then(async () => {
      // Silently refresh office data after sync
      const { data } = await supabase.from('offices').select('installments_overdue, total_overdue_value').eq('id', id).single();
      if (data) setOffice((prev: any) => prev ? { ...prev, ...data } : prev);
    }).catch(() => { /* silent fail */ });
  }, [office?.cnpj, id]);

  // Fetch CSM list for reassign dialog
  const openReassign = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').order('full_name');
    setCsmList(data || []);
    setSelectedCsm(office?.csm_id || '');
    setShowReassign(true);
  };

  const saveReassign = async () => {
    if (!selectedCsm) return;
    setActionSaving(true);
    const oldCsmName = csmProfile?.full_name || '—';
    const newCsmName = csmList.find(c => c.id === selectedCsm)?.full_name || selectedCsm;
    await supabase.from('offices').update({ csm_id: selectedCsm }).eq('id', id!);
    // Log timeline event
    await supabase.from('office_timeline_events' as any).insert({
      office_id: id!, event_type: 'csm_reassign',
      title: 'CSM reatribuído',
      description: `${oldCsmName} → ${newCsmName}`,
      created_by: user?.id,
    });
    toast.success('CSM reatribuído!');
    setActionSaving(false); setShowReassign(false); fetchAll();
  };

  // saveStatusChange is now handled by StatusChangeModal

  const saveQuickNote = async () => {
    if (!quickNoteText.trim()) return;
    setActionSaving(true);
    const current = office?.notes || '';
    const timestamp = format(new Date(), "dd/MM/yyyy HH:mm");
    const updated = `[${timestamp}] ${quickNoteText.trim()}\n\n${current}`;
    await supabase.from('offices').update({ notes: updated }).eq('id', id!);
    toast.success('Nota adicionada!');
    setActionSaving(false); setShowQuickNote(false); setQuickNoteText(''); fetchAll();
  };

  const handleDeleteClient = async () => {
    if (!id || !user) return;
    setDeleting(true);
    try {
      // 1. Get activity IDs to delete checklists
      const { data: acts } = await supabase.from('activities').select('id').eq('office_id', id);
      const actIds = (acts || []).map(a => a.id);
      if (actIds.length > 0) {
        await supabase.from('activity_checklists').delete().in('activity_id', actIds);
      }
      // 2. Activities
      await supabase.from('activities').delete().eq('office_id', id);

      // 3. Form action executions (via submission IDs)
      const { data: subs } = await supabase.from('form_submissions').select('id').eq('office_id', id);
      const subIds = (subs || []).map(s => s.id);
      if (subIds.length > 0) {
        await supabase.from('form_action_executions').delete().in('submission_id', subIds);
      }
      // 4. Form submissions
      await supabase.from('form_submissions').delete().eq('office_id', id);

      // 5. Meeting transcripts (via meeting IDs)
      const { data: mtgs } = await supabase.from('meetings').select('id').eq('office_id', id);
      const mtgIds = (mtgs || []).map(m => m.id);
      if (mtgIds.length > 0) {
        await supabase.from('meeting_transcripts').delete().in('meeting_id', mtgIds);
      }
      // 6. Meetings
      await supabase.from('meetings').delete().eq('office_id', id);

      // 7-17. Direct office_id references
      const directTables = [
        'contacts', 'contracts', 'action_plans', 'bonus_grants', 'bonus_requests',
        'health_scores', 'health_playbook_executions', 'office_stage_history',
        'office_journey', 'automation_executions', 'event_participants',
        'client_office_links', 'office_files', 'office_notes', 'custom_field_values',
      ] as const;
      for (const table of directTables) {
        await supabase.from(table).delete().eq('office_id', id);
      }

      // 18. Delete the office itself
      const { error } = await supabase.from('offices').delete().eq('id', id);
      if (error) throw error;

      // Log to audit
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'delete_client',
        entity_type: 'office',
        entity_id: id,
        details: { office_name: office?.name },
      });

      toast.success('Cliente excluído com sucesso!');
      navigate('/clientes');
    } catch (err: any) {
      toast.error('Erro ao excluir cliente: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl skeleton-shimmer" />
          <div className="space-y-2 flex-1">
            <div className="h-6 w-48 rounded skeleton-shimmer" />
            <div className="h-4 w-32 rounded skeleton-shimmer" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 rounded-xl skeleton-shimmer" />)}
        </div>
      </div>
    );
  }

  if (!office) {
    return <div className="flex min-h-[400px] items-center justify-center"><p className="text-muted-foreground">Escritório não encontrado.</p></div>;
  }

  const STATUS_LABELS: Record<string, string> = {
    ativo: 'Ativo', churn: 'Churn', nao_renovado: 'Não Renovado',
    nao_iniciado: 'Não Iniciado', upsell: 'Upsell', bonus_elite: 'Bonus Elite', pausado: 'Pausado',
  };

  const tabs360 = [
    { key: 'visao360', label: 'Visão 360', icon: Eye },
    { key: 'historico', label: 'Histórico', icon: Clock },
    { key: 'timeline', label: 'Atividades', icon: ClipboardList, count: activitiesCount },
    { key: 'arquivos', label: 'Arquivos', icon: Paperclip, count: filesCount },
    { key: 'contratos', label: 'Contratos', icon: FileText },
    { key: 'financeiro', label: 'Financeiro', icon: DollarSign },
    
    { key: 'contatos', label: 'Contatos', icon: Phone, count: contacts.length },
    { key: 'notas', label: 'Notas', icon: StickyNote, count: notesLines },
    { key: 'metricas', label: 'Métricas', icon: BarChart3 },
    { key: 'okr', label: 'Plano de Ação', icon: Target },
    { key: 'bonus', label: 'Cashback', icon: Gift },
    { key: 'playbooks', label: 'Playbooks', icon: PlayCircle, count: playbookInstances.filter(i => (i as any).status === 'in_progress').length },
  ];

  const handleApplyPlaybook = async () => {
    if (!selectedPlaybookId || !id || !user) return;
    setApplyingPlaybook(true);
    try {
      await applyPlaybook(selectedPlaybookId, id, user.id);
      toast.success('Playbook aplicado com sucesso!');
      setPlaybookDialogOpen(false);
      setSelectedPlaybookId('');
      fetchAll();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Erro desconhecido'));
    }
    setApplyingPlaybook(false);
  };

  const filteredPlaybooks = playbooks.filter(pb => !pb.product_id || pb.product_id === office?.active_product_id);
  return (
    <div className="space-y-4">
      {/* Header */}
      <ClienteHeader
        office={office}
        onEdit={isViewer ? undefined : () => setEditOpen(true)}
        onDelete={(isAdmin || isManager) ? () => setShowDeleteConfirm(true) : undefined}
        health={health}
        stageName={stageName}
        csmProfile={csmProfile}
        contracts={contracts}
        onReassignCSM={openReassign}
        onChangeStatus={() => setShowStatusChange(true)}
        onStatusSelect={(s) => { setSelectedStatusTarget(s); setShowStatusChange(true); }}
        canEditStatus={!isViewer && !isClient}
        onQuickNote={() => setShowQuickNote(true)}
        onPreviewOpen={() => setPreviewOpen(true)}
        onWhatsApp={() => setWhatsappOpen(true)}
        onManageAccess={!isViewer && !isClient ? () => setAccessDialogOpen(true) : undefined}
      />

      {/* Horizontal tabs */}
      <div className="bg-background border-b border-border overflow-x-auto -mx-6 px-6">
        <nav className="flex min-w-max">
          {tabs360.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2',
                activeTab === tab.key
                  ? 'text-primary border-primary bg-primary/5 rounded-t-lg'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50'
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">{tab.count}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'visao360' && (
        <ClienteVisao360
          office={office}
          health={health}
          contracts={contracts}
          meetings={meetings}
          actionPlans={actionPlans}
          csmProfile={csmProfile}
          stageName={stageName}
          contacts={contacts}
          onNavigateTab={setActiveTab}
          onStatusSelect={(s) => { setSelectedStatusTarget(s); setShowStatusChange(true); }}
          canEditStatus={!isViewer && !isClient}
          onRefresh={fetchAll}
          readOnly={isViewer || isClient}
        />
      )}

      {activeTab === 'historico' && (
        <Card className="p-6"><ClienteHistorico officeId={office.id} /></Card>
      )}

      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <ActivityCounterBadges counts={activityCounts} />
          <Card className="p-6"><ClienteTimeline officeId={office.id} readOnly={isViewer} /></Card>
        </div>
      )}

      {activeTab === 'arquivos' && (
        <Card className="p-6"><ClienteArquivos officeId={office.id} /></Card>
      )}

      {activeTab === 'contratos' && (
        <Card className="p-6"><ClienteContratos officeId={office.id} contracts={contracts} onRefresh={fetchAll} /></Card>
      )}

      {activeTab === 'financeiro' && (
        <ClienteFinanceiro officeId={office.id} cnpj={office.cnpj} />
      )}

      {activeTab === 'contatos' && (
        <Card className="p-6"><ClienteContatos officeId={office.id} contacts={contacts} onRefresh={fetchAll} /></Card>
      )}

      {activeTab === 'notas' && (
        <Card className="p-6"><ClienteNotas officeId={office.id} initialNotes={office.notes} /></Card>
      )}

      {activeTab === 'metricas' && <ClienteMetricas officeId={office.id} officeOverdue={office.installments_overdue || 0} />}

      {activeTab === 'okr' && (
        <Card className="p-6"><ClienteOKR officeId={office.id} /></Card>
      )}

      {activeTab === 'bonus' && (
        <Card className="p-6"><ClienteBonus officeId={office.id} /></Card>
      )}

      {activeTab === 'reunioes' && (
        <Card className="p-6"><ClienteReunioes officeId={office.id} /></Card>
      )}

      {activeTab === 'jornada' && (
        <ClienteJornada officeId={office.id} productId={office.active_product_id} />
      )}

      {activeTab === 'playbooks' && (
        <div className="space-y-4">
          {!isViewer && !isClient && (
            <div className="flex justify-end">
              <Button onClick={() => setPlaybookDialogOpen(true)} size="sm">
                <PlayCircle className="mr-1 h-4 w-4" /> Aplicar Playbook
              </Button>
            </div>
          )}
          {playbookInstances.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">Nenhum playbook aplicado ainda.</Card>
          ) : (
            playbookInstances.map((inst: any) => {
              const template = inst.playbook_templates;
              const pct = inst.total_activities > 0 ? Math.round((inst.completed_activities / inst.total_activities) * 100) : 0;
              return (
                <Card key={inst.id} className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">{template?.name || 'Playbook'}</h3>
                      <p className="text-xs text-muted-foreground">
                        Aplicado em {inst.applied_at ? format(new Date(inst.applied_at), "dd/MM/yyyy", { locale: ptBR }) : '—'}
                      </p>
                    </div>
                    <Badge variant={inst.status === 'completed' ? 'default' : 'outline'} className="text-xs">
                      {inst.status === 'completed' ? '✅ Concluído' : inst.status === 'cancelled' ? 'Cancelado' : 'Em andamento'}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{inst.completed_activities}/{inst.total_activities} atividades</span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                </Card>
              );
            })
          )}

          {/* Apply Playbook Dialog */}
          <Dialog open={playbookDialogOpen} onOpenChange={setPlaybookDialogOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Aplicar Playbook</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Label>Selecione o playbook</Label>
                <Select value={selectedPlaybookId} onValueChange={setSelectedPlaybookId}>
                  <SelectTrigger><SelectValue placeholder="Escolher playbook..." /></SelectTrigger>
                  <SelectContent>
                    {filteredPlaybooks.map(pb => (
                      <SelectItem key={pb.id} value={pb.id}>{pb.name} ({(pb.activities || []).length} atividades)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPlaybookDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleApplyPlaybook} disabled={!selectedPlaybookId || applyingPlaybook}>
                  {applyingPlaybook ? 'Aplicando...' : 'Aplicar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Edit Office Dialog */}
      {!isViewer && <EditOfficeDialog office={office} open={editOpen} onOpenChange={setEditOpen} onSaved={fetchAll} />}

      {/* Reassign CSM Dialog */}
      <Dialog open={showReassign} onOpenChange={setShowReassign}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reatribuir CSM</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Novo CSM</Label>
            <Select value={selectedCsm} onValueChange={setSelectedCsm}>
              <SelectTrigger><SelectValue placeholder="Selecionar CSM..." /></SelectTrigger>
              <SelectContent>
                {csmList.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name || c.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={saveReassign} disabled={actionSaving}>{actionSaving ? 'Salvando...' : 'Salvar'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Modal - opens directly with target status */}
      <StatusChangeModal
        open={showStatusChange && !!selectedStatusTarget}
        onOpenChange={(open) => { setShowStatusChange(open); if (!open) setSelectedStatusTarget(''); }}
        officeId={id!}
        officeName={office.name}
        currentStatus={office.status}
        targetStatus={selectedStatusTarget}
        onStatusChanged={() => { setSelectedStatusTarget(''); fetchAll(); }}
      />

      {/* Portal Preview Modal */}
      <PortalPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        officeId={office.id}
        officeName={office.name}
      />

      {/* WhatsApp Send Dialog */}
      <WhatsAppSendDialog
        open={whatsappOpen}
        onOpenChange={setWhatsappOpen}
        officeId={office.id}
        officeName={office.name}
        contacts={contacts.filter((c: any) => c.phone)}
      />

      {/* Client Access Dialog */}
      <ClientAccessDialog
        officeId={office.id}
        officeName={office.name}
        open={accessDialogOpen}
        onOpenChange={setAccessDialogOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => { setShowDeleteConfirm(open); if (!open) setDeleteConfirmText(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os dados relacionados ao cliente <strong>{office?.name}</strong> serão excluídos permanentemente (contatos, contratos, reuniões, atividades, notas, jornada, health scores, etc).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Digite <strong>EXCLUIR</strong> para confirmar</Label>
            <Input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="EXCLUIR"
              disabled={deleting}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteClient}
              disabled={deleteConfirmText !== 'EXCLUIR' || deleting}
            >
              {deleting ? 'Excluindo...' : 'Excluir Permanentemente'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
