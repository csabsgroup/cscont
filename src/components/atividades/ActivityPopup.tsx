import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ActivityChecklist } from './ActivityChecklist';
import { MoreVertical, CheckCircle2, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface Activity {
  id: string;
  title: string;
  description: string | null;
  completed_at: string | null;
  observations?: string | null;
}

interface Props {
  activity: Activity;
  onRefresh: () => void;
  readOnly?: boolean;
}

export function ActivityPopup({ activity, onRefresh, readOnly }: Props) {
  const [completeOpen, setCompleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [observations, setObservations] = useState('');
  const [saving, setSaving] = useState(false);

  const handleComplete = async () => {
    setSaving(true);
    const { error } = await supabase.from('activities').update({
      completed_at: new Date().toISOString(),
      observations: observations || null,
    } as any).eq('id', activity.id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Atividade concluída!'); setCompleteOpen(false); onRefresh(); }
    setSaving(false);
  };

  const handleReopen = async () => {
    const { error } = await supabase.from('activities').update({
      completed_at: null,
    }).eq('id', activity.id);
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
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setDetailOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Detalhes
          </DropdownMenuItem>
          {!activity.completed_at ? (
            <DropdownMenuItem onClick={() => setCompleteOpen(true)}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Concluir
            </DropdownMenuItem>
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

      {/* Complete dialog with observations */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir: {activity.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={observations}
                onChange={e => setObservations(e.target.value)}
                placeholder="Observações sobre a conclusão..."
                rows={4}
              />
            </div>
            <Button onClick={handleComplete} className="w-full" disabled={saving}>
              {saving ? 'Concluindo...' : 'Concluir Atividade'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog with checklist */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activity.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {activity.description && (
              <p className="text-sm text-muted-foreground">{activity.description}</p>
            )}
            {activity.observations && (
              <div>
                <Label className="text-xs">Observações</Label>
                <p className="text-sm text-muted-foreground mt-1">{activity.observations}</p>
              </div>
            )}
            <div>
              <Label className="text-xs">Subtarefas</Label>
              <div className="mt-2">
                <ActivityChecklist activityId={activity.id} />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
