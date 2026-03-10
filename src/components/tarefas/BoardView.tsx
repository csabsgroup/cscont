import { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { BoardColumn } from './BoardColumn';
import { CardEditDrawer } from './CardEditDrawer';
import { NewCardDialog } from './NewCardDialog';
import { ColumnConfigDialog } from './ColumnConfigDialog';
import { ColumnEditDialog } from './ColumnEditDialog';
import { DeleteColumnDialog } from './DeleteColumnDialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Settings, Plus } from 'lucide-react';
import type { BoardCardData } from './BoardCard';

interface Profile { id: string; full_name: string | null; avatar_url: string | null; }
interface Tag { id: string; name: string; color: string; }
export interface Column {
  id: string; name: string; color: string; sort_order: number;
  header_color: string | null; bg_color: string | null;
  bg_gradient_from: string | null; bg_gradient_to: string | null;
  bg_opacity: number | null; icon: string | null;
  created_by: string | null;
}
interface Template {
  id: string; name: string; title_template: string | null;
  description_template: string | null; default_tags: string[];
  default_checklist: { id: string; text: string; checked: boolean }[];
  default_column_id: string | null;
}

export function BoardView() {
  const { user, role, isAdmin, isManager, isViewer } = useAuth();
  const { toast } = useToast();
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<BoardCardData[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCsm, setFilterCsm] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [onlyMine, setOnlyMine] = useState(false);

  // Dialogs
  const [editCard, setEditCard] = useState<Partial<BoardCardData> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [colConfigOpen, setColConfigOpen] = useState(false);

  // Column edit/delete
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  const [deletingColumn, setDeletingColumn] = useState<Column | null>(null);

  // Add column inline
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState('');

  const canEditColumns = isAdmin || isManager;

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch internal users via user_roles join
    const [colRes, cardRes, tagRes, roleRes, tmplRes] = await Promise.all([
      supabase.from('board_columns').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('board_cards').select('*, board_card_assignees(user_id)').eq('status', 'active').order('sort_order'),
      supabase.from('board_tags').select('*').order('name'),
      supabase.from('user_roles').select('user_id, role').in('role', ['admin', 'manager', 'csm']),
      supabase.from('board_card_templates').select('*').eq('is_active', true),
    ]);

    // Get profile details for internal users only
    const internalUserIds = (roleRes.data || []).map((r: any) => r.user_id);
    let internalProfiles: Profile[] = [];
    if (internalUserIds.length > 0) {
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', internalUserIds);
      internalProfiles = (profData || []) as Profile[];
    }

    setColumns((colRes.data || []) as Column[]);
    setTags((tagRes.data || []) as Tag[]);
    setProfiles(internalProfiles);
    setTemplates((tmplRes.data || []).map((t: any) => ({
      ...t,
      default_tags: t.default_tags || [],
      default_checklist: t.default_checklist || [],
    })) as Template[]);

    // Enrich cards with assignee profiles
    const rawCards = (cardRes.data || []) as any[];
    const enriched: BoardCardData[] = rawCards.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      tags: c.tags || [],
      start_date: c.start_date,
      due_date: c.due_date,
      completed_at: c.completed_at,
      sort_order: c.sort_order,
      column_id: c.column_id,
      checklist: c.checklist || [],
      status: c.status,
      priority: c.priority || 'medium',
      created_by: c.created_by,
      assignees: (c.board_card_assignees || []).map((a: any) => {
        const p = internalProfiles.find(pr => pr.id === a.user_id);
        return { user_id: a.user_id, full_name: p?.full_name || null, avatar_url: p?.avatar_url || null };
      }),
    }));
    setCards(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tagColors = useMemo(() => {
    const m: Record<string, string> = {};
    tags.forEach(t => { m[t.name] = t.color; });
    return m;
  }, [tags]);

  // Filters
  const filtered = useMemo(() => {
    let res = cards;
    if (onlyMine && user) res = res.filter(c => c.assignees.some(a => a.user_id === user.id));
    if (filterCsm !== 'all') res = res.filter(c => c.assignees.some(a => a.user_id === filterCsm));
    if (filterTag !== 'all') res = res.filter(c => c.tags.includes(filterTag));
    return res;
  }, [cards, onlyMine, filterCsm, filterTag, user]);

  const cardsByColumn = useMemo(() => {
    const m: Record<string, BoardCardData[]> = {};
    columns.forEach(col => { m[col.id] = []; });
    filtered.forEach(c => { if (m[c.column_id]) m[c.column_id].push(c); });
    Object.values(m).forEach(arr => arr.sort((a, b) => a.sort_order - b.sort_order));
    return m;
  }, [filtered, columns]);

  // Drag & Drop - handles both CARD and COLUMN types
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || isViewer) return;
    const { source, destination, draggableId, type } = result;

    if (type === 'COLUMN') {
      if (!canEditColumns) return;
      const reordered = Array.from(columns);
      const [moved] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, moved);
      const updated = reordered.map((c, i) => ({ ...c, sort_order: i }));
      setColumns(updated);
      for (const col of updated) {
        await supabase.from('board_columns').update({ sort_order: col.sort_order }).eq('id', col.id);
      }
      return;
    }

    // CARD drag
    const newCards = [...cards];
    const cardIdx = newCards.findIndex(c => c.id === draggableId);
    if (cardIdx === -1) return;
    const card = { ...newCards[cardIdx] };

    const srcCards = newCards
      .filter(c => c.column_id === source.droppableId && c.id !== draggableId)
      .sort((a, b) => a.sort_order - b.sort_order);

    card.column_id = destination.droppableId;

    const destCards = source.droppableId === destination.droppableId
      ? srcCards
      : newCards.filter(c => c.column_id === destination.droppableId).sort((a, b) => a.sort_order - b.sort_order);
    destCards.splice(destination.index, 0, card);

    const updates: { id: string; column_id: string; sort_order: number }[] = [];
    destCards.forEach((c, i) => {
      c.sort_order = i;
      c.column_id = destination.droppableId;
      updates.push({ id: c.id, column_id: destination.droppableId, sort_order: i });
    });

    if (source.droppableId !== destination.droppableId) {
      srcCards.forEach((c, i) => {
        c.sort_order = i;
        updates.push({ id: c.id, column_id: source.droppableId, sort_order: i });
      });
    }

    setCards(prev => {
      const map = new Map(updates.map(u => [u.id, u]));
      return prev.map(c => {
        const upd = map.get(c.id);
        return upd ? { ...c, column_id: upd.column_id, sort_order: upd.sort_order } : c;
      });
    });

    for (const u of updates) {
      await supabase.from('board_cards').update({ column_id: u.column_id, sort_order: u.sort_order, updated_at: new Date().toISOString() }).eq('id', u.id);
    }
  };

  // CRUD
  const saveCard = async (data: Partial<BoardCardData>) => {
    const assignees = data.assignees || [];
    const isNew = !data.id;

    if (isNew) {
      const colCards = cards.filter(c => c.column_id === data.column_id);
      const { data: inserted, error } = await supabase.from('board_cards').insert({
        title: data.title!,
        description: data.description || null,
        tags: data.tags || [],
        start_date: data.start_date || null,
        due_date: data.due_date || null,
        checklist: data.checklist || [],
        column_id: data.column_id || columns[0]?.id,
        sort_order: colCards.length,
        priority: data.priority || 'medium',
        created_by: user?.id,
      }).select().single();
      if (error) { toast({ title: 'Erro ao criar tarefa', variant: 'destructive' }); return; }
      if (assignees.length > 0) {
        await supabase.from('board_card_assignees').insert(assignees.map(a => ({ card_id: inserted.id, user_id: a.user_id })));
      }
    } else {
      const { error } = await supabase.from('board_cards').update({
        title: data.title,
        description: data.description || null,
        tags: data.tags || [],
        start_date: data.start_date || null,
        due_date: data.due_date || null,
        checklist: data.checklist || [],
        column_id: data.column_id,
        priority: data.priority || 'medium',
        updated_at: new Date().toISOString(),
      }).eq('id', data.id!);
      if (error) { toast({ title: 'Erro ao salvar', variant: 'destructive' }); return; }
      await supabase.from('board_card_assignees').delete().eq('card_id', data.id!);
      if (assignees.length > 0) {
        await supabase.from('board_card_assignees').insert(assignees.map(a => ({ card_id: data.id!, user_id: a.user_id })));
      }
    }
    await fetchData();
  };

  const deleteCard = async (id: string) => {
    await supabase.from('board_cards').delete().eq('id', id);
    setDrawerOpen(false);
    await fetchData();
  };

  const archiveCard = async (id: string) => {
    await supabase.from('board_cards').update({ status: 'archived' }).eq('id', id);
    setDrawerOpen(false);
    await fetchData();
  };

  const quickAdd = async (columnId: string, title: string) => {
    const colCards = cards.filter(c => c.column_id === columnId);
    const { error } = await supabase.from('board_cards').insert({
      title, column_id: columnId, sort_order: colCards.length, created_by: user?.id,
    });
    if (!error) await fetchData();
  };

  const createTag = async (name: string, color: string) => {
    await supabase.from('board_tags').insert({ name, color, created_by: user?.id });
    const { data } = await supabase.from('board_tags').select('*').order('name');
    setTags((data || []) as Tag[]);
  };

  // Column config
  const saveColumns = async (cols: { id?: string; name: string; color: string; sort_order: number }[]) => {
    for (const col of cols) {
      if (col.id) {
        await supabase.from('board_columns').update({ name: col.name, color: col.color, sort_order: col.sort_order }).eq('id', col.id);
      } else {
        await supabase.from('board_columns').insert({ name: col.name, color: col.color, sort_order: col.sort_order, created_by: user?.id });
      }
    }
    await fetchData();
  };

  const deleteColumn = async (id: string): Promise<boolean> => {
    const count = cards.filter(c => c.column_id === id).length;
    if (count > 0) { toast({ title: 'Mova os cards antes de excluir a coluna', variant: 'destructive' }); return false; }
    const { error } = await supabase.from('board_columns').delete().eq('id', id);
    return !error;
  };

  // Column edit dialog save
  const saveColumnEdit = async (col: Partial<Column> & { id: string }) => {
    const { error } = await supabase.from('board_columns').update({
      name: col.name,
      color: col.color,
      header_color: col.header_color,
      bg_color: col.bg_color,
      bg_gradient_from: col.bg_gradient_from || null,
      bg_gradient_to: col.bg_gradient_to || null,
      bg_opacity: col.bg_opacity ?? 100,
      icon: col.icon || null,
    }).eq('id', col.id);
    if (error) { toast({ title: 'Erro ao salvar coluna', variant: 'destructive' }); return; }
    await fetchData();
  };

  // Move cards from deleted column to another
  const moveCardsAndDelete = async (fromColId: string, toColId: string) => {
    const colCards = cards.filter(c => c.column_id === fromColId);
    const existingCount = cards.filter(c => c.column_id === toColId).length;
    for (let i = 0; i < colCards.length; i++) {
      await supabase.from('board_cards').update({
        column_id: toColId,
        sort_order: existingCount + i,
      }).eq('id', colCards[i].id);
    }
    await supabase.from('board_columns').delete().eq('id', fromColId);
    setDeletingColumn(null);
    await fetchData();
  };

  // Move column left/right
  const moveColumn = async (colId: string, direction: 'left' | 'right') => {
    const idx = columns.findIndex(c => c.id === colId);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= columns.length) return;
    const reordered = [...columns];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
    const updated = reordered.map((c, i) => ({ ...c, sort_order: i }));
    setColumns(updated);
    for (const col of updated) {
      await supabase.from('board_columns').update({ sort_order: col.sort_order }).eq('id', col.id);
    }
  };

  // Archive all cards in column
  const archiveAllInColumn = async (colId: string) => {
    const colCards = cards.filter(c => c.column_id === colId);
    for (const c of colCards) {
      await supabase.from('board_cards').update({ status: 'archived' }).eq('id', c.id);
    }
    await fetchData();
  };

  // Add column inline
  const submitNewColumn = async () => {
    if (!newColName.trim()) { setAddingColumn(false); return; }
    await supabase.from('board_columns').insert({
      name: newColName.trim(),
      color: '#6b7280',
      sort_order: columns.length,
      created_by: user?.id,
    });
    setNewColName('');
    setAddingColumn(false);
    await fetchData();
  };

  const openNewBlank = () => {
    setEditCard({ column_id: columns[0]?.id, tags: [], checklist: [], assignees: [] });
    setDrawerOpen(true);
  };

  const openFromTemplate = (t: Template) => {
    setEditCard({
      column_id: t.default_column_id || columns[0]?.id,
      title: t.title_template || '',
      description: t.description_template || '',
      tags: t.default_tags || [],
      checklist: (t.default_checklist || []).map(c => ({ ...c, id: crypto.randomUUID() })),
      assignees: [],
    });
    setDrawerOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {(isAdmin || !isViewer) && (
          <Select value={filterCsm} onValueChange={setFilterCsm}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="CSM" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name || 'Sem nome'}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Tag" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {tags.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <Checkbox checked={onlyMine} onCheckedChange={v => setOnlyMine(!!v)} />
          Apenas minhas
        </label>
        <div className="flex-1" />
        {!isViewer && (
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova tarefa
          </Button>
        )}
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setColConfigOpen(true)}>
            <Settings className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Board with column drag & drop */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="board-columns" direction="horizontal" type="COLUMN">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex gap-3 overflow-x-auto flex-1 pb-4"
            >
              {columns.map((col, idx) => (
                <Draggable key={col.id} draggableId={`col-${col.id}`} index={idx} isDragDisabled={!canEditColumns}>
                  {(dragProvided) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                    >
                      <BoardColumn
                        column={col}
                        cards={cardsByColumn[col.id] || []}
                        tagColors={tagColors}
                        readOnly={isViewer}
                        canEditColumn={canEditColumns && (isAdmin || col.created_by === user?.id)}
                        dragHandleProps={dragProvided.dragHandleProps}
                        onCardClick={card => { setEditCard(card); setDrawerOpen(true); }}
                        onQuickAdd={quickAdd}
                        onEditColumn={() => setEditingColumn(col)}
                        onDeleteColumn={() => setDeletingColumn(col)}
                        onMoveLeft={() => moveColumn(col.id, 'left')}
                        onMoveRight={() => moveColumn(col.id, 'right')}
                        onArchiveAll={() => archiveAllInColumn(col.id)}
                        isFirst={idx === 0}
                        isLast={idx === columns.length - 1}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              {/* Add column button */}
              {canEditColumns && (
                <div className="min-w-[260px] w-[260px] shrink-0">
                  {addingColumn ? (
                    <div className="rounded-card bg-muted/40 border border-border/60 p-3 space-y-2">
                      <Input
                        value={newColName}
                        onChange={e => setNewColName(e.target.value)}
                        placeholder="Nome da coluna..."
                        className="h-8 text-xs"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') submitNewColumn();
                          if (e.key === 'Escape') setAddingColumn(false);
                        }}
                        onBlur={submitNewColumn}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingColumn(true)}
                      className="flex items-center gap-2 w-full rounded-card border border-dashed border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                    >
                      <Plus className="h-4 w-4" /> Adicionar coluna
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Drawer */}
      <CardEditDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        card={editCard}
        columns={columns}
        profiles={profiles}
        tags={tags}
        readOnly={isViewer}
        onSave={saveCard}
        onDelete={isAdmin || editCard?.created_by === user?.id ? deleteCard : undefined}
        onArchive={archiveCard}
        onCreateTag={createTag}
      />

      {/* New dialog */}
      <NewCardDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        templates={templates}
        onCreateBlank={openNewBlank}
        onCreateFromTemplate={openFromTemplate}
      />

      {/* Column config */}
      <ColumnConfigDialog
        open={colConfigOpen}
        onOpenChange={setColConfigOpen}
        columns={columns.map(c => ({ ...c, cardCount: (cardsByColumn[c.id] || []).length }))}
        onSave={saveColumns}
        onDelete={deleteColumn}
      />

      {/* Column edit dialog */}
      <ColumnEditDialog
        open={!!editingColumn}
        onOpenChange={open => { if (!open) setEditingColumn(null); }}
        column={editingColumn}
        onSave={saveColumnEdit}
      />

      {/* Delete column dialog */}
      <DeleteColumnDialog
        open={!!deletingColumn}
        onOpenChange={open => { if (!open) setDeletingColumn(null); }}
        column={deletingColumn}
        cardCount={deletingColumn ? cards.filter(c => c.column_id === deletingColumn.id).length : 0}
        otherColumns={columns.filter(c => c.id !== deletingColumn?.id)}
        onConfirmDelete={async () => {
          if (!deletingColumn) return;
          const ok = await deleteColumn(deletingColumn.id);
          if (ok) { setDeletingColumn(null); await fetchData(); }
        }}
        onMoveAndDelete={moveCardsAndDelete}
      />
    </div>
  );
}
