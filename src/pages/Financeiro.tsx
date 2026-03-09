import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Financeiro() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, o] = await Promise.all([
        supabase.from('contracts').select('*, offices(name, installments_overdue, total_overdue_value), products:product_id(name)'),
        supabase.from('offices').select('id, name, installments_overdue, total_overdue_value'),
      ]);
      setContracts(c.data || []);
      setOffices(o.data || []);
      setLoading(false);
    })();
  }, []);

  const activeContracts = contracts.filter(c => c.status === 'ativo');
  const mrr = activeContracts.reduce((s, c) => s + (c.monthly_value || 0), 0);
  // Inadimplência total vem das offices (sincronizado do Asaas)
  const totalOverdue = offices.reduce((s, o) => s + (o.installments_overdue || 0), 0);
  const overdueValue = offices.reduce((s, o) => s + (o.total_overdue_value || 0), 0);
  // Escritórios com inadimplência
  const overdueOffices = offices.filter(o => (o.installments_overdue || 0) > 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6"><div className="h-8 bg-muted rounded w-20" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Visão financeira consolidada dos contratos</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">{activeContracts.length} contratos ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parcelas Vencidas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{totalOverdue}</div>
            <p className="text-xs text-muted-foreground">{overdueContracts.length} contratos com atraso</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor em Atraso</CardTitle>
            <TrendingUp className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">R$ {overdueValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Total Asaas overdue</p>
          </CardContent>
        </Card>
      </div>

      {overdueOffices.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Escritórios com Inadimplência</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Parcelas Vencidas</TableHead>
                  <TableHead>Valor em Atraso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueOffices.map(o => (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/clientes/${o.id}`)}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell><Badge variant="destructive">{o.installments_overdue}</Badge></TableCell>
                    <TableCell>R$ {(o.total_overdue_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
