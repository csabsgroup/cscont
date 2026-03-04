import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/clientes/StatusBadge';
import { HealthBadge } from '@/components/clientes/HealthBadge';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  stages: { id: string; name: string }[];
  officeJourneys: any[];
  healthScores: Record<string, { score: number; band: string }>;
  contracts: Record<string, any>;
  lastMeetings: Record<string, string>;
  csmProfiles: Record<string, { id: string; full_name: string | null }>;
  activities: Record<string, { total: number; completed: number }>;
}

const ALL_COLUMNS = [
  { key: 'name', label: 'Escritório', default: true },
  { key: 'stage', label: 'Etapa', default: true },
  { key: 'health', label: 'Saúde', default: true },
  { key: 'csm', label: 'CSM', default: true },
  { key: 'tasks', label: 'Tarefas', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'city', label: 'Cidade', default: false },
  { key: 'overdue', label: 'Parcelas Vencidas', default: true },
  { key: 'renewal', label: 'Renovação', default: true },
  { key: 'lastMeeting', label: 'Última Reunião', default: false },
  { key: 'mrr', label: 'MRR', default: true },
  { key: 'activation', label: 'Ativação', default: false },
] as const;

type ColKey = typeof ALL_COLUMNS[number]['key'];

export function JornadaTableView({ stages, officeJourneys, healthScores, contracts, lastMeetings, csmProfiles, activities }: Props) {
  const navigate = useNavigate();
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    new Set(ALL_COLUMNS.filter(c => c.default).map(c => c.key))
  );

  const toggleCol = (key: ColKey) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const stageMap = Object.fromEntries(stages.map(s => [s.id, s.name]));
  const cols = ALL_COLUMNS.filter(c => visibleCols.has(c.key));

  const rows = officeJourneys.map(oj => {
    const health = healthScores[oj.office_id];
    const contract = contracts[oj.office_id];
    const lastMeeting = lastMeetings[oj.office_id];
    const act = activities[oj.office_id] || { total: 0, completed: 0 };
    const csm = oj.offices.csm_id ? csmProfiles[oj.offices.csm_id] : null;

    return {
      id: oj.id,
      officeId: oj.offices.id,
      name: oj.offices.name,
      stage: stageMap[oj.journey_stage_id] || '—',
      health,
      csmName: csm?.full_name || '—',
      tasksTotal: act.total,
      tasksCompleted: act.completed,
      daysSinceMeeting: lastMeeting ? differenceInDays(new Date(), new Date(lastMeeting)) : null,
      daysRenewal: contract?.renewal_date ? differenceInDays(new Date(contract.renewal_date), new Date()) : null,
      status: oj.offices.status,
      city: [oj.offices.city, oj.offices.state].filter(Boolean).join('/') || '—',
      overdue: contract?.installments_overdue || 0,
      mrr: contract?.monthly_value || 0,
      activation: oj.offices?.activation_date || null,
    };
  });

  const renderCell = (row: typeof rows[number], key: ColKey) => {
    switch (key) {
      case 'name': return <span className="font-medium text-xs">{row.name}</span>;
      case 'stage': return <Badge variant="secondary" className="text-[10px]">{row.stage}</Badge>;
      case 'health': return row.health ? <HealthBadge band={row.health.band as any} score={row.health.score} size="sm" /> : <span className="text-muted-foreground text-xs">—</span>;
      case 'csm': return <span className="text-xs text-muted-foreground">{row.csmName}</span>;
      case 'tasks': return <span className="text-xs">{row.tasksCompleted}/{row.tasksTotal}</span>;
      case 'status': return <StatusBadge status={row.status} />;
      case 'city': return <span className="text-xs text-muted-foreground">{row.city}</span>;
      case 'overdue': return row.overdue > 0 ? <span className="text-xs text-destructive font-medium">{row.overdue}</span> : <span className="text-xs text-muted-foreground">0</span>;
      case 'renewal': return row.daysRenewal !== null ? <span className={`text-xs ${row.daysRenewal <= 30 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>{row.daysRenewal}d</span> : <span className="text-xs text-muted-foreground">—</span>;
      case 'lastMeeting': return row.daysSinceMeeting !== null ? <span className={`text-xs ${row.daysSinceMeeting > 30 ? 'text-destructive' : 'text-muted-foreground'}`}>{row.daysSinceMeeting}d</span> : <span className="text-xs text-muted-foreground">—</span>;
      case 'mrr': return <span className="text-xs font-medium">R$ {row.mrr.toLocaleString('pt-BR')}</span>;
      case 'activation': return row.activation ? <span className="text-xs text-muted-foreground">{format(new Date(row.activation), 'dd/MM/yy', { locale: ptBR })}</span> : <span className="text-xs text-muted-foreground">—</span>;
      default: return '—';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Settings2 className="h-3.5 w-3.5" /> Colunas
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            {ALL_COLUMNS.map(col => (
              <label key={col.key} className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-muted/50 rounded cursor-pointer">
                <Checkbox checked={visibleCols.has(col.key)} onCheckedChange={() => toggleCol(col.key)} />
                {col.label}
              </label>
            ))}
          </PopoverContent>
        </Popover>
      </div>
      <div className="rounded-xl border border-border/60 bg-card overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              {cols.map(c => (
                <th key={c.key} className="px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={cols.length} className="text-center py-8 text-muted-foreground text-xs">Nenhum cliente</td></tr>
            ) : rows.map(row => (
              <tr
                key={row.id}
                className="border-t border-border/30 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/clientes/${row.officeId}`)}
              >
                {cols.map(c => (
                  <td key={c.key} className="px-2 py-1.5 whitespace-nowrap">{renderCell(row, c.key)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
