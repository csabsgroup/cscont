import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/clientes/StatusBadge';
import { HealthBadge } from '@/components/clientes/HealthBadge';
import { differenceInDays } from 'date-fns';
import { ArrowUpDown } from 'lucide-react';
import { useState } from 'react';

interface Props {
  stages: { id: string; name: string }[];
  officeJourneys: any[];
  healthScores: Record<string, { score: number; band: string }>;
  contracts: Record<string, any>;
  lastMeetings: Record<string, string>;
  csmProfiles: Record<string, { id: string; full_name: string | null }>;
  activities: Record<string, { total: number; completed: number }>;
}

type SortKey = 'name' | 'stage' | 'health' | 'csm' | 'tasks' | 'lastMeeting' | 'renewal' | 'status';

export function JornadaListView({ stages, officeJourneys, healthScores, contracts, lastMeetings, csmProfiles, activities }: Props) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const stageMap = Object.fromEntries(stages.map(s => [s.id, s.name]));

  const rows = officeJourneys.map(oj => {
    const health = healthScores[oj.office_id];
    const contract = contracts[oj.office_id];
    const lastMeeting = lastMeetings[oj.office_id];
    const act = activities[oj.office_id] || { total: 0, completed: 0 };
    const daysRenewal = contract?.renewal_date ? differenceInDays(new Date(contract.renewal_date), new Date()) : null;
    const daysSinceMeeting = lastMeeting ? differenceInDays(new Date(), new Date(lastMeeting)) : null;
    const csm = oj.offices.csm_id ? csmProfiles[oj.offices.csm_id] : null;

    return {
      id: oj.id,
      officeId: oj.offices.id,
      name: oj.offices.name,
      stage: stageMap[oj.journey_stage_id] || '—',
      healthScore: health?.score ?? -1,
      healthBand: health?.band ?? null,
      csmName: csm?.full_name || '—',
      tasksTotal: act.total,
      tasksCompleted: act.completed,
      daysSinceMeeting,
      daysRenewal,
      status: oj.offices.status,
    };
  });

  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'stage': cmp = a.stage.localeCompare(b.stage); break;
      case 'health': cmp = a.healthScore - b.healthScore; break;
      case 'csm': cmp = a.csmName.localeCompare(b.csmName); break;
      case 'tasks': cmp = a.tasksCompleted - b.tasksCompleted; break;
      case 'lastMeeting': cmp = (a.daysSinceMeeting ?? 999) - (b.daysSinceMeeting ?? 999); break;
      case 'renewal': cmp = (a.daysRenewal ?? 999) - (b.daysRenewal ?? 999); break;
      case 'status': cmp = a.status.localeCompare(b.status); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortHeader = ({ label, colKey }: { label: string; colKey: SortKey }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase cursor-pointer hover:text-foreground select-none"
      onClick={() => toggleSort(colKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </span>
    </th>
  );

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <SortHeader label="Escritório" colKey="name" />
            <SortHeader label="Etapa" colKey="stage" />
            <SortHeader label="Saúde" colKey="health" />
            <SortHeader label="CSM" colKey="csm" />
            <SortHeader label="Tarefas" colKey="tasks" />
            <SortHeader label="Última Reunião" colKey="lastMeeting" />
            <SortHeader label="Renovação" colKey="renewal" />
            <SortHeader label="Status" colKey="status" />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Nenhum cliente na jornada</td></tr>
          ) : sorted.map(row => (
            <tr
              key={row.id}
              className="border-t border-border/40 hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => navigate(`/clientes/${row.officeId}`)}
            >
              <td className="px-3 py-2.5 font-medium">{row.name}</td>
              <td className="px-3 py-2.5">
                <Badge variant="secondary" className="text-xs">{row.stage}</Badge>
              </td>
              <td className="px-3 py-2.5">
                {row.healthBand ? (
                  <HealthBadge band={row.healthBand as any} score={row.healthScore} />
                ) : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{row.csmName}</td>
              <td className="px-3 py-2.5">
                <span className="text-xs">{row.tasksCompleted}/{row.tasksTotal}</span>
              </td>
              <td className="px-3 py-2.5">
                {row.daysSinceMeeting !== null ? (
                  <span className={`text-xs ${row.daysSinceMeeting > 30 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    {row.daysSinceMeeting}d atrás
                  </span>
                ) : <span className="text-muted-foreground text-xs">—</span>}
              </td>
              <td className="px-3 py-2.5">
                {row.daysRenewal !== null ? (
                  <span className={`text-xs ${row.daysRenewal <= 30 ? 'text-destructive font-medium' : row.daysRenewal <= 60 ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
                    {row.daysRenewal}d
                  </span>
                ) : <span className="text-muted-foreground text-xs">—</span>}
              </td>
              <td className="px-3 py-2.5"><StatusBadge status={row.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
