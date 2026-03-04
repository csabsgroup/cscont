import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  officeId: string;
  initialNotes: string | null;
}

export function ClienteNotas({ officeId, initialNotes }: Props) {
  const { isViewer } = useAuth();
  const [notes, setNotes] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('offices').update({ notes }).eq('id', officeId);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else { toast.success('Notas salvas!'); setDirty(false); }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <FileText className="h-4 w-4" /> Notas do escritório
        </p>
        {!isViewer && dirty && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        )}
      </div>
      <Textarea
        value={notes}
        onChange={e => { setNotes(e.target.value); setDirty(true); }}
        placeholder="Adicione notas sobre este escritório..."
        className="min-h-[200px]"
        disabled={isViewer}
      />
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        📎 Upload de arquivos disponível em breve
      </div>
    </div>
  );
}
