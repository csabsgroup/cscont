import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X, UserMinus, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Participant {
  id: string;
  office_id: string | null;
  confirmed: boolean;
  offices?: { name: string; status: string } | null;
}

interface Props {
  eventId: string;
  eligibleProductIds: string[];
  readOnly?: boolean;
}

export function ParticipantManager({ eventId, eligibleProductIds, readOnly }: Props) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);

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
    // Get active offices for eligible products
    const { data: offices } = await supabase
      .from('offices')
      .select('id')
      .in('active_product_id', eligibleProductIds)
      .eq('status', 'ativo');

    if (!offices || offices.length === 0) {
      toast.info('Nenhum escritório ativo encontrado para os produtos elegíveis');
      setPulling(false);
      return;
    }

    const existingIds = new Set(participants.map(p => p.office_id));
    const newOnes = offices.filter(o => !existingIds.has(o.id));

    if (newOnes.length === 0) {
      toast.info('Todos os escritórios elegíveis já foram adicionados');
      setPulling(false);
      return;
    }

    const { error } = await supabase.from('event_participants').insert(
      newOnes.map(o => ({ event_id: eventId, office_id: o.id, confirmed: false }))
    );
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success(`${newOnes.length} escritório(s) adicionado(s)`); fetchParticipants(); }
    setPulling(false);
  };

  const toggleConfirmed = async (p: Participant) => {
    await supabase.from('event_participants').update({ confirmed: !p.confirmed }).eq('id', p.id);
    fetchParticipants();
  };

  const removeParticipant = async (id: string) => {
    await supabase.from('event_participants').delete().eq('id', id);
    fetchParticipants();
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>;

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
              <TableHead>Status</TableHead>
              <TableHead>Confirmado</TableHead>
              {!readOnly && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.offices?.name || '—'}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs capitalize">{p.offices?.status || '—'}</Badge>
                </TableCell>
                <TableCell>
                  {p.confirmed ? (
                    <Badge className="bg-success/10 text-success text-xs">Confirmado</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Pendente</Badge>
                  )}
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleConfirmed(p)}>
                        {p.confirmed ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeParticipant(p.id)}>
                        <UserMinus className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
