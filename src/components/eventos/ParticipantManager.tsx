import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserMinus, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isPast } from 'date-fns';

const CONFIRMATION_OPTIONS = [
  { value: 'a_confirmar', label: 'A Confirmar', color: 'bg-muted text-muted-foreground' },
  { value: 'confirmado', label: 'Confirmado', color: 'bg-primary/10 text-primary' },
  { value: 'nao_vai', label: 'Não Vai', color: 'bg-orange-500/10 text-orange-600' },
];

const ATTENDANCE_OPTIONS = [
  { value: 'pendente', label: '—' },
  { value: 'compareceu', label: 'Compareceu', color: 'bg-emerald-500/10 text-emerald-600' },
  { value: 'nao_compareceu', label: 'Não Compareceu', color: 'bg-destructive/10 text-destructive' },
];

interface Participant {
  id: string;
  office_id: string | null;
  confirmed: boolean;
  status?: string;
  offices?: { name: string; status: string } | null;
}

interface Props {
  eventId: string;
  eligibleProductIds: string[];
  readOnly?: boolean;
  eventDate?: string;
}

export function ParticipantManager({ eventId, eligibleProductIds, readOnly, eventDate }: Props) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);

  const eventIsPast = eventDate ? isPast(new Date(eventDate)) : false;

  const fetchParticipants = useCallback(async () => {
    const { data } = await supabase
      .from('event_participants')
      .select('*, offices(name, status)')
      .eq('event_id', eventId);
    setParticipants((data as any[]) || []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { fetchParticipants(); }, [fetchParticipants]);

  const pullActiveOffices = async () => {
    if (eligibleProductIds.length === 0) {
      toast.error('Nenhum produto elegível selecionado');
      return;
    }
    setPulling(true);
    const { data: offices } = await supabase
      .from('offices')
      .select('id')
      .in('active_product_id', eligibleProductIds)
      .eq('status', 'ativo');

    if (!offices || offices.length === 0) {
      toast.info('Nenhum escritório ativo encontrado');
      setPulling(false);
      return;
    }

    const existingIds = new Set(participants.map(p => p.office_id));
    const newOnes = offices.filter(o => !existingIds.has(o.id));

    if (newOnes.length === 0) {
      toast.info('Todos já adicionados');
      setPulling(false);
      return;
    }

    const { error } = await supabase.from('event_participants').insert(
      newOnes.map(o => ({ event_id: eventId, office_id: o.id, confirmed: false, status: 'a_confirmar' }))
    );
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success(`${newOnes.length} escritório(s) adicionado(s)`); fetchParticipants(); }
    setPulling(false);
  };

  const updateConfirmation = async (p: Participant, newStatus: string) => {
    const confirmed = newStatus === 'confirmado';
    await supabase.from('event_participants').update({ status: newStatus, confirmed }).eq('id', p.id);
    fetchParticipants();
  };

  const updateAttendance = async (p: Participant, attendance: string) => {
    if (attendance === 'pendente') {
      const confirmStatus = p.confirmed ? 'confirmado' : 'a_confirmar';
      await supabase.from('event_participants').update({ status: confirmStatus }).eq('id', p.id);
    } else {
      await supabase.from('event_participants').update({ status: attendance }).eq('id', p.id);
    }
    fetchParticipants();
  };

  const removeParticipant = async (id: string) => {
    await supabase.from('event_participants').delete().eq('id', id);
    fetchParticipants();
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>;

  const getConfirmationStatus = (status?: string) => {
    if (status === 'compareceu' || status === 'nao_compareceu') return 'confirmado';
    return status || 'a_confirmar';
  };

  const getAttendanceStatus = (status?: string) => {
    if (status === 'compareceu' || status === 'nao_compareceu') return status;
    return '';
  };

  const getStatusBadge = (status?: string) => {
    const all = [...CONFIRMATION_OPTIONS, ...ATTENDANCE_OPTIONS];
    const opt = all.find(s => s.value === status);
    return opt || CONFIRMATION_OPTIONS[0];
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" /> {participants.length} participante{participants.length !== 1 ? 's' : ''}
        </p>
        {!readOnly && (
          <Button size="sm" variant="outline" onClick={pullActiveOffices} disabled={pulling}>
            {pulling ? 'Puxando...' : 'Puxar Ativos dos Produtos'}
          </Button>
        )}
      </div>
      {participants.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum participante.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Escritório</TableHead>
              <TableHead>Confirmação</TableHead>
              <TableHead>Presença</TableHead>
              {!readOnly && <TableHead className="w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map(p => {
              const confirmVal = getConfirmationStatus(p.status);
              const attendVal = getAttendanceStatus(p.status);
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{p.offices?.name || '—'}</p>
                      <Badge variant="secondary" className="text-[10px] capitalize mt-0.5">{p.offices?.status || '—'}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <Badge className={`text-xs ${getStatusBadge(confirmVal).color}`}>{getStatusBadge(confirmVal).label}</Badge>
                    ) : (
                      <Select value={confirmVal} onValueChange={val => updateConfirmation(p, val)}>
                        <SelectTrigger className="w-[130px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONFIRMATION_OPTIONS.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      attendVal ? <Badge className={`text-xs ${getStatusBadge(attendVal).color}`}>{getStatusBadge(attendVal).label}</Badge> : <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Select value={attendVal} onValueChange={val => updateAttendance(p, val)} disabled={!eventIsPast}>
                        <SelectTrigger className={`w-[150px] h-8 text-xs ${!eventIsPast ? 'opacity-50' : ''}`}>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {ATTENDANCE_OPTIONS.map(s => (
                            <SelectItem key={s.value || 'none'} value={s.value || 'none'}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeParticipant(p.id)}>
                        <UserMinus className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
