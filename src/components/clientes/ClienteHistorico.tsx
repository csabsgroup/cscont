import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, GitBranch, CheckCircle2, Video, FileText, Gift, ShoppingCart,
  Edit3, ArrowRightLeft, StickyNote, ChevronDown, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  date: string;
  type: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  color: string;
}

const EVENT_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'stage', label: 'Etapas', icon: GitBranch },
  { key: 'activity', label: 'Atividades', icon: CheckCircle2 },
  { key: 'meeting', label: 'Reuniões', icon: Video },
  { key: 'contract', label: 'Contratos', icon: FileText },
  { key: 'bonus', label: 'Cashbacks', icon: Gift },
  { key: 'form', label: 'Formulários', icon: ShoppingCart },
  { key: 'field_change', label: 'Alterações', icon: Edit3 },
] as const;

type FilterKey = (typeof EVENT_FILTERS)[number]['key'];

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  stage: { icon: GitBranch, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' },
  activity: { icon: CheckCircle2, color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
  meeting: { icon: Video, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
  contract: { icon: FileText, color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' },
  bonus_grant: { icon: Gift, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
  bonus_request: { icon: ShoppingCart, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
  form: { icon: ShoppingCart, color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30' },
  field_change: { icon: Edit3, color: 'text-slate-600 bg-slate-100 dark:bg-slate-900/30' },
  status_change: { icon: ArrowRightLeft, color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30' },
  csm_reassign: { icon: ArrowRightLeft, color: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30' },
  note_added: { icon: StickyNote, color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30' },
};

const PAGE_SIZE = 30;

function getFilterGroup(type: string): string {
  if (['bonus_grant', 'bonus_request'].includes(type)) return 'bonus';
  if (['status_change', 'csm_reassign', 'note_added', 'field_change'].includes(type)) return 'field_change';
  return type;
}

export function ClienteHistorico({ officeId }: { officeId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    const allEvents: TimelineEvent[] = [];

    const [stageRes, actRes, meetRes, contractRes, grantRes, reqRes, formRes, customRes] = await Promise.all([
      // Stage history
      supabase.from('office_stage_history').select('*, from_stage:from_stage_id(name), to_stage:to_stage_id(name)')
        .eq('office_id', officeId).order('created_at', { ascending: false }),
      // Completed activities
      supabase.from('activities').select('id, title, completed_at, type')
        .eq('office_id', officeId).not('completed_at', 'is', null)
        .order('completed_at', { ascending: false }),
      // Completed meetings
      supabase.from('meetings').select('id, title, scheduled_at, status')
        .eq('office_id', officeId).eq('status', 'completed')
        .order('scheduled_at', { ascending: false }),
      // Contracts
      supabase.from('contracts').select('id, status, created_at, products:product_id(name)')
        .eq('office_id', officeId).order('created_at', { ascending: false }),
      // Bonus grants
      supabase.from('bonus_grants').select('id, quantity, granted_at, bonus_catalog(name)')
        .eq('office_id', officeId).order('granted_at', { ascending: false }),
      // Bonus requests
      supabase.from('bonus_requests').select('id, quantity, status, created_at, bonus_catalog(name)')
        .eq('office_id', officeId).order('created_at', { ascending: false }),
      // Form submissions
      supabase.from('form_submissions').select('id, submitted_at, form_templates:template_id(name)')
        .eq('office_id', officeId).order('submitted_at', { ascending: false }),
      // Custom timeline events
      supabase.from('office_timeline_events' as any).select('*')
        .eq('office_id', officeId).order('created_at', { ascending: false }),
    ]);

    // Map stage history
    (stageRes.data || []).forEach((s: any) => {
      allEvents.push({
        id: `stage-${s.id}`,
        date: s.created_at,
        type: 'stage',
        title: `Etapa alterada`,
        description: `${s.from_stage?.name || '—'} → ${s.to_stage?.name || '—'}`,
        icon: TYPE_CONFIG.stage.icon,
        color: TYPE_CONFIG.stage.color,
      });
    });

    // Map activities
    (actRes.data || []).forEach((a: any) => {
      allEvents.push({
        id: `act-${a.id}`,
        date: a.completed_at,
        type: 'activity',
        title: `Atividade concluída`,
        description: a.title,
        icon: TYPE_CONFIG.activity.icon,
        color: TYPE_CONFIG.activity.color,
      });
    });

    // Map meetings
    (meetRes.data || []).forEach((m: any) => {
      allEvents.push({
        id: `meet-${m.id}`,
        date: m.scheduled_at,
        type: 'meeting',
        title: `Reunião realizada`,
        description: m.title,
        icon: TYPE_CONFIG.meeting.icon,
        color: TYPE_CONFIG.meeting.color,
      });
    });

    // Map contracts
    (contractRes.data || []).forEach((c: any) => {
      const statusLabel: Record<string, string> = { ativo: 'Ativo', cancelado: 'Cancelado', pendente: 'Pendente', finalizado: 'Finalizado' };
      allEvents.push({
        id: `contract-${c.id}`,
        date: c.created_at,
        type: 'contract',
        title: `Contrato ${statusLabel[c.status] || c.status}`,
        description: (c.products as any)?.name || '',
        icon: TYPE_CONFIG.contract.icon,
        color: TYPE_CONFIG.contract.color,
      });
    });

    // Map bonus grants
    (grantRes.data || []).forEach((g: any) => {
      allEvents.push({
        id: `grant-${g.id}`,
        date: g.granted_at,
        type: 'bonus_grant',
        title: `Cashback concedido`,
        description: `${g.quantity}x ${(g.bonus_catalog as any)?.name || 'Item'}`,
        icon: TYPE_CONFIG.bonus_grant.icon,
        color: TYPE_CONFIG.bonus_grant.color,
      });
    });

    // Map bonus requests
    (reqRes.data || []).forEach((r: any) => {
      const sLabel: Record<string, string> = { pending: 'Pendente', approved: 'Aprovado', denied: 'Negado' };
      allEvents.push({
        id: `req-${r.id}`,
        date: r.created_at,
        type: 'bonus_request',
        title: `Cashback solicitado (${sLabel[r.status] || r.status})`,
        description: `${r.quantity}x ${(r.bonus_catalog as any)?.name || 'Item'}`,
        icon: TYPE_CONFIG.bonus_request.icon,
        color: TYPE_CONFIG.bonus_request.color,
      });
    });

    // Map form submissions
    (formRes.data || []).forEach((f: any) => {
      allEvents.push({
        id: `form-${f.id}`,
        date: f.submitted_at,
        type: 'form',
        title: `Formulário preenchido`,
        description: (f.form_templates as any)?.name || '',
        icon: TYPE_CONFIG.form.icon,
        color: TYPE_CONFIG.form.color,
      });
    });

    // Map custom timeline events
    ((customRes.data as any[]) || []).forEach((e: any) => {
      const cfg = TYPE_CONFIG[e.event_type] || TYPE_CONFIG.field_change;
      allEvents.push({
        id: `custom-${e.id}`,
        date: e.created_at,
        type: e.event_type,
        title: e.title,
        description: e.description || undefined,
        icon: cfg.icon,
        color: cfg.color,
      });
    });

    // Sort by date descending
    allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setEvents(allEvents);
    setLoading(false);
  }, [officeId]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  const filtered = filter === 'all' ? events : events.filter(e => getFilterGroup(e.type) === filter);
  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {EVENT_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setVisibleCount(PAGE_SIZE); }}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {'icon' in f && f.icon && <f.icon className="h-3 w-3" />}
            {f.label}
          </button>
        ))}
      </div>

      {/* Counter */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} evento{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhum evento encontrado.
        </Card>
      ) : (
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-1">
            {visible.map((event, idx) => {
              const Icon = event.icon;
              const colorClasses = event.color.split(' ');
              const textColor = colorClasses[0];
              const bgColor = colorClasses.slice(1).join(' ');

              return (
                <div key={event.id} className="relative flex items-start gap-3 py-2">
                  {/* Dot */}
                  <div className={cn('absolute -left-6 mt-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-background', bgColor)}>
                    <Icon className={cn('h-3 w-3', textColor)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{event.title}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(event.date), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1"
                onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Carregar mais ({filtered.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
