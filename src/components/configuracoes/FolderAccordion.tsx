import { useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, FolderPlus, MoreHorizontal, Pencil, Trash2, FolderOpen, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface Folder {
  id: string;
  name: string;
  scope: 'playbooks' | 'automations';
  sort_order: number;
  created_by: string;
  created_at: string;
}

export interface FolderAccordionProps<T extends { id: string; folder_id?: string | null }> {
  scope: 'playbooks' | 'automations';
  items: T[];
  folders: Folder[];
  renderItem: (item: T) => ReactNode;
  onMoveItem: (itemId: string, folderId: string | null) => Promise<void>;
  onFoldersChange: () => void;
  emptyMessage?: string;
}

export function FolderAccordion<T extends { id: string; folder_id?: string | null }>({
  scope,
  items,
  folders,
  renderItem,
  onMoveItem,
  onFoldersChange,
  emptyMessage = 'Nenhum item encontrado.',
}: FolderAccordionProps<T>) {
  const { user } = useAuth();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['__no_folder__']));
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);

  // Group items by folder
  const itemsByFolder = new Map<string | null, T[]>();
  folders.forEach(f => itemsByFolder.set(f.id, []));
  itemsByFolder.set(null, []);
  items.forEach(item => {
    const key = item.folder_id || null;
    if (!itemsByFolder.has(key)) itemsByFolder.set(key, []);
    itemsByFolder.get(key)!.push(item);
  });

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('config_folders' as any).insert({
      name: newFolderName.trim(),
      scope,
      sort_order: folders.length,
      created_by: user?.id,
    });
    if (error) toast.error('Erro ao criar pasta: ' + error.message);
    else {
      toast.success('Pasta criada!');
      setNewFolderName('');
      setNewFolderOpen(false);
      onFoldersChange();
    }
    setSaving(false);
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!editingName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('config_folders' as any).update({ name: editingName.trim() }).eq('id', folderId);
    if (error) toast.error('Erro ao renomear pasta: ' + error.message);
    else {
      toast.success('Pasta renomeada!');
      setEditingFolderId(null);
      onFoldersChange();
    }
    setSaving(false);
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Excluir esta pasta? Os itens serão movidos para "Sem pasta".')) return;
    const { error } = await supabase.from('config_folders' as any).delete().eq('id', folderId);
    if (error) toast.error('Erro ao excluir pasta: ' + error.message);
    else {
      toast.success('Pasta excluída!');
      onFoldersChange();
    }
  };

  const renderFolderSection = (folder: Folder | null, folderItems: T[]) => {
    const folderId = folder?.id || '__no_folder__';
    const isExpanded = expandedFolders.has(folderId);
    const isEditing = editingFolderId === folder?.id;

    return (
      <Collapsible key={folderId} open={isExpanded} onOpenChange={() => toggleFolder(folderId)}>
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 text-left",
                "hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              aria-expanded={isExpanded}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <FolderOpen className="h-4 w-4 text-primary/70" />
                {isEditing ? (
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Input
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      className="h-7 w-40 text-sm"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(folder!.id); if (e.key === 'Escape') setEditingFolderId(null); }}
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRenameFolder(folder!.id)} disabled={saving}>
                      <Check className="h-3 w-3 text-primary" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingFolderId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <span className="font-medium text-sm">{folder?.name || 'Sem pasta'}</span>
                )}
                <Badge variant="secondary" className="text-xs">{folderItems.length}</Badge>
              </div>
              {folder && !isEditing && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={e => { e.stopPropagation(); setEditingFolderId(folder.id); setEditingName(folder.name); }}>
                      <Pencil className="mr-2 h-3 w-3" />Renomear
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={e => { e.stopPropagation(); handleDeleteFolder(folder.id); }} className="text-destructive">
                      <Trash2 className="mr-2 h-3 w-3" />Excluir pasta
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border divide-y divide-border">
              {folderItems.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum item nesta pasta.</p>
              ) : (
                folderItems.map(item => (
                  <div key={item.id} className="group">
                    {renderItem(item)}
                  </div>
                ))
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  const noFolderItems = itemsByFolder.get(null) || [];

  return (
    <div className="space-y-3">
      {/* New folder button */}
      <div className="flex items-center gap-2">
        {newFolderOpen ? (
          <div className="flex items-center gap-2">
            <Input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Nome da pasta"
              className="h-8 w-48"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setNewFolderOpen(false); }}
            />
            <Button size="sm" onClick={handleCreateFolder} disabled={saving || !newFolderName.trim()}>
              <Check className="mr-1 h-3 w-3" />Criar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setNewFolderOpen(false); setNewFolderName(''); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setNewFolderOpen(true)}>
            <FolderPlus className="mr-1 h-4 w-4" />Nova pasta
          </Button>
        )}
      </div>

      {/* Folders */}
      {folders.map(folder => renderFolderSection(folder, itemsByFolder.get(folder.id) || []))}

      {/* No folder section */}
      {renderFolderSection(null, noFolderItems)}

      {/* Empty state */}
      {items.length === 0 && folders.length === 0 && (
        <Card className="py-12">
          <p className="text-center text-sm text-muted-foreground">{emptyMessage}</p>
        </Card>
      )}
    </div>
  );
}

// Hook to fetch folders for a scope
export function useFolders(scope: 'playbooks' | 'automations') {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFolders = async () => {
    const { data } = await supabase
      .from('config_folders' as any)
      .select('*')
      .eq('scope', scope)
      .order('sort_order');
    setFolders((data as Folder[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchFolders(); }, [scope]);

  return { folders, loading, refetch: fetchFolders };
}

// Move to folder dropdown for item actions
export function MoveToFolderMenu({
  folders,
  currentFolderId,
  onMove,
}: {
  folders: Folder[];
  currentFolderId: string | null;
  onMove: (folderId: string | null) => void;
}) {
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled className="text-xs text-muted-foreground font-semibold">
        Mover para pasta
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onMove(null)} disabled={!currentFolderId}>
        <FolderOpen className="mr-2 h-3 w-3" />Sem pasta
      </DropdownMenuItem>
      {folders.map(f => (
        <DropdownMenuItem key={f.id} onClick={() => onMove(f.id)} disabled={f.id === currentFolderId}>
          <FolderOpen className="mr-2 h-3 w-3" />{f.name}
        </DropdownMenuItem>
      ))}
    </>
  );
}
