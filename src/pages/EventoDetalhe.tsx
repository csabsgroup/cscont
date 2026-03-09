import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Upload, Loader2, Trash2, Save, Calendar, MapPin, Users, FileText, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ParticipantManager } from '@/components/eventos/ParticipantManager';

const CATEGORIES = [
  { value: 'encontro', label: 'Encontro' },
  { value: 'imersao', label: 'Imersão' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'treinamento', label: 'Treinamento' },
  { value: 'confraternizacao', label: 'Confraternização' },
  { value: 'outro', label: 'Outro' },
];

const TYPE_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  online: 'Online',
  hibrido: 'Híbrido',
};

interface Product { id: string; name: string; }

export default function EventoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, isViewer } = useAuth();
  const readOnly = isViewer;

  const [event, setEvent] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Files tab state
  const [files, setFiles] = useState<any[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);

  const fetchEvent = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
    if (error || !data) { toast.error('Evento não encontrado'); navigate('/eventos'); return; }
    setEvent(data);
    setForm({
      title: data.title || '',
      description: data.description || '',
      event_date: data.event_date ? new Date(data.event_date).toISOString().slice(0, 16) : '',
      end_date: data.end_date ? new Date(data.end_date).toISOString().slice(0, 16) : '',
      location: data.location || '',
      type: data.type || 'presencial',
      category: data.category || 'encontro',
      observations: data.observations || '',
      confirmation_deadline_days: data.confirmation_deadline_days ?? 3,
      max_participants: data.max_participants || '',
      eligible_product_ids: data.eligible_product_ids || [],
      cover_url: data.cover_url || '',
    });
    setLoading(false);
  }, [id, navigate]);

  const fetchFiles = useCallback(async () => {
    if (!id) return;
    setFilesLoading(true);
    const { data } = await supabase.from('event_files').select('*').eq('event_id', id).order('created_at', { ascending: false });
    setFiles(data || []);
    setFilesLoading(false);
  }, [id]);

  useEffect(() => {
    fetchEvent();
    supabase.from('products').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setProducts(data || []));
    fetchFiles();
  }, [fetchEvent, fetchFiles]);

  const toggleProduct = (pid: string) => {
    setForm((prev: any) => ({
      ...prev,
      eligible_product_ids: prev.eligible_product_ids.includes(pid)
        ? prev.eligible_product_ids.filter((p: string) => p !== pid)
        : [...prev.eligible_product_ids, pid],
    }));
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !event) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${event.id}.${ext}`;
    const { error } = await supabase.storage.from('event-covers').upload(path, file, { upsert: true });
    if (error) { toast.error('Erro no upload: ' + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('event-covers').getPublicUrl(path);
    const coverUrl = urlData.publicUrl + '?t=' + Date.now();
    setForm((prev: any) => ({ ...prev, cover_url: coverUrl }));
    await supabase.from('events').update({ cover_url: coverUrl }).eq('id', event.id);
    setUploading(false);
    toast.success('Capa atualizada!');
  };

  const handleSave = async () => {
    if (!event) return;
    setSaving(true);
    const { error } = await supabase.from('events').update({
      title: form.title,
      description: form.description || null,
      event_date: new Date(form.event_date).toISOString(),
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      location: form.location || null,
      type: form.type,
      category: form.category,
      observations: form.observations || null,
      confirmation_deadline_days: form.confirmation_deadline_days || 3,
      max_participants: form.max_participants ? parseInt(form.max_participants) : null,
      eligible_product_ids: form.eligible_product_ids.length > 0 ? form.eligible_product_ids : null,
      cover_url: form.cover_url || null,
    }).eq('id', event.id);
    if (error) toast.error('Erro: ' + error.message);
    else toast.success('Evento salvo!');
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!event || !confirm('Tem certeza que deseja excluir este evento?')) return;
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Evento excluído!'); navigate('/eventos'); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || !event || !session?.user?.id) return;
    setFileUploading(true);
    for (const file of Array.from(fileList)) {
      const ext = file.name.split('.').pop();
      const path = `${event.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('event-files').upload(path, file);
      if (error) { toast.error(`Erro ao enviar ${file.name}: ${error.message}`); continue; }
      const { data: urlData } = supabase.storage.from('event-files').getPublicUrl(path);
      await supabase.from('event_files').insert({
        event_id: event.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: session.user.id,
      });
    }
    setFileUploading(false);
    toast.success('Arquivo(s) enviado(s)!');
    fetchFiles();
    e.target.value = '';
  };

  const handleDeleteFile = async (fileId: string, fileUrl: string) => {
    // Extract path from URL for storage deletion
    const urlParts = fileUrl.split('/event-files/');
    if (urlParts[1]) {
      const storagePath = decodeURIComponent(urlParts[1].split('?')[0]);
      await supabase.storage.from('event-files').remove([storagePath]);
    }
    await supabase.from('event_files').delete().eq('id', fileId);
    toast.success('Arquivo removido');
    fetchFiles();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) return null;

  const categoryLabel = CATEGORIES.find(c => c.value === form.category)?.label || form.category;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/eventos')} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar para Eventos
      </Button>

      {/* Cover header */}
      <div className="relative rounded-xl overflow-hidden bg-muted h-56 md:h-72">
        {form.cover_url ? (
          <img src={form.cover_url} alt="Capa" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40 text-lg">
            Sem imagem de capa
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">{form.title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="bg-white/20 text-white border-none backdrop-blur-sm">
                {TYPE_LABELS[form.type] || form.type}
              </Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-none backdrop-blur-sm">
                {categoryLabel}
              </Badge>
              {form.event_date && (
                <span className="text-white/90 text-sm flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(form.event_date), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
              {form.location && (
                <span className="text-white/90 text-sm flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {form.location}
                </span>
              )}
            </div>
          </div>
          {!readOnly && (
            <label className="cursor-pointer shrink-0">
              <Button size="sm" variant="secondary" className="pointer-events-none" disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                {uploading ? 'Enviando...' : 'Alterar capa'}
              </Button>
              <input type="file" accept="image/*" className="hidden" onChange={handleUploadCover} disabled={uploading} />
            </label>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="detalhes">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="detalhes" className="gap-1.5">
            <FileText className="h-4 w-4" /> Detalhes
          </TabsTrigger>
          <TabsTrigger value="confirmacao" className="gap-1.5">
            <Users className="h-4 w-4" /> Confirmação de Presença
          </TabsTrigger>
          <TabsTrigger value="arquivos" className="gap-1.5">
            <Plus className="h-4 w-4" /> Arquivos
          </TabsTrigger>
        </TabsList>

        {/* Detalhes Tab */}
        <TabsContent value="detalhes">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} disabled={readOnly} />
                </div>
                <div className="space-y-1.5">
                  <Label>Local</Label>
                  <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} disabled={readOnly} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} disabled={readOnly} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label>Início</Label>
                  <Input type="datetime-local" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} disabled={readOnly} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fim</Label>
                  <Input type="datetime-local" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} disabled={readOnly} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presencial">Presencial</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="hibrido">Híbrido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Prazo confirmação (dias antes)</Label>
                  <Input type="number" value={form.confirmation_deadline_days} onChange={e => setForm({ ...form, confirmation_deadline_days: parseInt(e.target.value) || 0 })} disabled={readOnly} />
                </div>
                <div className="space-y-1.5">
                  <Label>Máx. participantes</Label>
                  <Input type="number" value={form.max_participants} onChange={e => setForm({ ...form, max_participants: e.target.value })} disabled={readOnly} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Observações (visível ao cliente)</Label>
                <Textarea value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} rows={2} disabled={readOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Produtos Elegíveis</Label>
                <div className="flex flex-wrap gap-3 mt-1">
                  {products.map(p => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={form.eligible_product_ids?.includes(p.id)}
                        onCheckedChange={() => toggleProduct(p.id)}
                        disabled={readOnly}
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>

              {!readOnly && (
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSave} disabled={saving} className="flex-1">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Salvar
                  </Button>
                  <Button variant="destructive" size="icon" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Confirmação Tab */}
        <TabsContent value="confirmacao">
          <Card>
            <CardContent className="p-6">
              <ParticipantManager
                eventId={event.id}
                eligibleProductIds={form.eligible_product_ids || []}
                readOnly={readOnly}
                eventDate={event.event_date}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Arquivos Tab */}
        <TabsContent value="arquivos">
          <Card>
            <CardContent className="p-6 space-y-4">
              {!readOnly && (
                <div>
                  <label className="cursor-pointer inline-block">
                    <Button variant="outline" className="pointer-events-none gap-2" disabled={fileUploading}>
                      {fileUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {fileUploading ? 'Enviando...' : 'Enviar Arquivos'}
                    </Button>
                    <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={fileUploading} />
                  </label>
                </div>
              )}

              {filesLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : files.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum arquivo enviado.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {files.map(f => {
                    const isImage = f.mime_type?.startsWith('image/');
                    return (
                      <div key={f.id} className="relative rounded-lg border border-border overflow-hidden group">
                        {isImage ? (
                          <a href={f.file_url} target="_blank" rel="noopener noreferrer">
                            <img src={f.file_url} alt={f.file_name} className="h-40 w-full object-cover" />
                          </a>
                        ) : (
                          <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4">
                            <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{f.file_name}</p>
                              <p className="text-xs text-muted-foreground">{f.file_size ? `${(f.file_size / 1024).toFixed(1)} KB` : ''}</p>
                            </div>
                          </a>
                        )}
                        {isImage && (
                          <p className="px-3 py-1.5 text-xs truncate">{f.file_name}</p>
                        )}
                        {!readOnly && (
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteFile(f.id, f.file_url)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
