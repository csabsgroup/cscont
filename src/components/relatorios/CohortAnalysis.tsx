import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart3 } from 'lucide-react';
import { addMonths, format, differenceInMonths, subMonths } from 'date-fns';

interface CohortAnalysisProps {
  offices: any[];
  filterProduct: string;
}

type CohortType = 'retention' | 'churn_accumulated' | 'mrr';
type GroupType = 'month' | 'quarter';

function getCohortColor(value: number, type: CohortType): string {
  if (type === 'mrr') {
    // For MRR, use blue gradient
    const intensity = Math.min(100, Math.max(0, value));
    if (intensity >= 80) return 'hsl(142.1, 76.2%, 36.3%)';
    if (intensity >= 50) return 'hsl(45.4, 93.4%, 47.5%)';
    return 'hsl(0, 84.2%, 60.2%)';
  }
  if (type === 'churn_accumulated') {
    // Inverted: higher churn = worse
    if (value <= 20) return 'hsl(142.1, 76.2%, 36.3%)';
    if (value <= 50) return 'hsl(45.4, 93.4%, 47.5%)';
    return 'hsl(0, 84.2%, 60.2%)';
  }
  // Retention
  if (value >= 80) return 'hsl(142.1, 76.2%, 36.3%)';
  if (value >= 50) return 'hsl(45.4, 93.4%, 47.5%)';
  return 'hsl(0, 84.2%, 60.2%)';
}

function getCellBgClass(value: number, type: CohortType): string {
  if (type === 'churn_accumulated') {
    if (value <= 10) return 'bg-green-500/20 dark:bg-green-500/30';
    if (value <= 20) return 'bg-green-500/10 dark:bg-green-500/15';
    if (value <= 35) return 'bg-yellow-500/15 dark:bg-yellow-500/20';
    if (value <= 50) return 'bg-yellow-500/25 dark:bg-yellow-500/30';
    return 'bg-red-500/20 dark:bg-red-500/30';
  }
  // retention or mrr %
  if (value >= 90) return 'bg-green-500/20 dark:bg-green-500/30';
  if (value >= 80) return 'bg-green-500/10 dark:bg-green-500/15';
  if (value >= 65) return 'bg-yellow-500/15 dark:bg-yellow-500/20';
  if (value >= 50) return 'bg-yellow-500/25 dark:bg-yellow-500/30';
  return 'bg-red-500/20 dark:bg-red-500/30';
}

export default function CohortAnalysis({ offices, filterProduct }: CohortAnalysisProps) {
  const [cohortType, setCohortType] = useState<CohortType>('retention');
  const [groupType, setGroupType] = useState<GroupType>('month');
  const [monthsToShow, setMonthsToShow] = useState(12);

  const filteredOffices = useMemo(() => {
    let list = offices.filter((o: any) => o.activation_date);
    if (filterProduct !== 'all') list = list.filter((o: any) => o.active_product_id === filterProduct);
    return list;
  }, [offices, filterProduct]);

  const cohortData = useMemo(() => {
    const now = new Date();
    const cutoff = subMonths(now, monthsToShow);
    const cohorts: Record<string, { total: number; totalMRR: number; retention: { month: number; count: number; percent: number; mrr: number; mrrPercent: number }[] }> = {};

    // Group offices by activation month
    const grouped: Record<string, any[]> = {};
    filteredOffices.forEach((o: any) => {
      const activationDate = new Date(o.activation_date);
      if (activationDate < cutoff) return;
      let key: string;
      if (groupType === 'quarter') {
        const q = Math.ceil((activationDate.getMonth() + 1) / 3);
        key = `Q${q} ${activationDate.getFullYear()}`;
      } else {
        key = format(activationDate, 'yyyy-MM');
      }
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(o);
    });

    // Calculate retention for each cohort
    const maxMonths = 12;
    Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([cohortKey, cohortOffices]) => {
        const total = cohortOffices.length;
        const totalMRR = cohortOffices.reduce((s: number, o: any) => s + (Number(o.mrr) || 0), 0);
        const retention: typeof cohorts[string]['retention'] = [];

        for (let monthOffset = 0; monthOffset <= maxMonths; monthOffset++) {
          const checkDate = addMonths(new Date(cohortKey.includes('Q') ? getQuarterStart(cohortKey) : cohortKey + '-01'), monthOffset);
          if (checkDate > now) break;

          const activeOffices = cohortOffices.filter((o: any) => {
            if (o.churn_date && new Date(o.churn_date) <= checkDate) return false;
            if (['churn', 'nao_renovado'].includes(o.status) && !o.churn_date) {
              const updatedAt = new Date(o.updated_at);
              if (updatedAt <= checkDate) return false;
            }
            return true;
          });

          const activeCount = activeOffices.length;
          const activeMRR = activeOffices.reduce((s: number, o: any) => s + (Number(o.mrr) || 0), 0);

          retention.push({
            month: monthOffset,
            count: activeCount,
            percent: total > 0 ? Math.round((activeCount / total) * 100) : 0,
            mrr: activeMRR,
            mrrPercent: totalMRR > 0 ? Math.round((activeMRR / totalMRR) * 100) : 0,
          });
        }

        cohorts[cohortKey] = { total, totalMRR, retention };
      });

    return cohorts;
  }, [filteredOffices, groupType, monthsToShow]);

  const cohortKeys = Object.keys(cohortData).sort();
  const maxCols = Math.max(0, ...Object.values(cohortData).map(c => c.retention.length));

  if (filteredOffices.length === 0 || cohortKeys.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Sem dados de ativação para gerar cohort. Preencha a data de ativação nos escritórios.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Tipo de Cohort</Label>
          <Select value={cohortType} onValueChange={v => setCohortType(v as CohortType)}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="retention">Retenção mensal por safra</SelectItem>
              <SelectItem value="churn_accumulated">Churn acumulado por safra</SelectItem>
              <SelectItem value="mrr">Evolução de MRR por safra</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Agrupar safra por</Label>
          <Select value={groupType} onValueChange={v => setGroupType(v as GroupType)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mês de ativação</SelectItem>
              <SelectItem value="quarter">Trimestre de ativação</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Período</Label>
          <Select value={String(monthsToShow)} onValueChange={v => setMonthsToShow(Number(v))}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
              <SelectItem value="18">Últimos 18 meses</SelectItem>
              <SelectItem value="24">Últimos 24 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Heatmap Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {cohortType === 'retention' && 'Retenção Mensal por Safra (%)'}
            {cohortType === 'churn_accumulated' && 'Churn Acumulado por Safra (%)'}
            {cohortType === 'mrr' && 'Evolução de MRR Retido por Safra (%)'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-2 font-semibold text-muted-foreground border-b border-border min-w-[100px] sticky left-0 bg-card z-10">
                    Safra
                  </th>
                  <th className="text-center py-2 px-1 font-semibold text-muted-foreground border-b border-border min-w-[48px]">
                    N
                  </th>
                  {Array.from({ length: maxCols }, (_, i) => (
                    <th key={i} className="text-center py-2 px-1 font-semibold text-muted-foreground border-b border-border min-w-[48px]">
                      M{i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohortKeys.map(key => {
                  const cohort = cohortData[key];
                  return (
                    <tr key={key}>
                      <td className="py-1.5 px-2 font-medium border-b border-border/50 sticky left-0 bg-card z-10">
                        {key}
                      </td>
                      <td className="text-center py-1.5 px-1 border-b border-border/50 font-medium text-muted-foreground">
                        {cohort.total}
                      </td>
                      {Array.from({ length: maxCols }, (_, i) => {
                        const entry = cohort.retention[i];
                        if (!entry) return <td key={i} className="border-b border-border/50" />;

                        let displayValue: number;
                        let tooltipText: string;

                        if (cohortType === 'retention') {
                          displayValue = entry.percent;
                          tooltipText = `${entry.count}/${cohort.total} clientes (${entry.percent}%)`;
                        } else if (cohortType === 'churn_accumulated') {
                          displayValue = 100 - entry.percent;
                          tooltipText = `${cohort.total - entry.count} churns de ${cohort.total} (${100 - entry.percent}%)`;
                        } else {
                          displayValue = entry.mrrPercent;
                          tooltipText = `R$ ${entry.mrr.toLocaleString('pt-BR')} de R$ ${cohort.totalMRR.toLocaleString('pt-BR')} (${entry.mrrPercent}%)`;
                        }

                        return (
                          <td key={i} className="border-b border-border/50 p-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={`text-center py-1.5 px-1 font-medium cursor-default ${getCellBgClass(displayValue, cohortType)}`}>
                                  {displayValue}%
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs">{tooltipText}</p>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getQuarterStart(qStr: string): string {
  const match = qStr.match(/Q(\d) (\d{4})/);
  if (!match) return '2025-01-01';
  const q = Number(match[1]);
  const y = match[2];
  const m = String((q - 1) * 3 + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}
