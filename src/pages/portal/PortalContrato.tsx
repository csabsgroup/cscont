import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function PortalContrato() {
  const { officeId } = usePortal();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!officeId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from('contracts').select('*, products:product_id(name)').eq('office_id', officeId).order('created_at', { ascending: false });
      setContracts(data || []);
      setLoading(false);
    })();
  }, [officeId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const statusColors: Record<string, string> = { ativo: 'default', encerrado: 'secondary', cancelado: 'destructive', pendente: 'outline' };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Meu Contrato</h1>
      {contracts.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum contrato encontrado.</CardContent></Card>
      ) : (
        contracts.map(c => (
          <Card key={c.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{c.products?.name || 'Produto'}</CardTitle>
                <Badge variant={statusColors[c.status] as any}>{c.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Valor:</span><p className="font-medium">R$ {c.value?.toLocaleString('pt-BR') || '—'}</p></div>
                <div><span className="text-muted-foreground">Mensal:</span><p className="font-medium">R$ {c.monthly_value?.toLocaleString('pt-BR') || '—'}</p></div>
                <div><span className="text-muted-foreground">Início:</span><p className="font-medium">{c.start_date ? format(new Date(c.start_date), 'dd/MM/yyyy') : '—'}</p></div>
                <div><span className="text-muted-foreground">Fim:</span><p className="font-medium">{c.end_date ? format(new Date(c.end_date), 'dd/MM/yyyy') : '—'}</p></div>
                <div><span className="text-muted-foreground">Renovação:</span><p className="font-medium">{c.renewal_date ? format(new Date(c.renewal_date), 'dd/MM/yyyy') : '—'}</p></div>
                <div><span className="text-muted-foreground">Parcelas totais:</span><p className="font-medium">{c.installments_total || 0}</p></div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
