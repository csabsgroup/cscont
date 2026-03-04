import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, AlertTriangle, TrendingDown, TrendingUp, CheckSquare, Video, CreditCard, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isFuture, isPast, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [officesRes, contractsRes, activitiesRes, meetingsRes, contactsRes] = await Promise.all([
      supabase.from('offices').select('*, products:active_product_id(name)'),
      supabase.from('contracts').select('*'),
      supabase.from('activities').select('*, offices(name)').is('completed_at', null),
      supabase.from('meetings').select('*, offices(name)').eq('status', 'scheduled'),
      supabase.from('contacts').select('name, birthday, office_id, offices(name)').not('birthday', 'is', null),
    ]);
    setOffices(officesRes.data || []);
    setContracts(contractsRes.data || []);
    setActivities(activitiesRes.data || []);
    setMeetings(meetingsRes.data || []);
    setContacts(contactsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">Dashboard</h1></div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const ativos = offices.filter(o => o.status === 'ativo').length;
  const churn = offices.filter(o => o.status === 'churn').length;
  const naoRenovado = offices.filter(o => o.status === 'nao_renovado').length;
  const naoIniciado = offices.filter(o => o.status === 'nao_iniciado').length;
  const upsell = offices.filter(o => o.status === 'upsell').length;

  const overdueActivities = activities.filter(a => a.due_date && isPast(new Date(a.due_date)) && !isToday(new Date(a.due_date)));
  const todayActivities = activities.filter(a => a.due_date && isToday(new Date(a.due_date)));

  const todayMeetings = meetings.filter(m => isToday(new Date(m.scheduled_at)));
  const upcomingMeetings = meetings.filter(m => isFuture(new Date(m.scheduled_at)));

  const activeContracts = contracts.filter(c => c.status === 'ativo');
  const totalOverdueInstallments = activeContracts.reduce((sum, c) => sum + (c.installments_overdue || 0), 0);

  const renewingSoon = activeContracts.filter(c => {
    if (!c.renewal_date) return false;
    const days = differenceInDays(new Date(c.renewal_date), new Date());
    return days >= 0 && days <= 30;
  });

  // Upcoming birthdays (next 30 days)
  const today = new Date();
  const upcomingBirthdays = contacts.filter(c => {
    if (!c.birthday) return false;
    const bday = new Date(c.birthday);
    const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
    const diff = differenceInDays(thisYear, today);
    return diff >= 0 && diff <= 30;
  }).sort((a, b) => {
    const ad = new Date(a.birthday!);
    const bd = new Date(b.birthday!);
    const ay = new Date(today.getFullYear(), ad.getMonth(), ad.getDate());
    const by = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
    return ay.getTime() - by.getTime();
  }).slice(0, 5);

  // Attention items
  const attentionItems: { label: string; detail: string; type: 'danger' | 'warning' | 'info'; onClick?: () => void }[] = [];

  if (overdueActivities.length > 0) {
    attentionItems.push({ label: `${overdueActivities.length} atividade${overdueActivities.length > 1 ? 's' : ''} atrasada${overdueActivities.length > 1 ? 's' : ''}`, detail: 'Atividades passaram da data', type: 'danger', onClick: () => navigate('/atividades') });
  }
  if (totalOverdueInstallments > 0) {
    attentionItems.push({ label: `${totalOverdueInstallments} parcela${totalOverdueInstallments > 1 ? 's' : ''} vencida${totalOverdueInstallments > 1 ? 's' : ''}`, detail: 'Contratos com inadimplência', type: 'danger', onClick: () => navigate('/contratos') });
  }
  if (renewingSoon.length > 0) {
    attentionItems.push({ label: `${renewingSoon.length} contrato${renewingSoon.length > 1 ? 's' : ''} renovando em 30 dias`, detail: 'Prepare a renovação', type: 'warning', onClick: () => navigate('/contratos') });
  }
  if (naoIniciado > 0) {
    attentionItems.push({ label: `${naoIniciado} cliente${naoIniciado > 1 ? 's' : ''} não iniciado${naoIniciado > 1 ? 's' : ''}`, detail: 'Onboarding pendente', type: 'warning', onClick: () => navigate('/clientes') });
  }

  const typeColors = { danger: 'bg-destructive/10 text-destructive border-destructive/20', warning: 'bg-warning/10 text-warning border-warning/20', info: 'bg-primary/10 text-primary border-primary/20' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da sua carteira</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/clientes')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ativos}</div>
            <p className="text-xs text-muted-foreground">{offices.length} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{churn + naoRenovado}</div>
            <p className="text-xs text-muted-foreground">
              {churn} churn • {naoRenovado} não renovado • {naoIniciado} não iniciado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expansão/Upsell</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upsell}</div>
            <p className="text-xs text-muted-foreground">Oportunidades de upsell</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/atividades')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atividades Pendentes</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activities.length}</div>
            <p className="text-xs text-muted-foreground">
              {todayActivities.length} hoje • {overdueActivities.length} atrasada{overdueActivities.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Second row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Atenção Hoje */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Atenção Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attentionItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <p className="text-sm text-muted-foreground">Nenhum item requer atenção no momento. 🎉</p>
              </div>
            ) : (
              <div className="space-y-2">
                {attentionItems.map((item, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:shadow-sm transition-shadow ${typeColors[item.type]}`}
                    onClick={item.onClick}
                  >
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs opacity-80">{item.detail}</p>
                    </div>
                    <span className="text-xs">→</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reuniões do dia */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              Reuniões Hoje ({todayMeetings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayMeetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <p className="text-sm text-muted-foreground">Nenhuma reunião agendada para hoje.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayMeetings.map(m => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{m.title}</p>
                      <p className="text-xs text-muted-foreground">{m.offices?.name}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {format(new Date(m.scheduled_at), 'HH:mm')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            {upcomingMeetings.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3 cursor-pointer hover:underline" onClick={() => navigate('/reunioes')}>
                + {upcomingMeetings.length} próxima{upcomingMeetings.length > 1 ? 's' : ''} →
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Third row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Parcelas vencidas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Parcelas Vencidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalOverdueInstallments === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma parcela vencida. ✅</p>
            ) : (
              <div className="text-center py-2">
                <div className="text-3xl font-bold text-destructive">{totalOverdueInstallments}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  em {activeContracts.filter(c => (c.installments_overdue || 0) > 0).length} contrato{activeContracts.filter(c => (c.installments_overdue || 0) > 0).length > 1 ? 's' : ''}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximos aniversários */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🎂 Próximos Aniversários</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingBirthdays.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum aniversário nos próximos 30 dias.</p>
            ) : (
              <div className="space-y-2">
                {upcomingBirthdays.map((c, i) => {
                  const bday = new Date(c.birthday!);
                  const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
                  const daysUntil = differenceInDays(thisYear, today);
                  return (
                    <div key={i} className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/clientes/${c.office_id}`)}>
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.offices?.name}</p>
                      </div>
                      <Badge variant={daysUntil === 0 ? 'default' : 'secondary'} className="text-xs">
                        {daysUntil === 0 ? 'Hoje! 🎉' : `em ${daysUntil} dia${daysUntil > 1 ? 's' : ''}`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
