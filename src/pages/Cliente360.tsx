import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, FileText, Heart, Users, Target, TrendingUp, Clock } from 'lucide-react';
import { formatDistanceToNow, differenceInDays, differenceInMonths, format } from 'date-fns';
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
import { Constants } from '@/integrations/supabase/types';

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

  // Quick action dialogs
  const [showReassign, setShowReassign] = useState(false);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [csmList, setCsmList] = useState<any[]>([]);
  const [selectedCsm, setSelectedCsm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [quickNoteText, setQuickNoteText] = useState('');
  const [actionSaving, setActionSaving] = useState(false);

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

  // KPI computations
  const activeContract = contracts.find(c => c.status === 'ativo') || null;

  // Contract KPIs
  const daysToRenewal = activeContract?.renewal_date ? differenceInDays(new Date(activeContract.renewal_date), new Date()) : null;
  const renewalColor = daysToRenewal === null ? 'text-muted-foreground' : daysToRenewal < 30 ? 'text-destructive' : daysToRenewal < 60 ? 'text-yellow-600' : 'text-green-600';

  // Engagement KPIs
  const completedMeetings = meetings.filter(m => m.status === 'completed');
  const lastMeeting = meetings[0];
  const daysSinceMeeting = lastMeeting ? differenceInDays(new Date(), new Date(lastMeeting.scheduled_at)) : null;

  // OKR KPIs
  const totalPlans = actionPlans.length;
  const donePlans = actionPlans.filter(p => p.status === 'done').length;
  const overduePlans = actionPlans.filter(p => p.status !== 'done' && p.status !== 'cancelled' && p.due_date && new Date(p.due_date) < new Date()).length;
  const okrPercent = totalPlans > 0 ? Math.round((donePlans / totalPlans) * 100) : 0;
  const nextDuePlan = actionPlans
    .filter(p => p.status !== 'done' && p.status !== 'cancelled' && p.due_date)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  // Tempo de Vida
  const monthsAsClient = office.onboarding_date ? differenceInMonths(new Date(), new Date(office.onboarding_date)) : null;
  const contractCycles = contracts.length;
  const firstContract = contracts[contracts.length - 1];
  const ltv = contracts.reduce((sum: number, c: any) => sum + (c.value || 0), 0);

  const STATUS_LABELS: Record<string, string> = {
    ativo: 'Ativo', churn: 'Churn', nao_renovado: 'Não Renovado',
    nao_iniciado: 'Não Iniciado', upsell: 'Upsell', bonus_elite: 'Bonus Elite',
  };

  return (
    <div className="space-y-6">
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
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Contrato */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Contrato</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {activeContract ? (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor total</span><span className="font-medium">R$ {(activeContract.value || 0).toLocaleString('pt-BR')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Parcela</span><span>R$ {(activeContract.monthly_value || 0).toLocaleString('pt-BR')}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parcelas</span>
                  <span>{(activeContract.installments_total || 0) - (activeContract.installments_overdue || 0)}/{activeContract.installments_total || 0}</span>
                </div>
                {(activeContract.installments_overdue || 0) > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Vencidas</span><span className="text-destructive font-medium">{activeContract.installments_overdue}</span></div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Renovação</span>
                  <span className={renewalColor + ' font-medium'}>{daysToRenewal !== null ? `${daysToRenewal} dias` : '—'}</span>
                </div>
                {activeContract.end_date && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Fim</span><span>{format(new Date(activeContract.end_date), 'dd/MM/yyyy')}</span></div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Sem contrato ativo</p>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Saúde */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Heart className="h-4 w-4 text-primary" />Saúde</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {health ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold">{health.score}</span>
                  <Badge className={`text-xs ${health.band === 'green' ? 'bg-green-500/10 text-green-600 border-green-500/30' : health.band === 'yellow' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' : 'bg-red-500/10 text-red-600 border-red-500/30'}`} variant="outline">
                    {health.band === 'green' ? 'Verde' : health.band === 'yellow' ? 'Amarelo' : 'Vermelho'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Calculado em {format(new Date(health.calculated_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados de saúde</p>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Engajamento */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Engajamento</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Última reunião</span>
              <span>{lastMeeting ? formatDistanceToNow(new Date(lastMeeting.scheduled_at), { addSuffix: true, locale: ptBR }) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dias sem reunião</span>
              <span className={daysSinceMeeting !== null && daysSinceMeeting > 30 ? 'text-destructive font-medium' : ''}>{daysSinceMeeting ?? '—'}</span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total reuniões</span><span>{completedMeetings.length}</span></div>
          </CardContent>
        </Card>

        {/* Card 4: Plano de Ação */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Target className="h-4 w-4 text-primary" />Plano de Ação</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <Progress value={okrPercent} className="h-2 flex-1" />
              <span className="text-sm font-medium">{okrPercent}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tarefas</span><span>{donePlans}/{totalPlans}</span>
            </div>
            {overduePlans > 0 && (
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Atrasadas</span><span className="text-destructive font-medium">{overduePlans}</span></div>
            )}
            {nextDuePlan && (
              <div className="text-xs text-muted-foreground mt-1">Próxima: {nextDuePlan.title} — {format(new Date(nextDuePlan.due_date), 'dd/MM')}</div>
            )}
          </CardContent>
        </Card>

        {/* Card 5: Percepção */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Percepção</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Faturamento mês</span><span>—</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Faturamento ano</span><span>—</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Qtd clientes</span><span>—</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Qtd colaboradores</span><span>—</span></div>
          </CardContent>
        </Card>

        {/* Card 6: Tempo de Vida */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Tempo de Vida</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Tempo como cliente</span><span>{monthsAsClient !== null ? `${monthsAsClient} meses` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Ciclos</span><span>{contractCycles}</span></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">1ª assinatura</span>
              <span>{firstContract?.start_date ? format(new Date(firstContract.start_date), 'dd/MM/yyyy') : '—'}</span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">LTV</span><span className="font-medium">R$ {ltv.toLocaleString('pt-BR')}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="okr">Plano de Ação</TabsTrigger>
          <TabsTrigger value="reunioes">Reuniões</TabsTrigger>
          <TabsTrigger value="jornada">Jornada</TabsTrigger>
          <TabsTrigger value="contatos">Contatos ({contacts.length})</TabsTrigger>
          <TabsTrigger value="contratos">Contratos ({contracts.length})</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="bonus">Bônus/Cashback</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card className="p-6"><ClienteTimeline officeId={office.id} readOnly={isViewer} /></Card>
        </TabsContent>
        <TabsContent value="okr">
          <Card className="p-6"><ClienteOKR officeId={office.id} /></Card>
        </TabsContent>
        <TabsContent value="reunioes">
          <Card className="p-6"><ClienteReunioes officeId={office.id} /></Card>
        </TabsContent>
        <TabsContent value="jornada">
          <ClienteJornada officeId={office.id} productId={office.active_product_id} />
        </TabsContent>
        <TabsContent value="contatos">
          <Card className="p-6"><ClienteContatos officeId={office.id} contacts={contacts} onRefresh={fetchAll} /></Card>
        </TabsContent>
        <TabsContent value="contratos">
          <Card className="p-6"><ClienteContratos officeId={office.id} contracts={contracts} onRefresh={fetchAll} /></Card>
        </TabsContent>
        <TabsContent value="metricas">
          <ClienteMetricas officeId={office.id} />
        </TabsContent>
        <TabsContent value="notas">
          <Card className="p-6"><ClienteNotas officeId={office.id} initialNotes={office.notes} /></Card>
        </TabsContent>
        <TabsContent value="bonus">
          <Card className="p-6"><ClienteBonus officeId={office.id} /></Card>
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
