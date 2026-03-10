import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Heart, Calendar, Target, CreditCard, DollarSign, Shield, Clock, Info } from 'lucide-react';
import { differenceInDays, differenceInMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CustomFieldsDisplay } from './CustomFieldsDisplay';
import { StatusDropdown } from './StatusDropdown';
import { InlineEditField } from '@/components/shared/InlineEditField';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

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
  onStatusSelect?: (newStatus: string) => void;
  canEditStatus?: boolean;
  onRefresh?: () => void;
  readOnly?: boolean;
}

export function ClienteVisao360({
  office, health, contracts, meetings, actionPlans, csmProfile, stageName, contacts, onNavigateTab, onStatusSelect, canEditStatus, onRefresh, readOnly,
}: Props) {
  const [showMore, setShowMore] = useState(false);
  const { isAdmin, isManager } = useAuth();
  const [csmOptions, setCsmOptions] = useState<Array<{ id: string; full_name: string }>>([]);

  // Fetch CSM options for dropdown (admin/manager only)
  useEffect(() => {
    if (!isAdmin && !isManager) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
      setCsmOptions(data || []);
    })();
  }, [isAdmin, isManager]);

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
  const ltv = contracts.reduce((sum: number, c: any) => sum + (c.value || 0), 0);
  const overdueInstallments = office.installments_overdue || 0;
  const overdueValue = office.total_overdue_value || 0;
  const mainContact = contacts.find((c: any) => c.is_main_contact) || contacts[0];

  const diasRenovacao = office.cycle_end_date
    ? differenceInDays(new Date(office.cycle_end_date), new Date())
    : daysToRenewal;

  const renewalColor = diasRenovacao === null ? 'text-muted-foreground' : diasRenovacao < 30 ? 'text-red-600' : diasRenovacao < 60 ? 'text-yellow-600' : 'text-green-600';
  const healthColor = !health ? 'text-muted-foreground' : health.band === 'green' ? 'text-green-600' : health.band === 'yellow' ? 'text-yellow-600' : 'text-red-600';

  const saveField = async (column: string, value: string | number | null) => {
    const updateData: Record<string, any> = { [column]: value };

    // If cycle_start_date changed, auto-recalculate cycle_end_date
    if (column === 'cycle_start_date' && value) {
      const d = new Date(value as string);
      d.setMonth(d.getMonth() + 12);
      updateData.cycle_end_date = d.toISOString().split('T')[0];
    }

    const { error } = await supabase.from('offices').update(updateData).eq('id', office.id);
    if (error) throw error;
    toast.success('Campo atualizado!');
    onRefresh?.();
  };

  const tempoDeVida = office.activation_date
    ? (() => {
        const end = office.churn_date ? new Date(office.churn_date) : new Date();
        const months = differenceInMonths(end, new Date(office.activation_date));
        return `${months} meses`;
      })()
    : '—';

  // CSM field type config
  const csmEditable = (isAdmin || isManager) && !readOnly;
  const csmOptionNames = csmOptions.map(c => c.full_name || '');

  const saveCsm = async (newName: string | number | null) => {
    const match = csmOptions.find(c => c.full_name === newName);
    if (!match) throw new Error('CSM não encontrado');
    const { error } = await supabase.from('offices').update({ csm_id: match.id }).eq('id', office.id);
    if (error) throw error;
    toast.success('CSM atualizado!');
    onRefresh?.();
  };

  // Static info fields (top row)
  const infoFields: Array<{ label: string; value: string | number | null; isStatus?: boolean; editable?: boolean; column?: string; fieldType?: any; options?: string[]; customSave?: (v: any) => Promise<void> }> = [
    { label: 'Status', value: null, isStatus: true },
    { label: 'CSM', value: csmProfile?.full_name || '—', editable: csmEditable, fieldType: 'dropdown', options: csmOptionNames, customSave: saveCsm },
    { label: 'Etapa Jornada', value: stageName || '—' },
    { label: 'Produto', value: office.products?.name || '—' },
    { label: 'Cidade', value: office.city || '—', editable: true, column: 'city', fieldType: 'text' },
    { label: 'Estado', value: office.state || '—', editable: true, column: 'state', fieldType: 'text' },
    { label: 'Contato Principal', value: mainContact?.name || '—' },
    { label: 'Data Ativação', value: office.activation_date || null, editable: true, column: 'activation_date', fieldType: 'date' },
  ];

  // Extra fields (expandable)
  const extraFields: Array<{ label: string; value: string | number | null; editable?: boolean; column?: string; fieldType?: any; options?: string[]; customSave?: (v: any) => Promise<void> }> = [
    { label: 'Email', value: office.email, editable: true, column: 'email', fieldType: 'email' },
    { label: 'WhatsApp', value: office.whatsapp, editable: true, column: 'whatsapp', fieldType: 'phone' },
    { label: 'CNPJ', value: office.cnpj, editable: true, column: 'cnpj', fieldType: 'text' },
    { label: 'Faturamento Mensal', value: office.faturamento_mensal, editable: true, column: 'faturamento_mensal', fieldType: 'currency' },
    { label: 'Faturamento Anual', value: office.faturamento_anual, editable: true, column: 'faturamento_anual', fieldType: 'currency' },
    { label: 'Qtd Clientes', value: office.qtd_clientes, editable: true, column: 'qtd_clientes', fieldType: 'number' },
    { label: 'Qtd Colaboradores', value: office.qtd_colaboradores, editable: true, column: 'qtd_colaboradores', fieldType: 'number' },
    { label: 'CS Feeling', value: office.cs_feeling, editable: true, column: 'cs_feeling', fieldType: 'dropdown', options: ['Muito bom', 'Bom', 'Regular', 'Ruim', 'Muito ruim'] },
    { label: 'Segmento', value: office.segment, editable: true, column: 'segment', fieldType: 'text' },
    { label: 'Início do Ciclo', value: office.cycle_start_date, editable: true, column: 'cycle_start_date', fieldType: 'date' },
    { label: 'Fim do Ciclo', value: office.cycle_end_date, editable: true, column: 'cycle_end_date', fieldType: 'date' },
    { label: 'Data Churn', value: office.churn_date, editable: true, column: 'churn_date', fieldType: 'date' },
    { label: 'Tempo de Vida', value: tempoDeVida },
    { label: 'Ciclos', value: String(contracts.length) },
    { label: 'LTV', value: `R$ ${ltv.toLocaleString('pt-BR')}` },
    { label: 'MRR', value: office.mrr ? `R$ ${Number(office.mrr).toLocaleString('pt-BR')}` : '—' },
  ];

  const renderField = (f: typeof infoFields[0], i: number) => (
    <Card key={i} className="p-3">
      <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">{f.label}</div>
      <div className="mt-0.5">
        {f.isStatus && onStatusSelect ? (
          <StatusDropdown status={office.status} onStatusSelect={onStatusSelect} readonly={!canEditStatus} />
        ) : f.editable && (f.column || f.customSave) ? (
          <InlineEditField
            value={f.value}
            fieldType={f.fieldType || 'text'}
            label={f.label}
            readOnly={!!readOnly && !f.customSave}
            options={f.options}
            onSave={f.customSave || ((v) => saveField(f.column!, v))}
          />
        ) : (
          <div className="text-sm font-semibold text-foreground truncate">{f.value != null ? String(f.value) : '—'}</div>
        )}
      </div>
    </Card>
  );

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
      label: 'DIAS P/ RENOVAÇÃO', value: diasRenovacao !== null ? String(diasRenovacao) : '—',
      color: renewalColor, detail: 'VER DETALHES', onClick: () => onNavigateTab('contratos'), icon: Clock,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Info fields grid */}
      <div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {infoFields.map(renderField)}
          <CustomFieldsDisplay officeId={office.id} productId={office.active_product_id} position="body" />
        </div>

        {/* Expandable extra fields */}
        <div className={cn('overflow-hidden transition-all duration-300 ease-in-out', showMore ? 'max-h-[800px] opacity-100 mt-3' : 'max-h-0 opacity-0')}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {extraFields.map(renderField)}
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
                <button onClick={ind.onClick} className="text-[10px] text-primary uppercase font-medium mt-2 hover:underline text-left">
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
