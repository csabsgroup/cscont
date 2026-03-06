import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { usePortalSettings } from '@/hooks/usePortalSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Target, Calendar, Heart, Gift, Video } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PortalHome() {
  const { officeId, officeName } = usePortal();
  const { settings } = usePortalSettings();
  const [loading, setLoading] = useState(true);
  const [officeStatus, setOfficeStatus] = useState<string | null>(null);
  const [stats, setStats] = useState({
    contractStatus: '—',
    productName: '',
    contractEnd: '',
    okrProgress: 0,
    healthScore: null as number | null,
    healthBand: '' as string,
    bonusAvailable: 0,
    nextEvent: null as { title: string; date: string } | null,
    nextMeeting: null as { title: string; date: string } | null,
  });

  useEffect(() => {
    if (!officeId) { setLoading(false); return; }
    (async () => {
      console.log('[PORTAL] Home loading for office:', officeId);
      const { data: office } = await supabase.from('offices').select('name, active_product_id, status').eq('id', officeId).single();
      setOfficeStatus(office?.status || null);

      if (office?.status === 'pausado') { setLoading(false); return; }

      const [contractRes, okrRes, healthRes, bonusRes, meetingRes] = await Promise.all([
        supabase.from('contracts').select('status, end_date, product_id').eq('office_id', officeId).eq('status', 'ativo').maybeSingle(),
        supabase.from('action_plans').select('status').eq('office_id', officeId),
        supabase.from('health_scores').select('score, band').eq('office_id', officeId).order('calculated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('bonus_grants').select('available').eq('office_id', officeId),
        supabase.from('meetings').select('title, scheduled_at').eq('office_id', officeId).eq('share_with_client', true).gte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true }).limit(1).maybeSingle(),
      ]);

      let productName = '';
      if (contractRes.data?.product_id) {
        const { data: prod } = await supabase.from('products').select('name').eq('id', contractRes.data.product_id).single();
        productName = prod?.name || '';
      }

      const plans = okrRes.data || [];
      const done = plans.filter(p => p.status === 'done').length;
      const progress = plans.length > 0 ? Math.round((done / plans.length) * 100) : 0;
      const totalBonus = (bonusRes.data || []).reduce((sum, g) => sum + Number(g.available), 0);

      let nextEvent: { title: string; date: string } | null = null;
      const { data: allEvents } = await supabase.from('events').select('title, event_date, eligible_product_ids').gte('event_date', new Date().toISOString()).order('event_date', { ascending: true }).limit(10);
      if (allEvents) {
        const eligible = allEvents.find(ev => {
          const ids = ev.eligible_product_ids as string[] | null;
          if (!ids || ids.length === 0) return true;
          return office?.active_product_id ? ids.includes(office.active_product_id) : true;
        });
        if (eligible) nextEvent = { title: eligible.title, date: eligible.event_date };
      }

      setStats({
        contractStatus: contractRes.data ? 'Ativo' : 'Sem contrato ativo',
        productName,
        contractEnd: contractRes.data?.end_date || '',
        okrProgress: progress,
        healthScore: healthRes.data?.score ?? null,
        healthBand: healthRes.data?.band || '',
        bonusAvailable: totalBonus,
        nextEvent,
        nextMeeting: meetingRes.data ? { title: meetingRes.data.title, date: meetingRes.data.scheduled_at } : null,
      });
      setLoading(false);
    })();
  }, [officeId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (!officeId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Portal</h1>
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          Seu escritório não está vinculado à sua conta. Entre em contato com seu consultor.
        </CardContent></Card>
      </div>
    );
  }

  if (officeStatus === 'pausado') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Portal</h1>
        <div className="rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800 p-6 text-center">
          <p className="text-purple-800 dark:text-purple-300 font-medium">
            Seu acesso está temporariamente pausado. Entre em contato com seu consultor.
          </p>
        </div>
      </div>
    );
  }

  const healthColor = stats.healthBand === 'green' ? 'bg-emerald-500' : stats.healthBand === 'yellow' ? 'bg-amber-500' : stats.healthBand === 'red' ? 'bg-red-500' : 'bg-muted';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bem-vindo, {officeName || 'Portal'}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {settings.portal_show_contract && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Contrato</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.contractStatus}</p>
              {stats.productName && <p className="text-xs text-muted-foreground">{stats.productName}</p>}
              {stats.contractEnd && <p className="text-xs text-muted-foreground">Até {format(new Date(stats.contractEnd), 'dd/MM/yyyy')}</p>}
            </CardContent>
          </Card>
        )}

        {settings.portal_show_health && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Health Score</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats.healthScore !== null ? (
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{stats.healthScore}</p>
                  <Badge className={`${healthColor} text-white border-0`}>
                    {stats.healthBand === 'green' ? 'Saudável' : stats.healthBand === 'yellow' ? 'Atenção' : 'Crítico'}
                  </Badge>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados</p>
              )}
            </CardContent>
          </Card>
        )}

        {settings.portal_show_okr && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Plano de Ação</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.okrProgress}%</p>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${stats.okrProgress}%` }} />
              </div>
            </CardContent>
          </Card>
        )}

        {settings.portal_show_bonus_balance && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Bônus Disponível</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.bonusAvailable}</p>
            </CardContent>
          </Card>
        )}

        {settings.portal_show_next_event && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Próximo Evento</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats.nextEvent ? (
                <>
                  <p className="text-sm font-semibold">{stats.nextEvent.title}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(stats.nextEvent.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum evento próximo</p>
              )}
            </CardContent>
          </Card>
        )}

        {settings.portal_show_next_meeting && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Próxima Reunião</CardTitle>
              <Video className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats.nextMeeting ? (
                <>
                  <p className="text-sm font-semibold">{stats.nextMeeting.title}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(stats.nextMeeting.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma reunião agendada</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
