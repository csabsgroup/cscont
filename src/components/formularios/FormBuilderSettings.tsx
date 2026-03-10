import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Loader2 } from 'lucide-react';

interface FormSettings {
  collect_email?: boolean;
  limit_one_response?: boolean;
  allow_edit?: boolean;
  show_progress?: boolean;
  shuffle_questions?: boolean;
  confirmation_message?: string;
  is_accepting_responses?: boolean;
}

interface FormTheme {
  primary_color?: string;
  bg_color?: string;
  header_image_url?: string;
  font_style?: string;
}

interface Props {
  settings: FormSettings;
  theme: FormTheme;
  isPublished: boolean;
  formType: string;
  description: string;
  productId: string;
  products: { id: string; name: string }[];
  onSettingsChange: (s: FormSettings) => void;
  onThemeChange: (t: FormTheme) => void;
  onPublishedChange: (v: boolean) => void;
  onFormTypeChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onProductIdChange: (v: string) => void;
}

export function FormBuilderSettings({
  settings, theme, isPublished, formType, description, productId, products,
  onSettingsChange, onThemeChange, onPublishedChange, onFormTypeChange, onDescriptionChange, onProductIdChange,
}: Props) {
  const [uploading, setUploading] = useState(false);

  const handleHeaderUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `headers/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('form-assets').upload(path, file);
    if (error) {
      toast.error('Erro no upload: ' + error.message);
    } else {
      const { data: { publicUrl } } = supabase.storage.from('form-assets').getPublicUrl(path);
      onThemeChange({ ...theme, header_image_url: publicUrl });
    }
    setUploading(false);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* General */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Geral</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => onDescriptionChange(e.target.value)} placeholder="Descrição do formulário" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formType} onValueChange={onFormTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">📋 Interno (CSM preenche)</SelectItem>
                  <SelectItem value="external">📊 Externo (Cliente responde)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={productId || '__all__'} onValueChange={v => onProductIdChange(v === '__all__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Publishing */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Publicação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Publicado</Label>
              <p className="text-xs text-muted-foreground">Formulário visível e acessível</p>
            </div>
            <Switch checked={isPublished} onCheckedChange={onPublishedChange} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Aceitando respostas</Label>
              <p className="text-xs text-muted-foreground">Permite novas submissões</p>
            </div>
            <Switch
              checked={settings.is_accepting_responses !== false}
              onCheckedChange={v => onSettingsChange({ ...settings, is_accepting_responses: v })}
              disabled={!isPublished}
            />
          </div>
        </CardContent>
      </Card>

      {/* Responses */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Respostas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Limitar a 1 resposta por cliente</Label>
            <Switch checked={settings.limit_one_response || false} onCheckedChange={v => onSettingsChange({ ...settings, limit_one_response: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Coletar e-mail</Label>
            <Switch checked={settings.collect_email || false} onCheckedChange={v => onSettingsChange({ ...settings, collect_email: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Permitir edição após envio</Label>
            <Switch checked={settings.allow_edit || false} onCheckedChange={v => onSettingsChange({ ...settings, allow_edit: v })} />
          </div>
        </CardContent>
      </Card>

      {/* Presentation */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Apresentação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Barra de progresso</Label>
            <Switch checked={settings.show_progress || false} onCheckedChange={v => onSettingsChange({ ...settings, show_progress: v })} />
          </div>
          <div className="space-y-2">
            <Label>Mensagem de confirmação</Label>
            <Textarea
              value={settings.confirmation_message || ''}
              onChange={e => onSettingsChange({ ...settings, confirmation_message: e.target.value })}
              placeholder="Obrigado! Sua resposta foi registrada."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Tema visual</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cor primária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.primary_color || '#7c3aed'}
                  onChange={e => onThemeChange({ ...theme, primary_color: e.target.value })}
                  className="w-8 h-8 rounded border cursor-pointer"
                />
                <Input className="h-8 text-xs" value={theme.primary_color || '#7c3aed'}
                  onChange={e => onThemeChange({ ...theme, primary_color: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor de fundo</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.bg_color || '#f3f4f6'}
                  onChange={e => onThemeChange({ ...theme, bg_color: e.target.value })}
                  className="w-8 h-8 rounded border cursor-pointer"
                />
                <Input className="h-8 text-xs" value={theme.bg_color || '#f3f4f6'}
                  onChange={e => onThemeChange({ ...theme, bg_color: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Imagem do cabeçalho</Label>
            {theme.header_image_url && (
              <div className="relative rounded-lg overflow-hidden h-24">
                <img src={theme.header_image_url} alt="" className="w-full h-full object-cover" />
                <Button size="sm" variant="destructive" className="absolute top-1 right-1 h-6 text-xs"
                  onClick={() => onThemeChange({ ...theme, header_image_url: '' })}>Remover</Button>
              </div>
            )}
            <Button variant="outline" size="sm" disabled={uploading} onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = (e: any) => {
                const file = e.target.files?.[0];
                if (file) handleHeaderUpload(file);
              };
              input.click();
            }}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Upload imagem
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Estilo de fonte</Label>
            <Select value={theme.font_style || 'default'} onValueChange={v => onThemeChange({ ...theme, font_style: v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Padrão</SelectItem>
                <SelectItem value="serif">Serif</SelectItem>
                <SelectItem value="mono">Monospace</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
