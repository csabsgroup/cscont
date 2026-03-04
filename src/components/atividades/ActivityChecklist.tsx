import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  position: number;
}

interface Props {
  activityId: string;
  readOnly?: boolean;
}

export function ActivityChecklist({ activityId, readOnly }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newTitle, setNewTitle] = useState('');

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('activity_checklists')
      .select('*')
      .eq('activity_id', activityId)
      .order('position');
    setItems((data as any[]) || []);
  }, [activityId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = async () => {
    if (!newTitle.trim()) return;
    const { error } = await supabase.from('activity_checklists').insert({
      activity_id: activityId,
      title: newTitle.trim(),
      position: items.length,
    } as any);
    if (error) toast.error('Erro ao adicionar');
    else { setNewTitle(''); fetchItems(); }
  };

  const toggleItem = async (item: ChecklistItem) => {
    await supabase.from('activity_checklists').update({ completed: !item.completed } as any).eq('id', item.id);
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    await supabase.from('activity_checklists').delete().eq('id', id);
    fetchItems();
  };

  const done = items.filter(i => i.completed).length;

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <p className="text-xs text-muted-foreground">{done}/{items.length} concluídas</p>
      )}
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-2">
          <Checkbox
            checked={item.completed}
            onCheckedChange={() => !readOnly && toggleItem(item)}
            disabled={readOnly}
          />
          <span className={`text-sm flex-1 ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
            {item.title}
          </span>
          {!readOnly && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteItem(item.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="flex gap-2">
          <Input
            placeholder="Nova subtarefa..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
            className="h-8 text-sm"
          />
          <Button variant="outline" size="sm" onClick={addItem} className="h-8">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
