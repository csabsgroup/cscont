import { useMemo } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, CheckSquare, AlertTriangle, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { UserAvatar } from '@/components/shared/UserAvatar';

const priorityConfig: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  low: { label: 'Baixa', class: 'bg-muted text-muted-foreground', icon: ArrowDown },
  medium: { label: 'Média', class: 'bg-primary/15 text-primary', icon: Minus },
  high: { label: 'Alta', class: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400', icon: ArrowUp },
  urgent: { label: 'Urgente', class: 'bg-destructive/15 text-destructive', icon: AlertTriangle },
};

export interface BoardCardData {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
  column_id: string;
  checklist: { id: string; text: string; checked: boolean }[];
  status: string;
  priority: string;
  created_by: string | null;
  assignees: { user_id: string; full_name: string | null; avatar_url: string | null }[];
}

interface BoardCardProps {
  card: BoardCardData;
  tagColors: Record<string, string>;
  onClick: () => void;
}

export function BoardCard({ card, tagColors, onClick }: BoardCardProps) {
  const isOverdue = useMemo(() => {
    if (!card.due_date || card.completed_at) return false;
    return isPast(new Date(card.due_date)) && !isToday(new Date(card.due_date));
  }, [card.due_date, card.completed_at]);

  const checklistTotal = card.checklist?.length || 0;
  const checklistDone = card.checklist?.filter(c => c.checked).length || 0;

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-card border bg-card p-3 shadow-sm transition-all duration-150 hover:shadow-md hover:border-primary/30 ${
        isOverdue ? 'border-l-[3px] border-l-destructive' : 'border-border'
      }`}
    >
      {/* Tags */}
      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: tagColors[tag] || '#6b7280' }}
            >
              {tag}
            </span>
          ))}
          {card.tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{card.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-medium text-foreground leading-snug mb-2">{card.title}</p>

      {/* Bottom row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {card.due_date && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-destructive font-medium' : ''}`}>
              <Calendar className="h-3 w-3" />
              {format(new Date(card.due_date), 'dd/MM', { locale: ptBR })}
            </span>
          )}
          {checklistTotal > 0 && (
            <span className={`flex items-center gap-1 ${checklistDone === checklistTotal ? 'text-green-600' : ''}`}>
              <CheckSquare className="h-3 w-3" />
              {checklistDone}/{checklistTotal}
            </span>
          )}
        </div>

        {/* Assignee avatars */}
        {card.assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {card.assignees.slice(0, 3).map(a => (
              <UserAvatar
                key={a.user_id}
                name={a.full_name || 'U'}
                avatarUrl={a.avatar_url || undefined}
                size="xs"
              />
            ))}
            {card.assignees.length > 3 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground border border-background">
                +{card.assignees.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
