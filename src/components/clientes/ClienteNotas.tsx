import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Save, FileText, Plus, Paperclip, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  officeId: string;
  initialNotes: string | null;
}

export function ClienteNotas({ officeId, initialNotes }: Props) {
  const { isViewer, user } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Also keep legacy notes field
  const [legacyNotes, setLegacyNotes] = useState(initialNotes || '');
  const [legacyDirty, setLegacyDirty] = useState(false);
  const [legacySaving, setLegacySaving] = useState(false);

  const fetchNotes = useCallback(async () => {
    const { data } = await supabase
      .from('office_notes')
      .select('*')
      .eq('office_id', officeId)
      .order('created_at', { ascending: false });
    
    // Fetch attachments for notes
    const noteIds = (data || []).map((n: any) => n.id);
    let filesMap: Record<string, any[]> = {};
    if (noteIds.length > 0) {
      const { data: files } = await supabase
        .from('office_files')
        .select('*')
        .in('note_id', noteIds);
      (files || []).forEach((f: any) => {
        if (!filesMap[f.note_id]) filesMap[f.note_id] = [];
        filesMap[f.note_id].push(f);
      });
    }

    setNotes((data || []).map((n: any) => ({ ...n, attachments: filesMap[n.id] || [] })));
    setLoading(false);
  }, [officeId]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const handleSaveLegacy = async () => {
    setLegacySaving(true);
    const { error } = await supabase.from('offices').update({ notes: legacyNotes }).eq('id', officeId);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else { toast.success('Notas salvas!'); setLegacyDirty(false); }
    setLegacySaving(false);
  };

  const handleAddNote = async () => {
    if (!newContent.trim() || !user) return;
    setSaving(true);

    const { data: noteData, error } = await supabase.from('office_notes').insert({
      office_id: officeId,
      content: newContent.trim(),
      created_by: user.id,
      note_type: 'observacao',
    }).select().single();

    if (error) {
      toast.error('Erro: ' + error.message);
      setSaving(false);
      return;
    }

    // Upload attachment if any
    if (attachFile && noteData) {
      const path = `${officeId}/${Date.now()}_${attachFile.name}`;
      const { error: upErr } = await supabase.storage.from('office-files').upload(path, attachFile);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('office-files').getPublicUrl(path);
        await supabase.from('office_files').insert({
          office_id: officeId,
          note_id: noteData.id,
          name: attachFile.name,
          file_url: urlData.publicUrl,
          file_type: attachFile.type || null,
          file_size: attachFile.size,
          uploaded_by: user.id,
        });
      }
    }

    toast.success('Nota adicionada!');
    setNewContent('');
    setAttachFile(null);
    setSaving(false);
    fetchNotes();
  };

  const handleDeleteNote = async (noteId: string) => {
    await supabase.from('office_files').delete().eq('note_id', noteId);
    await supabase.from('office_notes').delete().eq('id', noteId);
    toast.success('Nota excluída.');
    fetchNotes();
  };

  return (
    <div className="space-y-6">
      {/* New note form */}
      {!isViewer && (
        <div className="space-y-3 border rounded-lg p-4">
          <Textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="Adicione uma nova nota..."
            className="min-h-[80px]"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" className="hidden" onChange={e => setAttachFile(e.target.files?.[0] || null)} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Paperclip className="mr-1 h-3.5 w-3.5" /> Anexar
              </Button>
              {attachFile && (
                <span className="text-xs text-muted-foreground">{attachFile.name}</span>
              )}
            </div>
            <Button size="sm" onClick={handleAddNote} disabled={saving || !newContent.trim()}>
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : notes.length === 0 && !initialNotes ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 opacity-40 mb-2" />
          <p className="text-sm">Nenhuma nota adicionada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note: any) => (
            <div key={note.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <UserAvatar userId={note.created_by} size="xs" />
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(note.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {!isViewer && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteNote(note.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              {note.attachments?.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  {note.attachments.map((f: any) => (
                    <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Paperclip className="h-3 w-3" /> {f.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Legacy notes */}
      {initialNotes && (
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Notas legadas
            </p>
            {!isViewer && legacyDirty && (
              <Button size="sm" onClick={handleSaveLegacy} disabled={legacySaving}>
                <Save className="mr-2 h-4 w-4" />
                {legacySaving ? 'Salvando...' : 'Salvar'}
              </Button>
            )}
          </div>
          <Textarea
            value={legacyNotes}
            onChange={e => { setLegacyNotes(e.target.value); setLegacyDirty(true); }}
            className="min-h-[120px]"
            disabled={isViewer}
          />
        </div>
      )}
    </div>
  );
}
