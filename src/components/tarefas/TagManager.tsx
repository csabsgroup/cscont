import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagManagerProps {
  selectedTags: string[];
  availableTags: Tag[];
  onChange: (tags: string[]) => void;
  onCreateTag?: (name: string, color: string) => Promise<void>;
}

export function TagManager({ selectedTags, availableTags, onChange, onCreateTag }: TagManagerProps) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[4]);
  const [creating, setCreating] = useState(false);

  const toggle = (name: string) => {
    onChange(
      selectedTags.includes(name)
        ? selectedTags.filter(t => t !== name)
        : [...selectedTags, name]
    );
  };

  const handleCreate = async () => {
    if (!newName.trim() || !onCreateTag) return;
    setCreating(true);
    await onCreateTag(newName.trim(), newColor);
    onChange([...selectedTags, newName.trim()]);
    setNewName('');
    setCreating(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selectedTags.map(tag => {
          const t = availableTags.find(at => at.name === tag);
          return (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
              style={{ backgroundColor: t?.color || '#6b7280' }}
            >
              {tag}
              <button onClick={() => toggle(tag)} className="hover:opacity-70"><X className="h-3 w-3" /></button>
            </span>
          );
        })}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-3" align="start">
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {availableTags.filter(t => !selectedTags.includes(t.name)).map(tag => (
              <button
                key={tag.id}
                onClick={() => toggle(tag.name)}
                className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs hover:bg-accent transition-colors"
              >
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))}
          </div>

          {onCreateTag && (
            <div className="border-t border-border pt-2 space-y-2">
              <p className="text-[10px] text-muted-foreground font-medium">Criar nova tag</p>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Nome da tag"
                className="h-7 text-xs"
              />
              <div className="flex gap-1">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`h-5 w-5 rounded-full border-2 transition-all ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate} disabled={!newName.trim() || creating}>
                Criar tag
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
