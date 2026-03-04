import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarItem {
  id: string;
  title: string;
  date: Date;
  type: 'event' | 'meeting';
  subtype?: string;
  location?: string;
}

interface Props {
  events: CalendarItem[];
}

export function PortalCalendar({ events }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const start = startOfWeek(monthStart, { locale: ptBR });
    const end = endOfWeek(monthEnd, { locale: ptBR });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    events.forEach(ev => {
      const key = format(ev.date, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    return map;
  }, [events]);

  const selectedDayItems = selectedDay
    ? eventsByDay.get(format(selectedDay, 'yyyy-MM-dd')) || []
    : [];

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-base font-semibold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px rounded-lg border bg-border overflow-hidden">
        {weekDays.map(d => (
          <div key={d} className="bg-muted px-1 py-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(key) || [];
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);
          const selected = selectedDay && isSameDay(day, selectedDay);

          return (
            <button
              key={key}
              onClick={() => setSelectedDay(day)}
              className={cn(
                'relative bg-card min-h-[72px] p-1 text-left transition-colors hover:bg-accent/50',
                !inMonth && 'opacity-40',
                selected && 'ring-2 ring-primary ring-inset',
              )}
            >
              <span className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                today && 'bg-primary text-primary-foreground font-bold',
              )}>
                {format(day, 'd')}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, 2).map(ev => (
                  <div
                    key={ev.id}
                    className={cn(
                      'truncate rounded px-1 text-[10px] leading-tight',
                      ev.type === 'event' ? 'bg-primary/10 text-primary' : 'bg-blue-500/10 text-blue-600',
                    )}
                  >
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <span className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 2}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="rounded-lg border bg-card p-4">
          <h4 className="text-sm font-semibold mb-3">
            {format(selectedDay, "dd 'de' MMMM", { locale: ptBR })}
          </h4>
          {selectedDayItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum item neste dia.</p>
          ) : (
            <div className="space-y-2">
              {selectedDayItems.map(item => (
                <div key={item.id} className="flex items-start gap-2 rounded-md border p-2">
                  {item.type === 'event' ? (
                    <Calendar className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  ) : (
                    <Video className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(item.date, 'HH:mm')}
                      {item.subtype && ` · ${item.subtype}`}
                      {item.location && ` · 📍 ${item.location}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
