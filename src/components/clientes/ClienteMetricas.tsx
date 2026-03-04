import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, DollarSign, BarChart3, Heart } from 'lucide-react';
import { HealthBadge } from './HealthBadge';

interface Props { officeId: string; }

export function ClienteMetricas({ officeId }: Props) {
  const [contracts, setContracts] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const [contractsRes, healthRes] = await Promise.all([
      supabase.from('contracts').select('*').eq('office_id', officeId).order('created_at'),
      supabase.from('health_scores').select('*').eq('office_id', officeId).maybeSingle(),
    ]);
    setContracts(contractsRes.data || []);
    setHealth(healthRes.data);
    setLoading(false);
  }, [officeId]);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const ltv = contracts.reduce((sum, c) => sum + (Number(c.value) || 0), 0);
  const cycles = contracts.length;
  const activeContract = contracts.find(c => c.status === 'ativo');
  const retentionMonths = activeContract?.start_date
    ? Math.floor((Date.now() - new Date(activeContract.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : null;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />LTV
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{ltv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          <p className="text-xs text-muted-foreground">{cycles} ciclo{cycles !== 1 ? 's' : ''} de contrato</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />Retenção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{retentionMonths != null ? `${retentionMonths} meses` : '—'}</p>
          <p className="text-xs text-muted-foreground">Tempo no contrato ativo</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Heart className="h-4 w-4 text-muted-foreground" />Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health ? (
            <>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{Math.round(health.score)}</p>
                <HealthBadge score={health.score} band={health.band} size="md" />
              </div>
              <p className="text-xs text-muted-foreground">Última atualização: {new Date(health.calculated_at).toLocaleDateString('pt-BR')}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda não calculado</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />Parcelas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{activeContract?.installments_overdue ?? 0}</p>
          <p className="text-xs text-muted-foreground">Parcelas vencidas</p>
        </CardContent>
      </Card>
    </div>
  );
}
