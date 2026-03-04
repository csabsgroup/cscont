import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText, Target, Calendar } from 'lucide-react';

export default function PortalHome() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [stats, setStats] = useState({ contractStatus: '—', okrProgress: 0, upcomingEvents: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: links } = await supabase.from('client_office_links').select('office_id').eq('user_id', user.id);
      const oid = links?.[0]?.office_id;
      setOfficeId(oid || null);
      if (!oid) { setLoading(false); return; }

      const [contractRes, okrRes, eventRes] = await Promise.all([
        supabase.from('contracts').select('status').eq('office_id', oid).eq('status', 'ativo').maybeSingle(),
        supabase.from('action_plans').select('status').eq('office_id', oid),
        supabase.from('events').select('id').gte('event_date', new Date().toISOString()),
      ]);

      const plans = okrRes.data || [];
      const done = plans.filter(p => p.status === 'done').length;
      const progress = plans.length > 0 ? Math.round((done / plans.length) * 100) : 0;

      setStats({
        contractStatus: contractRes.data ? 'Ativo' : 'Sem contrato ativo',
        okrProgress: progress,
        upcomingEvents: eventRes.data?.length || 0,
      });
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bem-vindo ao Portal</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Contrato</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.contractStatus}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Plano de Ação</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.okrProgress}%</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Próximos Eventos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.upcomingEvents}</p></CardContent>
        </Card>
      </div>
    </div>
  );
}
