import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { BoardCard, type BoardCardData } from './BoardCard';
import { Input } from '@/components/ui/input';

interface BoardColumnProps {
  column: { id: string; name: string; color: string };
  cards: BoardCardData[];
  tagColors: Record<string, string>;
  readOnly?: boolean;
  onCardClick: (card: BoardCardData) => void;
  onQuickAdd: (columnId: string, title: string) => void;
}

export function BoardColumn({ column, cards, tagColors, readOnly, onCardClick, onQuickAdd }: BoardColumnProps) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');

  const submit = () => {
    if (title.trim()) {
      onQuickAdd(column.id, title.trim());
      setTitle('');
    }
    setAdding(false);
  };

  return (
    <div className="flex flex-col rounded-card bg-muted/40 border border-border/60 min-w-[260px] w-[260px] max-h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/40">
        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide flex-1">{column.name}</span>
        <span className="text-[10px] text-muted-foreground font-medium bg-muted rounded-full px-1.5">{cards.length}</span>
      </div>

      {/* Cards */}
      <Droppable droppableId={column.id} type="CARD">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px] transition-colors ${
              snapshot.isDraggingOver ? 'bg-primary/5' : ''
            }`}
          >
            {cards.map((card, idx) => (
              <Draggable key={card.id} draggableId={card.id} index={idx} isDragDisabled={readOnly}>
                {(p) => (
                  <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                    <BoardCard card={card} tagColors={tagColors} onClick={() => onCardClick(card)} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Quick add */}
      {!readOnly && (
        <div className="p-2 border-t border-border/30">
          {adding ? (
            <div className="space-y-1">
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Título da tarefa..."
                className="h-8 text-xs"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') submit();
                  if (e.key === 'Escape') setAdding(false);
                }}
                onBlur={submit}
              />
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
