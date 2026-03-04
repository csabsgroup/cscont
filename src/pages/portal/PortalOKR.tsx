import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { recalculateHealth } from '@/lib/health-engine';

const statusLabels: Record<string, string> = { pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluído', cancelled: 'Cancelado' };

export default function PortalOKR() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    const { data: links } = await supabase.from('client_office_links').select('office_id').eq('user_id', user.id);
    const oid = links?.[0]?.office_id;
    setOfficeId(oid || null);
    if (!oid) { setLoading(false); return; }
    const { data } = await supabase.from('action_plans').select('*').eq('office_id', oid).order('created_at');
    setPlans(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const updatePlan = async (id: string, patch: any) => {
    const { error } = await supabase.from('action_plans').update(patch).eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else {
      toast.success('Atualizado!');
      if (officeId) recalculateHealth(officeId);
      fetch();
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const done = plans.filter(p => p.status === 'done').length;
  const progress = plans.length > 0 ? Math.round((done / plans.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plano de Ação</h1>
        <div className="mt-2 flex items-center gap-3">
          <Progress value={progress} className="flex-1 h-2" />
          <span className="text-sm font-medium">{progress}%</span>
        </div>
      </div>
      {plans.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma tarefa no plano de ação.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <Card key={plan.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium">{plan.title}</p>
                  {plan.description && <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>}
                  {plan.due_date && <p className="text-xs text-muted-foreground mt-1">Prazo: {plan.due_date}</p>}
                </div>
                <Select value={plan.status} onValueChange={val => updatePlan(plan.id, { status: val })}>
                  <SelectTrigger className="w-[150px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3">
                <Textarea
                  defaultValue={plan.observations || ''}
                  placeholder="Observações..."
                  rows={2}
                  onBlur={e => {
                    if (e.target.value !== (plan.observations || '')) updatePlan(plan.id, { observations: e.target.value });
                  }}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
