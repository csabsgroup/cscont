import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay,
  addMonths, subMonths, isToday, isPast, isBefore, isAfter,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, MapPin, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  encontro: { label: 'Encontro', color: 'bg-blue-500' },
  imersao: { label: 'Imersão', color: 'bg-purple-500' },
  workshop: { label: 'Workshop', color: 'bg-emerald-500' },
  treinamento: { label: 'Treinamento', color: 'bg-amber-500' },
  confraternizacao: { label: 'Confraternização', color: 'bg-pink-500' },
  outro: { label: 'Outro', color: 'bg-muted-foreground' },
};

const CATEGORY_BG: Record<string, string> = {
  encontro: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  imersao: 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
  workshop: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  treinamento: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  confraternizacao: 'bg-pink-500/20 text-pink-700 dark:text-pink-300',
  outro: 'bg-muted text-muted-foreground',
};

const TYPE_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  online: 'Online',
  hibrido: 'Híbrido',
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

type SpanPos = 'single' | 'start' | 'middle' | 'end';

interface DayEvent {
  ev: any;
  _pos: SpanPos;
}

interface EventCalendarViewProps {
  events: any[];
  participantCounts: Record<string, { confirmed: number; total: number }>;
}

export function EventCalendarView({ events, participantCounts }: EventCalendarViewProps) {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { locale: ptBR });
    const calEnd = endOfWeek(monthEnd, { locale: ptBR });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, DayEvent[]> = {};
    events.forEach(ev => {
      const startDate = new Date(ev.event_date);
      const endDate = ev.end_date ? new Date(ev.end_date) : null;

      if (!endDate || isSameDay(startDate, endDate) || isBefore(endDate, startDate)) {
        const key = format(startDate, 'yyyy-MM-dd');
        if (!map[key]) map[key] = [];
        map[key].push({ ev, _pos: 'single' });
      } else {
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        days.forEach((day, idx) => {
          const pos: SpanPos = idx === 0 ? 'start' : idx === days.length - 1 ? 'end' : 'middle';
          const key = format(day, 'yyyy-MM-dd');
          if (!map[key]) map[key] = [];
          map[key].push({ ev, _pos: pos });
        });
      }
    });
    return map;
  }, [events]);

  const MAX_VISIBLE = 2;

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold capitalize ml-2">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>
          Hoje
        </Button>
      </div>

      {/* Grid */}
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 bg-muted/50">
          {WEEKDAYS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDay[key] || [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            return (
              <div
                key={i}
                className={cn(
                  'min-h-[100px] border-t border-r border-border p-1.5 transition-colors',
                  !inMonth && 'bg-muted/20',
                  today && 'bg-primary/5',
                  i % 7 === 0 && 'border-l-0',
                )}
              >
                {/* Day number */}
                <div className={cn(
                  'text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                  today && 'bg-primary text-primary-foreground',
                  !inMonth && 'text-muted-foreground/40',
                  inMonth && !today && 'text-foreground',
                )}>
                  {format(day, 'd')}
                </div>

                {/* Events */}
                <div className="space-y-0.5">
                  {dayEvents.slice(0, MAX_VISIBLE).map(({ ev, _pos }) => {
                    const cat = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG.outro;
                    const catBg = CATEGORY_BG[ev.category] || CATEGORY_BG.outro;
                    const past = isPast(new Date(ev.event_date));
                    const counts = participantCounts[ev.id];

                    const spanClasses = cn(
                      'w-full text-left flex items-center gap-1 py-0.5 text-[11px] leading-tight transition-colors hover:brightness-90',
                      catBg,
                      _pos === 'single' && 'rounded px-1',
                      _pos === 'start' && 'rounded-l px-1 -mr-1.5',
                      _pos === 'middle' && 'rounded-none px-0 -mx-1.5',
                      _pos === 'end' && 'rounded-r px-1 -ml-1.5',
                      past && 'opacity-50',
                    );

                    return (
                      <HoverCard key={`${ev.id}-${_pos}`} openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <button
                            onClick={() => navigate(`/eventos/${ev.id}`)}
                            className={spanClasses}
                          >
                            {(_pos === 'single' || _pos === 'start') && (
                              <>
                                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cat.color)} />
                                <span className="truncate hidden sm:inline">{ev.title}</span>
                              </>
                            )}
                            {_pos === 'middle' && <span className="h-[18px]" />}
                            {_pos === 'end' && <span className="h-[18px]" />}
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent side="right" className="w-72 p-3 space-y-2">
                          <h4 className="font-semibold text-sm">{ev.title}</h4>
                          <div className="flex gap-1.5">
                            <Badge variant="secondary" className="text-xs">{TYPE_LABELS[ev.type] || ev.type}</Badge>
                            <Badge variant="outline" className="text-xs">{cat.label}</Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(ev.event_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            {ev.end_date && (
                              <span> — {format(new Date(ev.end_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                            )}
                          </div>
                          {ev.location && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{ev.location}</span>
                            </div>
                          )}
                          {counts && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {counts.confirmed} confirmado{counts.confirmed !== 1 ? 's' : ''} / {counts.total}
                            </div>
                          )}
                        </HoverCardContent>
                      </HoverCard>
                    );
                  })}
                  {dayEvents.length > MAX_VISIBLE && (
                    <span className="text-[10px] text-muted-foreground pl-1">
                      +{dayEvents.length - MAX_VISIBLE} mais
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
