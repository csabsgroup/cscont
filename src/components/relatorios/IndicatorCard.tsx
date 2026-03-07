import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pin } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { computeIndicator, type SavedIndicator, type IndicatorConfig } from './IndicatorBuilder';

const CHART_COLORS = [
  'hsl(var(--primary))', 'hsl(142.1,76.2%,36.3%)', 'hsl(45.4,93.4%,47.5%)',
  'hsl(200,70%,50%)', 'hsl(280,60%,55%)', 'hsl(20,80%,55%)',
];

interface IndicatorCardProps {
  indicator: SavedIndicator;
  dataContext: {
    offices: any[];
    contracts: any[];
    activities: any[];
    meetings: any[];
    healthScores: any[];
    metricsHistory: any[];
    formSubmissions: any[];
    events: any[];
    bonusGrants: any[];
    products: any[];
    csmUsers: any[];
    profileMap: Map<string, string>;
  };
}

export default function IndicatorCard({ indicator, dataContext }: IndicatorCardProps) {
  const result = computeIndicator(indicator.config, dataContext);
  const vizType = indicator.visualization_type;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{indicator.name}</CardTitle>
          {indicator.pinned_to_dashboard && (
            <Pin className="h-3.5 w-3.5 text-primary fill-primary" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {vizType === 'number' || result.chartData.length === 0 ? (
          <div className="flex items-center justify-center py-3">
            <span className="text-2xl font-bold text-foreground">
              {typeof result.value === 'number' ? result.value.toLocaleString('pt-BR') : result.value}
            </span>
          </div>
        ) : vizType === 'line' ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={result.chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : vizType === 'bar' ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={result.chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {result.chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : vizType === 'pie' ? (
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={result.chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55}>
                {result.chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="max-h-40 overflow-y-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border">
                <th className="text-left py-1 px-1.5 text-muted-foreground">Nome</th>
                <th className="text-right py-1 px-1.5 text-muted-foreground">Valor</th>
              </tr></thead>
              <tbody>
                {result.tableData.map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1 px-1.5">{row.name}</td>
                    <td className="py-1 px-1.5 text-right font-medium">{typeof row.value === 'number' ? row.value.toLocaleString('pt-BR') : row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
