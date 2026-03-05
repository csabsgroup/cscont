import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo',
  churn: 'Churn',
  nao_renovado: 'Não Renovado',
  nao_iniciado: 'Não Iniciado',
  upsell: 'Upsell',
  bonus_elite: 'Bônus Elite',
  pausado: 'Pausado',
};

const CHURN_STATUSES = ['churn', 'nao_renovado', 'nao_iniciado'];
const ACTIVE_STATUSES = ['ativo', 'upsell', 'bonus_elite'];

interface ChurnReason {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officeId: string;
  officeName: string;
  currentStatus: string;
  targetStatus: string;
  onStatusChanged: () => void;
}

export function StatusChangeModal({
  open, onOpenChange, officeId, officeName, currentStatus, targetStatus, onStatusChanged,
}: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [churnDate, setChurnDate] = useState<Date>(new Date());
  const [churnReasonId, setChurnReasonId] = useState('');
  const [churnObservation, setChurnObservation] = useState('');
  const [reasons, setReasons] = useState<ChurnReason[]>([]);

  const isChurnLike = CHURN_STATUSES.includes(targetStatus);
  const isReactivation = ACTIVE_STATUSES.includes(targetStatus) && CHURN_STATUSES.includes(currentStatus);

  useEffect(() => {
    if (open && isChurnLike) {
      supabase.from('churn_reasons').select('*').eq('is_active', true).order('sort_order')
        .then(({ data }) => setReasons((data as ChurnReason[]) || []));
      setChurnDate(new Date());
      setChurnReasonId('');
      setChurnObservation('');
    }
  }, [open, isChurnLike]);

  const canConfirm = isChurnLike
    ? churnDate && churnReasonId
    : true;

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const updatePayload: Record<string, any> = { status: targetStatus };

      if (isChurnLike) {
        updatePayload.churn_date = format(churnDate, 'yyyy-MM-dd');
        updatePayload.churn_reason_id = churnReasonId;
        updatePayload.churn_observation = churnObservation || null;
      }

      if (isReactivation) {
        updatePayload.churn_date = null;
        updatePayload.churn_reason_id = null;
        updatePayload.churn_observation = null;
      }

      const { error } = await supabase.from('offices').update(updatePayload).eq('id', officeId);
      if (error) throw error;

      // Audit log
      const reasonName = reasons.find(r => r.id === churnReasonId)?.name;
      await supabase.from('audit_logs').insert({
        user_id: user!.id,
        action: 'status_changed',
        entity_type: 'office',
        entity_id: officeId,
        details: {
          office_name: officeName,
          from_status: currentStatus,
          to_status: targetStatus,
          ...(isChurnLike ? { churn_date: format(churnDate, 'yyyy-MM-dd'), churn_reason: reasonName, churn_observation: churnObservation } : {}),
        },
      });

      // Trigger automations
      try {
        await supabase.functions.invoke('execute-automations', {
          body: {
            action: 'triggerV2',
            trigger_type: 'office.status_changed',
            office_id: officeId,
            context: { from: currentStatus, to: targetStatus, suffix: `${currentStatus}_${targetStatus}` },
          },
        });
      } catch (autoErr) {
        console.error('Automation trigger failed:', autoErr);
      }

      toast.success(`Status alterado para ${STATUS_LABELS[targetStatus] || targetStatus}!`);
      onStatusChanged();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const statusColor = isChurnLike ? 'text-destructive' : 'text-primary';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Alterar Status para: <span className={statusColor}>{STATUS_LABELS[targetStatus] || targetStatus}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isChurnLike && (
            <>
              <div className="space-y-2">
                <Label>Data do Churn *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('w-full justify-start text-left font-normal', !churnDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {churnDate ? format(churnDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={churnDate}
                      onSelect={(d) => d && setChurnDate(d)}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Motivo do Churn *</Label>
                <Select value={churnReasonId} onValueChange={setChurnReasonId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                  <SelectContent>
                    {reasons.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Observação</Label>
                <Textarea
                  placeholder="Adicione uma observação sobre o churn..."
                  value={churnObservation}
                  onChange={e => setChurnObservation(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Esta ação registrará o churn do cliente na data informada.</span>
              </div>
            </>
          )}

          {!isChurnLike && (
            <p className="text-sm text-muted-foreground">
              Confirma a mudança de status de <strong>{STATUS_LABELS[currentStatus] || currentStatus}</strong> para{' '}
              <strong className={statusColor}>{STATUS_LABELS[targetStatus] || targetStatus}</strong>?
              {isReactivation && ' Os dados de churn serão limpos.'}
              {targetStatus === 'pausado' && ' O health score será congelado e automações pausadas.'}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button
            variant={isChurnLike ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={!canConfirm || saving}
          >
            {saving ? 'Salvando...' : isChurnLike ? 'Confirmar Churn' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
