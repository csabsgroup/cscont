import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileText, Trash2, Download, Loader2, File, Image, FileSpreadsheet, FileArchive } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UserAvatar } from '@/components/shared/UserAvatar';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getFileIcon(type: string | null) {
  if (!type) return <File className="h-4 w-4 text-muted-foreground" />;
  if (type.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />;
  if (type.includes('spreadsheet') || type.includes('csv') || type.includes('excel')) return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
  if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return <FileArchive className="h-4 w-4 text-amber-500" />;
  if (type.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

interface Props {
  officeId: string;
}

export function ClienteArquivos({ officeId }: Props) {
  const { isViewer, user } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    const { data } = await supabase
      .from('office_files' as any)
      .select('*')
      .eq('office_id', officeId)
      .is('note_id', null)
      .order('created_at', { ascending: false });
    setFiles(data || []);
    setLoading(false);
  }, [officeId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const uploadFile = async (file: globalThis.File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Arquivo "${file.name}" excede 10MB.`);
      return;
    }
    if (!user) return;

    setUploading(true);
    const path = `${officeId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('office-files')
      .upload(path, file);

    if (uploadError) {
      toast.error('Erro no upload: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('office-files').getPublicUrl(path);

    const { error: dbError } = await supabase.from('office_files' as any).insert({
      office_id: officeId,
      name: file.name,
      file_url: urlData.publicUrl,
      file_type: file.type || null,
      file_size: file.size,
      uploaded_by: user.id,
    });

    if (dbError) toast.error('Erro ao registrar: ' + dbError.message);
    else toast.success(`"${file.name}" enviado!`);

    // Audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'upload_file',
      entity_type: 'office_file',
      entity_id: officeId,
      details: { file_name: file.name },
    });

    setUploading(false);
    fetchFiles();
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    Array.from(fileList).forEach(uploadFile);
  };

  const handleDelete = async (f: any) => {
    if (!user) return;
    // Extract path from URL
    const urlParts = f.file_url.split('/office-files/');
    if (urlParts[1]) {
      await supabase.storage.from('office-files').remove([urlParts[1]]);
    }
    await supabase.from('office_files' as any).delete().eq('id', f.id);
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'delete_file',
      entity_type: 'office_file',
      entity_id: officeId,
      details: { file_name: f.name },
    });
    toast.success('Arquivo excluído.');
    fetchFiles();
  };

  const toggleShare = async (f: any) => {
    await supabase.from('office_files' as any).update({ share_with_client: !f.share_with_client }).eq('id', f.id);
    fetchFiles();
  };

  return (
    <div className="space-y-4">
      {!isViewer && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Arraste arquivos aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">Máximo 10MB por arquivo</p>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <FileText className="h-10 w-10 opacity-40 mb-2" />
          <p className="text-sm">Nenhum arquivo enviado.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Arquivo</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Enviado por</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Compartilhar</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((f: any) => (
              <TableRow key={f.id}>
                <TableCell>
                  <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
                    {getFileIcon(f.file_type)}
                    <span className="text-sm font-medium truncate max-w-[200px]">{f.name}</span>
                  </a>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatFileSize(f.file_size)}</TableCell>
                <TableCell><UserAvatar userId={f.uploaded_by} size="xs" /></TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(f.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}</TableCell>
                <TableCell>
                  {!isViewer ? (
                    <Switch checked={f.share_with_client} onCheckedChange={() => toggleShare(f)} />
                  ) : (
                    <span className="text-xs">{f.share_with_client ? 'Sim' : 'Não'}</span>
                  )}
                </TableCell>
                <TableCell>
                  {!isViewer && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(f)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
