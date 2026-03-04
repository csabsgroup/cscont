import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Heart, Calendar, Target, CreditCard, DollarSign, Shield, Clock, Info } from 'lucide-react';
import { differenceInDays, differenceInMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  office: any;
  health: any;
  contracts: any[];
  meetings: any[];
  actionPlans: any[];
  csmProfile: any;
  stageName: string | null;
  contacts: any[];
  onNavigateTab: (tab: string) => void;
}

export function ClienteVisao360({
  office, health, contracts, meetings, actionPlans, csmProfile, stageName, contacts, onNavigateTab,
}: Props) {
  const [showMore, setShowMore] = useState(false);

  const activeContract = contracts.find(c => c.status === 'ativo');
  const daysToRenewal = activeContract?.renewal_date ? differenceInDays(new Date(activeContract.renewal_date), new Date()) : null;
  const completedMeetings = meetings.filter(m => m.status === 'completed');
  const lastMeeting = completedMeetings[0];
  const daysSinceMeeting = lastMeeting ? differenceInDays(new Date(), new Date(lastMeeting.scheduled_at)) : null;
  const hasRecentMeeting = completedMeetings.some(m => {
    const d = new Date(m.scheduled_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalPlans = actionPlans.length;
  const donePlans = actionPlans.filter(p => p.status === 'done').length;
  const okrPercent = totalPlans > 0 ? Math.round((donePlans / totalPlans) * 100) : 0;
  const monthsAsClient = office.onboarding_date ? differenceInMonths(new Date(), new Date(office.onboarding_date)) : null;
  const ltv = contracts.reduce((sum: number, c: any) => sum + (c.value || 0), 0);
  const overdueInstallments = activeContract?.installments_overdue || 0;
  const overdueValue = overdueInstallments * (activeContract?.monthly_value || 0);
  const mainContact = contacts.find((c: any) => c.is_main_contact) || contacts[0];

  const renewalColor = daysToRenewal === null ? 'text-muted-foreground' : daysToRenewal < 30 ? 'text-red-600' : daysToRenewal < 60 ? 'text-yellow-600' : 'text-green-600';
  const healthColor = !health ? 'text-muted-foreground' : health.band === 'green' ? 'text-green-600' : health.band === 'yellow' ? 'text-yellow-600' : 'text-red-600';

  const infoFields = [
    { label: 'Status', value: office.status === 'ativo' ? 'Ativo' : office.status === 'churn' ? 'Churn' : office.status === 'nao_renovado' ? 'Não Renovado' : office.status === 'nao_iniciado' ? 'Não Iniciado' : office.status },
    { label: 'CSM', value: csmProfile?.full_name || '—' },
    { label: 'Etapa Jornada', value: stageName || '—' },
    { label: 'Produto', value: office.products?.name || '—' },
    { label: 'Cidade/Estado', value: [office.city, office.state].filter(Boolean).join('/') || '—' },
    { label: 'Contato Principal', value: mainContact?.name || '—' },
    { label: 'Data Ativação', value: office.activation_date ? format(new Date(office.activation_date), 'dd/MM/yyyy', { locale: ptBR }) : '—' },
    { label: 'CNPJ', value: office.cnpj || '—' },
  ];

  const extraFields = [
    { label: 'Email', value: office.email || '—' },
    { label: 'Telefone', value: office.phone || '—' },
    { label: 'Instagram', value: office.instagram || '—' },
    { label: 'Onboarding', value: office.onboarding_date ? format(new Date(office.onboarding_date), 'dd/MM/yyyy', { locale: ptBR }) : '—' },
    { label: 'Tempo como cliente', value: monthsAsClient !== null ? `${monthsAsClient} meses` : '—' },
    { label: 'Ciclos', value: String(contracts.length) },
    { label: 'LTV', value: `R$ ${ltv.toLocaleString('pt-BR')}` },
    { label: 'MRR', value: activeContract?.monthly_value ? `R$ ${activeContract.monthly_value.toLocaleString('pt-BR')}` : '—' },
  ];

  const indicators = [
    {
      label: 'HEALTH SCORE', value: health ? String(Math.round(health.score)) : '—', color: healthColor,
      detail: 'VER DETALHES', onClick: () => onNavigateTab('metricas'), icon: Heart,
    },
    {
      label: 'DIAS SEM REUNIÃO', value: daysSinceMeeting !== null ? String(daysSinceMeeting) : '—',
      color: daysSinceMeeting !== null && daysSinceMeeting > 30 ? 'text-red-600' : 'text-foreground',
      detail: 'VER DETALHES', onClick: () => onNavigateTab('timeline'), icon: Calendar,
    },
    {
      label: 'TAREFAS OKR', value: `${donePlans}/${totalPlans}`,
      sub: `${okrPercent}% concluído`, color: 'text-foreground',
      detail: 'VER DETALHES', onClick: () => onNavigateTab('okr'), icon: Target,
    },
    {
      label: 'PARCELAS EM ATRASO', value: String(overdueInstallments),
      sub: overdueInstallments > 0 ? `R$ ${overdueValue.toLocaleString('pt-BR')}` : undefined,
      color: overdueInstallments > 0 ? 'text-red-600' : 'text-foreground',
      detail: 'VER DETALHES', onClick: () => onNavigateTab('contratos'), icon: CreditCard,
    },
    {
      label: 'LTV TOTAL', value: `R$ ${ltv.toLocaleString('pt-BR')}`,
      color: 'text-foreground', detail: 'VER DETALHES', onClick: () => onNavigateTab('contratos'), icon: DollarSign,
    },
    {
      label: 'COBERTURA', value: hasRecentMeeting ? 'Sim' : 'Não',
      color: hasRecentMeeting ? 'text-green-600' : 'text-red-600',
      detail: 'VER DETALHES', onClick: () => onNavigateTab('timeline'), icon: Shield,
    },
    {
      label: 'DIAS P/ RENOVAÇÃO', value: daysToRenewal !== null ? String(daysToRenewal) : '—',
      color: renewalColor, detail: 'VER DETALHES', onClick: () => onNavigateTab('contratos'), icon: Clock,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Info fields grid */}
      <div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {infoFields.map((f, i) => (
            <Card key={i} className="p-3">
              <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">{f.label}</div>
              <div className="text-sm font-semibold text-foreground mt-0.5 truncate">{f.value}</div>
            </Card>
          ))}
        </div>

        {/* Expandable extra fields */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            showMore ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0'
          )}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {extraFields.map((f, i) => (
              <Card key={i} className="p-3">
                <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">{f.label}</div>
                <div className="text-sm font-semibold text-foreground mt-0.5 truncate">{f.value}</div>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex justify-center mt-3">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={() => setShowMore(!showMore)}>
            {showMore ? <><ChevronUp className="h-3 w-3" /> MENOS INFORMAÇÕES</> : <><ChevronDown className="h-3 w-3" /> VER MAIS INFORMAÇÕES</>}
          </Button>
        </div>
      </div>

      {/* Indicator cards */}
      <div>
        <h3 className="text-xs uppercase text-muted-foreground font-medium tracking-wider mb-3">Principais Indicadores</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <TooltipProvider>
            {indicators.map((ind, i) => (
              <Card key={i} className="p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">{ind.label}</div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/50" />
                    </TooltipTrigger>
                    <TooltipContent><p className="text-xs">{ind.label}</p></TooltipContent>
                  </Tooltip>
                </div>
                <div className={cn('text-4xl font-bold mt-2', ind.color)}>{ind.value}</div>
                {ind.sub && <div className="text-xs text-muted-foreground mt-1">{ind.sub}</div>}
                <button
                  onClick={ind.onClick}
                  className="text-[10px] text-red-600 uppercase font-medium mt-2 hover:underline text-left"
                >
                  {ind.detail}
                </button>
              </Card>
            ))}
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
