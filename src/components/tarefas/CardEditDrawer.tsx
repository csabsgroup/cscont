import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Trash2, Archive, Plus, X } from 'lucide-react';
import { TagManager } from './TagManager';
import { UserAvatar } from '@/components/shared/UserAvatar';
import type { BoardCardData } from './BoardCard';

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Column {
  id: string;
  name: string;
}

interface CardEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: Partial<BoardCardData> | null;
  columns: Column[];
  profiles: Profile[];
  tags: Tag[];
  readOnly?: boolean;
  onSave: (data: Partial<BoardCardData>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onArchive?: (id: string) => Promise<void>;
  onCreateTag?: (name: string, color: string) => Promise<void>;
}

export function CardEditDrawer({
  open, onOpenChange, card, columns, profiles, tags,
  readOnly, onSave, onDelete, onArchive, onCreateTag,
}: CardEditDrawerProps) {
  const [form, setForm] = useState<Partial<BoardCardData>>({});
  const [saving, setSaving] = useState(false);
  const [newCheckItem, setNewCheckItem] = useState('');

  useEffect(() => {
    if (card) setForm({ ...card });
  }, [card]);

  const isNew = !form.id;

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onOpenChange(false);
  };

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    const items = [...(form.checklist || []), { id: crypto.randomUUID(), text: newCheckItem.trim(), checked: false }];
    setForm({ ...form, checklist: items });
    setNewCheckItem('');
  };

  const toggleCheck = (id: string) => {
    setForm({
      ...form,
      checklist: (form.checklist || []).map(c => c.id === id ? { ...c, checked: !c.checked } : c),
    });
  };

  const removeCheck = (id: string) => {
    setForm({ ...form, checklist: (form.checklist || []).filter(c => c.id !== id) });
  };

  const checkDone = (form.checklist || []).filter(c => c.checked).length;
  const checkTotal = (form.checklist || []).length;

  const selectedAssigneeIds = form.assignees?.map(a => a.user_id) || [];

  const toggleAssignee = (profile: Profile) => {
    const current = form.assignees || [];
    if (current.find(a => a.user_id === profile.id)) {
      setForm({ ...form, assignees: current.filter(a => a.user_id !== profile.id) });
    } else {
      setForm({ ...form, assignees: [...current, { user_id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url }] });
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="fixed inset-y-0 right-0 w-full sm:w-[480px] rounded-none border-l flex flex-col h-full" style={{ left: 'auto' }}>
        <DrawerHeader className="border-b border-border px-5 py-4">
          <DrawerTitle>{isNew ? 'Nova Tarefa' : 'Editar Tarefa'}</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input
              value={form.title || ''}
              onChange={e => setForm({ ...form, title: e.target.value })}
              disabled={readOnly}
              placeholder="Título da tarefa"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              value={form.description || ''}
              onChange={e => setForm({ ...form, description: e.target.value })}
              disabled={readOnly}
              rows={3}
            />
          </div>

          {/* Column */}
          <div className="space-y-1.5">
            <Label>Coluna</Label>
            <Select value={form.column_id || ''} onValueChange={v => setForm({ ...form, column_id: v })} disabled={readOnly}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {columns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Assignees */}
          <div className="space-y-1.5">
            <Label>Responsáveis</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(form.assignees || []).map(a => (
                <span key={a.user_id} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-xs">
                  <UserAvatar name={a.full_name || 'U'} avatarUrl={a.avatar_url || undefined} size="xs" />
                  {a.full_name}
                  {!readOnly && (
                    <button onClick={() => toggleAssignee({ id: a.user_id, full_name: a.full_name, avatar_url: a.avatar_url })}><X className="h-3 w-3" /></button>
                  )}
                </span>
              ))}
            </div>
            {!readOnly && (
              <Select onValueChange={v => {
                const p = profiles.find(p => p.id === v);
                if (p) toggleAssignee(p);
              }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="+ Adicionar responsável" /></SelectTrigger>
                <SelectContent>
                  {profiles.filter(p => !selectedAssigneeIds.includes(p.id)).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || 'Sem nome'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <TagManager
              selectedTags={form.tags || []}
              availableTags={tags}
              onChange={t => setForm({ ...form, tags: t })}
              onCreateTag={readOnly ? undefined : onCreateTag}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data início</Label>
              <Input
                type="date"
                value={form.start_date || ''}
                onChange={e => setForm({ ...form, start_date: e.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data vencimento</Label>
              <Input
                type="date"
                value={form.due_date || ''}
                onChange={e => setForm({ ...form, due_date: e.target.value })}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Checklist</Label>
              {checkTotal > 0 && (
                <span className="text-xs text-muted-foreground">{checkDone}/{checkTotal}</span>
              )}
            </div>
            {checkTotal > 0 && (
              <Progress value={(checkDone / checkTotal) * 100} className="h-1.5" />
            )}
            <div className="space-y-1">
              {(form.checklist || []).map(item => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={() => !readOnly && toggleCheck(item.id)}
                    disabled={readOnly}
                  />
                  <span className={`flex-1 text-sm ${item.checked ? 'line-through text-muted-foreground' : ''}`}>{item.text}</span>
                  {!readOnly && (
                    <button onClick={() => removeCheck(item.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!readOnly && (
              <div className="flex gap-1">
                <Input
                  value={newCheckItem}
                  onChange={e => setNewCheckItem(e.target.value)}
                  placeholder="Adicionar item"
                  className="h-7 text-xs"
                  onKeyDown={e => e.key === 'Enter' && addCheckItem()}
                />
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={addCheckItem}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {!readOnly && (
          <DrawerFooter className="flex-row justify-between border-t border-border px-5">
            <div className="flex gap-2">
              {!isNew && onDelete && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => form.id && onDelete(form.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
              )}
              {!isNew && onArchive && (
                <Button variant="ghost" size="sm" onClick={() => form.id && onArchive(form.id)}>
                  <Archive className="h-3.5 w-3.5 mr-1" /> Arquivar
                </Button>
              )}
            </div>
            <Button onClick={handleSave} disabled={!form.title?.trim() || saving}>
              💾 Salvar
            </Button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
