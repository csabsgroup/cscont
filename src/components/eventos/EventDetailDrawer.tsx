import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Upload, Loader2, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { ParticipantManager } from './ParticipantManager';

const CATEGORIES = [
  { value: 'encontro', label: 'Encontro' },
  { value: 'imersao', label: 'Imersão' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'treinamento', label: 'Treinamento' },
  { value: 'confraternizacao', label: 'Confraternização' },
  { value: 'outro', label: 'Outro' },
];

interface Props {
  event: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: { id: string; name: string }[];
  onSaved: () => void;
  readOnly?: boolean;
}

export function EventDetailDrawer({ event, open, onOpenChange, products, onSaved, readOnly }: Props) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (event) {
      setForm({
        title: event.title || '',
        description: event.description || '',
        event_date: event.event_date ? new Date(event.event_date).toISOString().slice(0, 16) : '',
        end_date: event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : '',
        location: event.location || '',
        type: event.type || 'presencial',
        category: event.category || 'encontro',
        observations: event.observations || '',
        confirmation_deadline_days: event.confirmation_deadline_days ?? 3,
        max_participants: event.max_participants || '',
        eligible_product_ids: event.eligible_product_ids || [],
        cover_url: event.cover_url || '',
      });
    }
  }, [event]);

  const toggleProduct = (id: string) => {
    setForm((prev: any) => ({
      ...prev,
      eligible_product_ids: prev.eligible_product_ids.includes(id)
        ? prev.eligible_product_ids.filter((p: string) => p !== id)
        : [...prev.eligible_product_ids, id],
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
    else { toast.success('Evento salvo!'); onSaved(); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!event || !confirm('Tem certeza que deseja excluir este evento?')) return;
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Evento excluído!'); onOpenChange(false); onSaved(); }
  };

  if (!event) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="p-5 pb-0">
          <SheetTitle className="text-lg">{readOnly ? 'Detalhes do Evento' : 'Editar Evento'}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 px-5 pb-5">
          <div className="space-y-5 pt-4">
            {/* Cover */}
            <div className="relative rounded-lg overflow-hidden bg-muted h-44">
              {form.cover_url ? (
                <img src={form.cover_url} alt="Capa" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                  Sem imagem de capa
                </div>
              )}
              {!readOnly && (
                <label className="absolute bottom-2 right-2 cursor-pointer">
                  <Button size="sm" variant="secondary" className="pointer-events-none" disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                    {uploading ? 'Enviando...' : 'Alterar capa'}
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadCover} disabled={uploading} />
                </label>
              )}
            </div>

            {/* Fields */}
            <div className="space-y-3">
              <div>
                <Label>Título</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} disabled={readOnly} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} disabled={readOnly} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Início</Label>
                  <Input type="datetime-local" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} disabled={readOnly} />
                </div>
                <div>
                  <Label>Fim</Label>
                  <Input type="datetime-local" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} disabled={readOnly} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Local</Label>
                  <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} disabled={readOnly} />
                </div>
                <div>
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prazo confirmação (dias antes)</Label>
                  <Input type="number" value={form.confirmation_deadline_days} onChange={e => setForm({ ...form, confirmation_deadline_days: parseInt(e.target.value) || 0 })} disabled={readOnly} />
                </div>
              </div>
              <div>
                <Label>Observações (visível ao cliente)</Label>
                <Textarea value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} rows={2} disabled={readOnly} />
              </div>
              <div>
                <Label>Produtos Elegíveis</Label>
                <div className="flex flex-wrap gap-2 mt-1">
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
              <div>
                <Label>Máx. participantes</Label>
                <Input type="number" value={form.max_participants} onChange={e => setForm({ ...form, max_participants: e.target.value })} disabled={readOnly} />
              </div>
            </div>

            {!readOnly && (
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar
                </Button>
                <Button variant="destructive" size="icon" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Separator />

            {/* Participants */}
            <ParticipantManager
              eventId={event.id}
              eligibleProductIds={form.eligible_product_ids || []}
              readOnly={readOnly}
              eventDate={event.event_date}
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
