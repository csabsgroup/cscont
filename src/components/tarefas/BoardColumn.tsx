import { Droppable, Draggable, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { Plus, MoreHorizontal, Settings, ArrowLeft, ArrowRight, Archive, Trash2, ClipboardList } from 'lucide-react';
import { useState, lazy, Suspense } from 'react';
import { BoardCard, type BoardCardData } from './BoardCard';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { icons } from 'lucide-react';

interface ColumnData {
  id: string; name: string; color: string;
  header_color: string | null; bg_color: string | null;
  bg_gradient_from: string | null; bg_gradient_to: string | null;
  bg_opacity: number | null; icon: string | null;
}

interface BoardColumnProps {
  column: ColumnData;
  cards: BoardCardData[];
  tagColors: Record<string, string>;
  readOnly?: boolean;
  canEditColumn?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onCardClick: (card: BoardCardData) => void;
  onQuickAdd: (columnId: string, title: string) => void;
  onEditColumn?: () => void;
  onDeleteColumn?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onArchiveAll?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  // Convert kebab-case to PascalCase
  const pascalName = name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  const IconComp = (icons as any)[pascalName];
  if (!IconComp) return null;
  return <IconComp className={className} />;
}

export function BoardColumn({
  column, cards, tagColors, readOnly, canEditColumn, dragHandleProps,
  onCardClick, onQuickAdd, onEditColumn, onDeleteColumn,
  onMoveLeft, onMoveRight, onArchiveAll, isFirst, isLast,
}: BoardColumnProps) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');

  const submit = () => {
    if (title.trim()) {
      onQuickAdd(column.id, title.trim());
      setTitle('');
    }
    setAdding(false);
  };

  const headerColor = column.header_color || column.color || '#374151';
  const opacity = (column.bg_opacity ?? 100) / 100;

  let bodyStyle: React.CSSProperties = {};
  if (column.bg_gradient_from && column.bg_gradient_to) {
    bodyStyle = {
      background: `linear-gradient(180deg, ${column.bg_gradient_from}, ${column.bg_gradient_to})`,
      opacity,
    };
  } else if (column.bg_color) {
    bodyStyle = { backgroundColor: column.bg_color, opacity };
  }

  return (
    <div className="flex flex-col rounded-card border border-border/60 min-w-[260px] w-[260px] max-h-full overflow-hidden" style={bodyStyle.backgroundColor || bodyStyle.background ? { ...bodyStyle } : undefined}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 text-white shrink-0"
        style={{ backgroundColor: headerColor }}
        {...(dragHandleProps || {})}
      >
        {column.icon && <DynamicIcon name={column.icon} className="h-3.5 w-3.5" />}
        <span className="text-xs font-semibold uppercase tracking-wide flex-1 truncate">{column.name}</span>
        <span className="text-[10px] font-medium bg-white/20 rounded-full px-1.5">{cards.length}</span>
        {canEditColumn && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-70 hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onEditColumn}>
                <Settings className="h-3.5 w-3.5 mr-2" /> Editar coluna
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setAdding(true); }}>
                <Plus className="h-3.5 w-3.5 mr-2" /> Adicionar card
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {!isFirst && (
                <DropdownMenuItem onClick={onMoveLeft}>
                  <ArrowLeft className="h-3.5 w-3.5 mr-2" /> Mover esquerda
                </DropdownMenuItem>
              )}
              {!isLast && (
                <DropdownMenuItem onClick={onMoveRight}>
                  <ArrowRight className="h-3.5 w-3.5 mr-2" /> Mover direita
                </DropdownMenuItem>
              )}
              {cards.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onArchiveAll}>
                    <Archive className="h-3.5 w-3.5 mr-2" /> Arquivar todos
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDeleteColumn} className="text-destructive focus:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir coluna
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Cards */}
      <Droppable droppableId={column.id} type="CARD">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px] transition-colors ${
              snapshot.isDraggingOver ? 'bg-primary/5' : 'bg-muted/20'
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
        <div className="p-2 border-t border-border/30 bg-card/50 shrink-0">
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
