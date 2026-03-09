import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';

interface DeleteColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column: { id: string; name: string } | null;
  cardCount: number;
  otherColumns: { id: string; name: string }[];
  onConfirmDelete: () => Promise<void>;
  onMoveAndDelete: (fromColId: string, toColId: string) => Promise<void>;
}

export function DeleteColumnDialog({
  open, onOpenChange, column, cardCount, otherColumns,
  onConfirmDelete, onMoveAndDelete,
}: DeleteColumnDialogProps) {
  const [targetColId, setTargetColId] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!column) return null;

  const hasCards = cardCount > 0;

  const handleDelete = async () => {
    setDeleting(true);
    if (hasCards && targetColId) {
      await onMoveAndDelete(column.id, targetColId);
    } else {
      await onConfirmDelete();
    }
    setDeleting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Excluir coluna "{column.name}"
          </DialogTitle>
          <DialogDescription>
            {hasCards
              ? `Esta coluna tem ${cardCount} card(s). Selecione para onde mover antes de excluir.`
              : 'Esta coluna está vazia e será excluída permanentemente.'}
          </DialogDescription>
        </DialogHeader>

        {hasCards && (
          <div className="space-y-2 py-2">
            <Select value={targetColId} onValueChange={setTargetColId}>
              <SelectTrigger>
                <SelectValue placeholder="Mover cards para..." />
              </SelectTrigger>
              <SelectContent>
                {otherColumns.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || (hasCards && !targetColId)}
          >
            {hasCards ? 'Mover e Excluir' : 'Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
