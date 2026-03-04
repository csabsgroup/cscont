import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Eye, ClipboardList, Paperclip, History, Phone, StickyNote, BarChart3, Target, Gift } from 'lucide-react';
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
import { PortalPreviewModal } from '@/components/clientes/PortalPreviewModal';
import { WhatsAppSendDialog } from '@/components/clientes/WhatsAppSendDialog';
import { ClienteVisao360 } from '@/components/clientes/ClienteVisao360';
import { ActivityCounterBadges, ActivityCounts } from '@/components/shared/ActivityCounterBadges';
import { Constants } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';


export default function Cliente360() {
  const { id } = useParams<{ id: string }>();
  const { isViewer, user } = useAuth();
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
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [csmList, setCsmList] = useState<any[]>([]);
  const [selectedCsm, setSelectedCsm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [quickNoteText, setQuickNoteText] = useState('');
  const [actionSaving, setActionSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);

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
      supabase.from('shared_files').select('id', { count: 'exact', head: true }).eq('office_id', id!),
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
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
    await supabase.from('offices').update({ csm_id: selectedCsm }).eq('id', id!);
    toast.success('CSM reatribuído!');
    setActionSaving(false); setShowReassign(false); fetchAll();
  };

  const saveStatusChange = async () => {
    if (!selectedStatus) return;
    setActionSaving(true);
    await supabase.from('offices').update({ status: selectedStatus as any }).eq('id', id!);
    toast.success('Status alterado!');
    setActionSaving(false); setShowStatusChange(false); fetchAll();
  };

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
    nao_iniciado: 'Não Iniciado', upsell: 'Upsell', bonus_elite: 'Bonus Elite',
  };

  const tabs360 = [
    { key: 'visao360', label: 'Visão 360', icon: Eye },
    { key: 'timeline', label: 'Atividades', icon: ClipboardList, count: activitiesCount },
    { key: 'arquivos', label: 'Arquivos', icon: Paperclip, count: filesCount },
    { key: 'contratos', label: 'Contratos', icon: FileText },
    { key: 'historico', label: 'Histórico', icon: History },
    { key: 'contatos', label: 'Contatos', icon: Phone, count: contacts.length },
    { key: 'notas', label: 'Notas', icon: StickyNote, count: notesLines },
    { key: 'metricas', label: 'Métricas', icon: BarChart3 },
    { key: 'okr', label: 'Plano de Ação', icon: Target },
    { key: 'bonus', label: 'Cashback', icon: Gift },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <ClienteHeader
        office={office}
        onEdit={isViewer ? undefined : () => setEditOpen(true)}
        health={health}
        stageName={stageName}
        csmProfile={csmProfile}
        onReassignCSM={openReassign}
        onChangeStatus={() => { setSelectedStatus(office.status); setShowStatusChange(true); }}
        onQuickNote={() => setShowQuickNote(true)}
        onPreviewOpen={() => setPreviewOpen(true)}
        onWhatsApp={() => setWhatsappOpen(true)}
      />

      {/* Horizontal tabs */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto -mx-6 px-6">
        <nav className="flex min-w-max">
          {tabs360.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2',
                activeTab === tab.key
                  ? 'text-red-700 border-red-600 bg-red-50 rounded-t-lg'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
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
        />
      )}

      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <ActivityCounterBadges counts={activityCounts} />
          <Card className="p-6"><ClienteTimeline officeId={office.id} readOnly={isViewer} /></Card>
        </div>
      )}

      {activeTab === 'arquivos' && (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Arquivos compartilhados do cliente</p>
          {/* Existing shared files functionality would go here */}
        </Card>
      )}

      {activeTab === 'contratos' && (
        <Card className="p-6"><ClienteContratos officeId={office.id} contracts={contracts} onRefresh={fetchAll} /></Card>
      )}

      {activeTab === 'historico' && (
        <Card className="p-6"><ClienteTimeline officeId={office.id} readOnly={isViewer} /></Card>
      )}

      {activeTab === 'contatos' && (
        <Card className="p-6"><ClienteContatos officeId={office.id} contacts={contacts} onRefresh={fetchAll} /></Card>
      )}

      {activeTab === 'notas' && (
        <Card className="p-6"><ClienteNotas officeId={office.id} initialNotes={office.notes} /></Card>
      )}

      {activeTab === 'metricas' && <ClienteMetricas officeId={office.id} />}

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

      {/* Change Status Dialog */}
      <Dialog open={showStatusChange} onOpenChange={setShowStatusChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar Status</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Novo Status</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Constants.public.Enums.office_status.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={saveStatusChange} disabled={actionSaving}>{actionSaving ? 'Salvando...' : 'Salvar'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Note Dialog */}
      <Dialog open={showQuickNote} onOpenChange={setShowQuickNote}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nota Rápida</DialogTitle></DialogHeader>
          <Textarea placeholder="Escreva sua nota..." value={quickNoteText} onChange={e => setQuickNoteText(e.target.value)} rows={4} />
          <DialogFooter><Button onClick={saveQuickNote} disabled={actionSaving || !quickNoteText.trim()}>{actionSaving ? 'Salvando...' : 'Salvar'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
