import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePortalSettings } from '@/hooks/usePortalSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Target, Calendar, Heart, Gift, Video } from 'lucide-react';
import { format, isFuture } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PortalHome() {
  const { user } = useAuth();
  const { settings } = usePortalSettings();
  const [loading, setLoading] = useState(true);
  const [officeName, setOfficeName] = useState('');
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
    if (!user) return;
    (async () => {
      const { data: links } = await supabase.from('client_office_links').select('office_id').eq('user_id', user.id);
      const oid = links?.[0]?.office_id;
      if (!oid) { setLoading(false); return; }

      // Fetch office info
      const { data: office } = await supabase.from('offices').select('name, active_product_id').eq('id', oid).single();
      setOfficeName(office?.name || '');

      const [contractRes, okrRes, healthRes, bonusRes, meetingRes] = await Promise.all([
        supabase.from('contracts').select('status, end_date, product_id').eq('office_id', oid).eq('status', 'ativo').maybeSingle(),
        supabase.from('action_plans').select('status').eq('office_id', oid),
        supabase.from('health_scores').select('score, band').eq('office_id', oid).order('calculated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('bonus_grants').select('available').eq('office_id', oid),
        supabase.from('meetings').select('title, scheduled_at').eq('office_id', oid).eq('share_with_client', true).gte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true }).limit(1).maybeSingle(),
      ]);

      // Product name for contract
      let productName = '';
      if (contractRes.data?.product_id) {
        const { data: prod } = await supabase.from('products').select('name').eq('id', contractRes.data.product_id).single();
        productName = prod?.name || '';
      }

      // OKR progress
      const plans = okrRes.data || [];
      const done = plans.filter(p => p.status === 'done').length;
      const progress = plans.length > 0 ? Math.round((done / plans.length) * 100) : 0;

      // Bonus balance
      const totalBonus = (bonusRes.data || []).reduce((sum, g) => sum + Number(g.available), 0);

      // Next event (filtered by product eligibility)
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
  }, [user]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const healthColor = stats.healthBand === 'green' ? 'bg-emerald-500' : stats.healthBand === 'yellow' ? 'bg-amber-500' : stats.healthBand === 'red' ? 'bg-red-500' : 'bg-muted';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bem-vindo, {officeName || 'Portal'}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Contract */}
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

        {/* Health Score */}
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

        {/* OKR Progress */}
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

        {/* Bonus */}
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

        {/* Next Event */}
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

        {/* Next Meeting */}
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
