import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GripVertical, Pencil, Trash2, Plus } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const COLUMN_COLORS = [
  '#3b82f6', '#eab308', '#16a34a', '#ef4444',
  '#8b5cf6', '#ec4899', '#f97316', '#6b7280',
];

interface ColumnData {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  cardCount?: number;
}

interface ColumnConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnData[];
  onSave: (columns: { id?: string; name: string; color: string; sort_order: number }[]) => Promise<void>;
  onDelete: (id: string) => Promise<boolean>;
}

export function ColumnConfigDialog({ open, onOpenChange, columns, onSave, onDelete }: ColumnConfigDialogProps) {
  const [items, setItems] = useState<(ColumnData & { isNew?: boolean })[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setItems(columns.map(c => ({ ...c })));
    onOpenChange(isOpen);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const reordered = Array.from(items);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setItems(reordered.map((c, i) => ({ ...c, sort_order: i })));
  };

  const addColumn = () => {
    const newCol: ColumnData & { isNew?: boolean } = {
      id: `new-${Date.now()}`,
      name: 'Nova Coluna',
      color: COLUMN_COLORS[items.length % COLUMN_COLORS.length],
      sort_order: items.length,
      isNew: true,
      cardCount: 0,
    };
    setItems([...items, newCol]);
    setEditingId(newCol.id);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(items.map(c => ({
      id: c.isNew ? undefined : c.id,
      name: c.name,
      color: c.color,
      sort_order: c.sort_order,
    })));
    setSaving(false);
    onOpenChange(false);
  };

  const handleDelete = async (id: string) => {
    const col = items.find(c => c.id === id);
    if (col?.isNew) {
      setItems(items.filter(c => c.id !== id));
      return;
    }
    if ((col?.cardCount || 0) > 0) return;
    const ok = await onDelete(id);
    if (ok) setItems(items.filter(c => c.id !== id).map((c, i) => ({ ...c, sort_order: i })));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Colunas</DialogTitle>
        </DialogHeader>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="col-config">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 py-2">
                {items.map((col, idx) => (
                  <Draggable key={col.id} draggableId={col.id} index={idx}>
                    {(p) => (
                      <div ref={p.innerRef} {...p.draggableProps} className="flex items-center gap-2 rounded-card border border-border bg-card p-2">
                        <span {...p.dragHandleProps}><GripVertical className="h-4 w-4 text-muted-foreground" /></span>
                        <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                        {editingId === col.id ? (
                          <div className="flex-1 flex gap-1">
                            <Input
                              value={col.name}
                              onChange={e => setItems(items.map(c => c.id === col.id ? { ...c, name: e.target.value } : c))}
                              className="h-7 text-xs flex-1"
                              autoFocus
                              onBlur={() => setEditingId(null)}
                              onKeyDown={e => e.key === 'Enter' && setEditingId(null)}
                            />
                            <div className="flex gap-0.5">
                              {COLUMN_COLORS.map(c => (
                                <button
                                  key={c}
                                  onClick={() => setItems(items.map(it => it.id === col.id ? { ...it, color: c } : it))}
                                  className={`h-5 w-5 rounded-full border ${col.color === c ? 'border-foreground' : 'border-transparent'}`}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="flex-1 text-sm font-medium">{col.name}</span>
                        )}
                        <button onClick={() => setEditingId(col.id)} className="text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(col.id)}
                          className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                          disabled={(col.cardCount || 0) > 0 && !col.isNew}
                          title={(col.cardCount || 0) > 0 ? 'Mova os cards antes de excluir' : 'Excluir'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <Button variant="outline" size="sm" onClick={addColumn} className="w-full">
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar coluna
        </Button>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
