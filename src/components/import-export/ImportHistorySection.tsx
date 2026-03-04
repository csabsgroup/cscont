import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { History, Undo2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ImportBatch {
  id: string;
  user_id: string;
  entity_type: string;
  table_name: string;
  record_ids: string[];
  record_count: number;
  created_at: string;
  undone_at: string | null;
}

const entityLabels: Record<string, string> = {
  offices: 'Clientes', contacts: 'Contatos', contracts: 'Contratos',
  meetings: 'Reuniões', nps_csat: 'NPS/CSAT',
};

export function ImportHistorySection() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [confirmBatch, setConfirmBatch] = useState<ImportBatch | null>(null);

  const fetchBatches = async () => {
    const { data } = await supabase
      .from('import_batches' as any)
      .select('*')
      .is('undone_at', null)
      .order('created_at', { ascending: false })
      .limit(20);
    setBatches((data as any[] as ImportBatch[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchBatches(); }, []);

  const handleUndo = async (batch: ImportBatch) => {
    setUndoing(batch.id);
    try {
      const chunkSize = 50;
      const ids = batch.record_ids;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        await supabase.from(batch.table_name as any).delete().in('id', chunk);
      }

      await supabase.from('import_batches' as any)
        .update({ undone_at: new Date().toISOString() } as any)
        .eq('id', batch.id);

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          entity_type: batch.table_name,
          action: 'undo_import',
          details: { batch_id: batch.id, entity: batch.entity_type, count: batch.record_count },
        });
      }

      toast.success(`Importação desfeita: ${batch.record_count} registros removidos.`);
      fetchBatches();
    } catch {
      toast.error('Erro ao desfazer importação.');
    } finally {
      setUndoing(null);
      setConfirmBatch(null);
    }
  };

  if (loading) return null;
  if (batches.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />Histórico de Importações
        </h3>
        <p className="text-sm text-muted-foreground">Importações recentes que podem ser desfeitas.</p>
      </div>
      <div className="space-y-2">
        {batches.map(batch => (
          <Card key={batch.id}>
            <CardContent className="flex items-center justify-between py-3 px-4">
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{entityLabels[batch.entity_type] || batch.entity_type}</Badge>
                <span className="text-sm font-medium">{batch.record_count} registros</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(batch.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                disabled={undoing === batch.id}
                onClick={() => setConfirmBatch(batch)}
              >
                {undoing === batch.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                Desfazer
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!confirmBatch} onOpenChange={(o) => !o && setConfirmBatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer importação?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá permanentemente <strong>{confirmBatch?.record_count}</strong> registros
              de <strong>{entityLabels[confirmBatch?.entity_type || ''] || confirmBatch?.entity_type}</strong>.
              Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmBatch && handleUndo(confirmBatch)}>
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
