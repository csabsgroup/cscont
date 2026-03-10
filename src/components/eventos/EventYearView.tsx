import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, eachMonthOfInterval, format, isSameDay,
  isSameMonth, isToday, startOfYear, endOfYear,
  addYears, subYears,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, MapPin, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_CONFIG, CATEGORY_BG, TYPE_LABELS } from './EventCalendarView';

const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface EventYearViewProps {
  events: any[];
  participantCounts: Record<string, { confirmed: number; total: number }>;
  currentYear: Date;
  onYearChange: (year: Date) => void;
}

export function EventYearView({ events, participantCounts, currentYear, onYearChange }: EventYearViewProps) {
  const navigate = useNavigate();

  const months = useMemo(() => {
    const yearStart = startOfYear(currentYear);
    const yearEnd = endOfYear(currentYear);
    return eachMonthOfInterval({ start: yearStart, end: yearEnd });
  }, [currentYear]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    events.forEach(ev => {
      const key = format(new Date(ev.event_date), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [events]);

  const eventsByMonth = useMemo(() => {
    const map: Record<string, any[]> = {};
    events.forEach(ev => {
      const key = format(new Date(ev.event_date), 'yyyy-MM');
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    // Sort each month's events by date
    Object.values(map).forEach(arr => arr.sort((a, b) =>
      new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    ));
    return map;
  }, [events]);

  return (
    <div className="space-y-4">
      {/* Year navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => onYearChange(subYears(currentYear, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => onYearChange(addYears(currentYear, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-2">
            {format(currentYear, 'yyyy')}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onYearChange(new Date())}>
          Hoje
        </Button>
      </div>

      {/* 4x3 Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {months.map(monthDate => {
          const monthKey = format(monthDate, 'yyyy-MM');
          const monthEvents = eventsByMonth[monthKey] || [];
          const monthStart = startOfMonth(monthDate);
          const monthEnd = endOfMonth(monthDate);
          const calStart = startOfWeek(monthStart, { locale: ptBR });
          const calEnd = endOfWeek(monthEnd, { locale: ptBR });
          const days = eachDayOfInterval({ start: calStart, end: calEnd });

          return (
            <div key={monthKey} className="border border-border rounded-lg p-3 space-y-2">
              {/* Month header */}
              <h3 className="text-sm font-semibold capitalize text-foreground">
                {format(monthDate, 'MMMM', { locale: ptBR })}
              </h3>

              {/* Mini calendar */}
              <div className="grid grid-cols-7 gap-px">
                {WEEKDAYS_SHORT.map((d, i) => (
                  <div key={i} className="text-[10px] text-center font-medium text-muted-foreground pb-0.5">
                    {d}
                  </div>
                ))}
                {days.map((day, i) => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const dayEvents = eventsByDay[dayKey] || [];
                  const inMonth = isSameMonth(day, monthDate);
                  const today = isToday(day);

                  return (
                    <div
                      key={i}
                      className={cn(
                        'relative flex flex-col items-center justify-center h-6 text-[10px]',
                        !inMonth && 'text-muted-foreground/30',
                        inMonth && 'text-foreground',
                      )}
                    >
                      <span className={cn(
                        'w-5 h-5 flex items-center justify-center rounded-full',
                        today && 'bg-primary text-primary-foreground font-semibold',
                      )}>
                        {format(day, 'd')}
                      </span>
                      {/* Dots for events */}
                      {dayEvents.length > 0 && inMonth && (
                        <div className="flex gap-px absolute -bottom-0.5">
                          {dayEvents.slice(0, 3).map((ev, idx) => {
                            const cat = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG.outro;
                            return (
                              <span key={idx} className={cn('w-1 h-1 rounded-full', cat.color)} />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Event legend */}
              {monthEvents.length > 0 && (
                <div className="space-y-0.5 pt-1 border-t border-border">
                  {monthEvents.map(ev => {
                    const cat = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG.outro;
                    const catBg = CATEGORY_BG[ev.category] || CATEGORY_BG.outro;
                    const counts = participantCounts[ev.id];
                    const evDate = new Date(ev.event_date);

                    return (
                      <HoverCard key={ev.id} openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <button
                            onClick={() => navigate(`/eventos/${ev.id}`)}
                            className={cn(
                              'w-full text-left flex items-center gap-1.5 py-0.5 px-1 rounded text-[11px] leading-tight transition-colors hover:brightness-90',
                              catBg,
                            )}
                          >
                            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cat.color)} />
                            <span className="text-muted-foreground shrink-0 font-mono">
                              {format(evDate, 'dd')}
                            </span>
                            <span className="text-muted-foreground shrink-0 capitalize">
                              {format(evDate, 'EEE', { locale: ptBR })}
                            </span>
                            <span className="truncate">— {ev.title}</span>
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent side="right" className="w-72 p-3 space-y-2 z-50">
                          <h4 className="font-semibold text-sm">{ev.title}</h4>
                          <div className="flex gap-1.5">
                            <Badge variant="secondary" className="text-xs">{TYPE_LABELS[ev.type] || ev.type}</Badge>
                            <Badge variant="outline" className="text-xs">{cat.label}</Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(evDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            {ev.end_date && (
                              <span> — {format(new Date(ev.end_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
