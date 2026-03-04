import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, BarChart3 } from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  ativo: 'hsl(142.1, 76.2%, 36.3%)',
  churn: 'hsl(0, 84.2%, 60.2%)',
  nao_renovado: 'hsl(45.4, 93.4%, 47.5%)',
  nao_iniciado: 'hsl(0, 0%, 65%)',
  upsell: 'hsl(346.8, 77.2%, 49.8%)',
  bonus_elite: 'hsl(280, 60%, 55%)',
};

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo',
  churn: 'Churn',
  nao_renovado: 'Não Renovado',
  nao_iniciado: 'Não Iniciado',
  upsell: 'Upsell',
  bonus_elite: 'Bônus Elite',
};

const CHART_COLORS = [
  'hsl(346.8, 77.2%, 49.8%)',
  'hsl(142.1, 76.2%, 36.3%)',
  'hsl(45.4, 93.4%, 47.5%)',
  'hsl(200, 70%, 50%)',
  'hsl(280, 60%, 55%)',
  'hsl(20, 80%, 55%)',
];

export default function Relatorios() {
  const [offices, setOffices] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [officesRes, contractsRes] = await Promise.all([
      supabase.from('offices').select('*, products:active_product_id(name)'),
      supabase.from('contracts').select('*, products:product_id(name)'),
    ]);
    setOffices(officesRes.data || []);
    setContracts(contractsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">Relatórios</h1></div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // ─── Status distribution ───
  const statusCounts = offices.reduce((acc: Record<string, number>, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});
  const statusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
    color: STATUS_COLORS[status] || 'hsl(0,0%,65%)',
  }));

  // ─── Product distribution ───
  const productCounts = offices.reduce((acc: Record<string, number>, o) => {
    const name = o.products?.name || 'Sem produto';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const productData = Object.entries(productCounts).map(([name, count]) => ({
    name,
    value: count,
  }));

  // ─── Monthly evolution (offices created per month) ───
  const monthlyMap = offices.reduce((acc: Record<string, number>, o) => {
    const month = o.created_at?.substring(0, 7); // YYYY-MM
    if (month) acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});
  const monthlyData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      month: month.split('-').reverse().join('/'),
      novos: count,
    }));

  // ─── Retention: active vs churned over time ───
  const activeCount = offices.filter(o => o.status === 'ativo').length;
  const churnCount = offices.filter(o => o.status === 'churn').length;
  const notRenewed = offices.filter(o => o.status === 'nao_renovado').length;
  const total = offices.length;
  const retentionRate = total > 0 ? ((activeCount / total) * 100).toFixed(1) : '0';

  // ─── Contract values by product ───
  const contractValuesByProduct = contracts.reduce((acc: Record<string, number>, c) => {
    const name = c.products?.name || 'Sem produto';
    acc[name] = (acc[name] || 0) + (c.monthly_value || 0);
    return acc;
  }, {});
  const contractValueData = Object.entries(contractValuesByProduct).map(([name, value]) => ({
    name,
    mrr: value,
  }));

  // ─── Contract status ───
  const contractStatusCounts = contracts.reduce((acc: Record<string, number>, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});
  const contractStatusLabels: Record<string, string> = {
    ativo: 'Ativo', encerrado: 'Encerrado', cancelado: 'Cancelado', pendente: 'Pendente',
  };
  const contractStatusData = Object.entries(contractStatusCounts).map(([status, count]) => ({
    name: contractStatusLabels[status] || status,
    value: count,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Análises e métricas da carteira — {offices.length} escritório{offices.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total de Clientes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ativos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-success">{activeCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Churn + Não Renovado</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{churnCount + notRenewed}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Taxa de Retenção</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{retentionRate}%</div></CardContent>
        </Card>
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status distribution */}
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Status</CardTitle></CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Product distribution */}
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Produto</CardTitle></CardHeader>
          <CardContent>
            {productData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={productData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <Tooltip />
                  <Bar dataKey="value" name="Escritórios" radius={[4, 4, 0, 0]}>
                    {productData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly evolution */}
        <Card>
          <CardHeader><CardTitle className="text-base">Evolução Mensal (novos clientes)</CardTitle></CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <Tooltip />
                  <Area type="monotone" dataKey="novos" name="Novos" stroke="hsl(346.8, 77.2%, 49.8%)" fill="hsl(346.8, 77.2%, 49.8%)" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* MRR by product */}
        <Card>
          <CardHeader><CardTitle className="text-base">MRR por Produto</CardTitle></CardHeader>
          <CardContent>
            {contractValueData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={contractValueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                  <Bar dataKey="mrr" name="MRR" radius={[4, 4, 0, 0]}>
                    {contractValueData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contract status */}
      <Card>
        <CardHeader><CardTitle className="text-base">Status dos Contratos</CardTitle></CardHeader>
        <CardContent>
          {contractStatusData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={contractStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {contractStatusData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <BarChart3 className="mb-2 h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Sem dados para exibir</p>
    </div>
  );
}
