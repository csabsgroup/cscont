import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface BulkDeleteEntity {
  key: string;
  label: string;
  table: string;
  filters?: { key: string; label: string; options: { value: string; label: string }[] }[];
}

export const bulkDeleteEntities: BulkDeleteEntity[] = [
  {
    key: 'offices', label: 'Clientes', table: 'offices',
    filters: [
      { key: 'status', label: 'Status', options: [
        { value: 'ativo', label: 'Ativo' }, { value: 'churn', label: 'Churn' },
        { value: 'nao_renovado', label: 'Não Renovado' }, { value: 'nao_iniciado', label: 'Não Iniciado' },
      ]},
    ],
  },
  { key: 'contacts', label: 'Contatos', table: 'contacts', filters: [] },
  {
    key: 'contracts', label: 'Contratos', table: 'contracts',
    filters: [
      { key: 'status', label: 'Status', options: [
        { value: 'ativo', label: 'Ativo' }, { value: 'encerrado', label: 'Encerrado' },
        { value: 'cancelado', label: 'Cancelado' }, { value: 'pendente', label: 'Pendente' },
      ]},
    ],
  },
  {
    key: 'meetings', label: 'Reuniões', table: 'meetings',
    filters: [
      { key: 'status', label: 'Status', options: [
        { value: 'scheduled', label: 'Agendada' }, { value: 'completed', label: 'Realizada' },
        { value: 'cancelled', label: 'Cancelada' },
      ]},
    ],
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: BulkDeleteEntity;
}

export function BulkDeleteDialog({ open, onOpenChange, entity }: Props) {
  const { user } = useAuth();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [count, setCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState(0);

  const reset = () => {
    setFilters({}); setCount(null); setConfirmation(''); setDeleting(false); setProgress(0);
  };

  useEffect(() => {
    if (open) { reset(); fetchCount({}); }
  }, [open, entity.key]);

  const fetchCount = async (f: Record<string, string>) => {
    setLoadingCount(true);
    let query = supabase.from(entity.table as any).select('id', { count: 'exact', head: true });
    for (const [key, value] of Object.entries(f)) {
      if (value) query = query.eq(key, value);
    }
    const { count: c } = await query;
    setCount(c ?? 0);
    setLoadingCount(false);
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    if (!value) delete newFilters[key];
    setFilters(newFilters);
    fetchCount(newFilters);
  };

  const handleDelete = async () => {
    if (!count || confirmation !== 'EXCLUIR') return;
    setDeleting(true); setProgress(0);

    try {
      // Fetch IDs first
      let query = supabase.from(entity.table as any).select('id');
      for (const [key, value] of Object.entries(filters)) {
        if (value) query = query.eq(key, value);
      }
      const { data: rows } = await query.limit(5000);
      if (!rows || rows.length === 0) { toast.info('Nenhum registro encontrado.'); return; }

      const ids = (rows as any[]).map((r: any) => r.id);
      const chunkSize = 50;
      let deleted = 0;

      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        await supabase.from(entity.table as any).delete().in('id', chunk);
        deleted += chunk.length;
        setProgress(Math.round((deleted / ids.length) * 100));
      }

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          entity_type: entity.table,
          action: 'bulk_delete',
          details: { entity: entity.key, count: deleted, filters },
        });
      }

      toast.success(`${deleted} registros excluídos com sucesso.`);
      onOpenChange(false);
    } catch {
      toast.error('Erro ao excluir registros.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />Excluir {entity.label} em Massa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filters */}
          {entity.filters && entity.filters.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Filtros (opcional)</p>
              {entity.filters.map(f => (
                <Select key={f.key} value={filters[f.key] || ''} onValueChange={v => handleFilterChange(f.key, v)}>
                  <SelectTrigger><SelectValue placeholder={f.label} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {f.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ))}
            </div>
          )}

          {/* Count preview */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
            {loadingCount ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
            ) : (
              <>
                <p className="text-2xl font-bold text-destructive">{count}</p>
                <p className="text-sm text-muted-foreground">registros serão excluídos</p>
              </>
            )}
          </div>

          {/* Confirmation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>Esta ação é <strong>irreversível</strong>.</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Digite <strong>EXCLUIR</strong> para confirmar:
            </p>
            <Input
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
              placeholder="EXCLUIR"
              disabled={deleting}
            />
          </div>

          {deleting && <Progress value={progress} className="h-2" />}

          <Button
            variant="destructive"
            className="w-full"
            disabled={confirmation !== 'EXCLUIR' || !count || count === 0 || deleting}
            onClick={handleDelete}
          >
            {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Excluindo...</> : `Excluir ${count || 0} registros`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
