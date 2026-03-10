import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ActivityEditDrawer } from './ActivityEditDrawer';
import { MoreVertical, CheckCircle2, XCircle, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface Activity {
  id: string;
  title: string;
  description: string | null;
  completed_at: string | null;
  observations?: string | null;
  completion_outcome?: string | null;
}

interface Props {
  activity: Activity;
  onRefresh: () => void;
  readOnly?: boolean;
}

export function ActivityPopup({ activity, onRefresh, readOnly }: Props) {
  const [completeOpen, setCompleteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [observations, setObservations] = useState('');
  const [saving, setSaving] = useState(false);
  const [outcomeType, setOutcomeType] = useState<'success' | 'no_show'>('success');

  const handleComplete = async () => {
    if (!observations.trim()) {
      toast.error('Observações são obrigatórias.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('activities').update({
      completed_at: new Date().toISOString(),
      observations: observations,
      completion_outcome: outcomeType,
    } as any).eq('id', activity.id);
    if (error) toast.error('Erro: ' + error.message);
    else {
      toast.success(outcomeType === 'success' ? 'Atividade concluída!' : 'Atividade concluída sem êxito.');
      setCompleteOpen(false);
      onRefresh();
    }
    setSaving(false);
  };

  const handleReopen = async () => {
    const { error } = await supabase.from('activities').update({
      completed_at: null,
      completion_outcome: null,
    } as any).eq('id', activity.id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Atividade reaberta!'); onRefresh(); }
  };

  const handleDelete = async () => {
    if (!confirm('Excluir esta atividade?')) return;
    const { error } = await supabase.from('activities').delete().eq('id', activity.id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Atividade excluída!'); onRefresh(); }
  };

  if (readOnly) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => setDrawerOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Detalhes
          </DropdownMenuItem>
          {!activity.completed_at ? (
            <>
              <DropdownMenuItem onClick={() => { setOutcomeType('success'); setObservations(''); setCompleteOpen(true); }}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Concluir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setOutcomeType('no_show'); setObservations(''); setCompleteOpen(true); }}>
                <XCircle className="h-4 w-4 mr-2" /> Sem êxito
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={handleReopen}>
              <RotateCcw className="h-4 w-4 mr-2" /> Reabrir
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Complete dialog with observations (REQUIRED) */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {outcomeType === 'success' ? '✅ Concluir' : '❌ Sem êxito'}: {activity.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Observações *</Label>
              <Textarea
                value={observations}
                onChange={e => setObservations(e.target.value)}
                placeholder={outcomeType === 'success'
                  ? 'Descreva as observações sobre a conclusão (obrigatório)...'
                  : 'Descreva o motivo (no-show, cancelamento, etc)...'
                }
                rows={4}
              />
            </div>
            <Button
              onClick={handleComplete}
              className="w-full"
              disabled={saving || !observations.trim()}
              variant={outcomeType === 'no_show' ? 'destructive' : 'default'}
            >
              {saving ? 'Concluindo...' : outcomeType === 'success' ? 'Concluir Atividade' : 'Registrar sem êxito'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Activity Edit Drawer */}
      <ActivityEditDrawer
        activityId={activity.id}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={onRefresh}
        readOnly={readOnly}
      />
    </>
  );
}
