import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Template {
  id: string;
  name: string;
  title_template: string | null;
  description_template: string | null;
  default_tags: string[];
  default_checklist: { id: string; text: string; checked: boolean }[];
  default_column_id: string | null;
}

interface NewCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Template[];
  onCreateBlank: () => void;
  onCreateFromTemplate: (template: Template) => void;
}

export function NewCardDialog({ open, onOpenChange, templates, onCreateBlank, onCreateFromTemplate }: NewCardDialogProps) {
  const [mode, setMode] = useState<'blank' | 'template'>('blank');
  const [selectedId, setSelectedId] = useState<string>('');

  const handleCreate = () => {
    if (mode === 'blank') {
      onCreateBlank();
    } else {
      const t = templates.find(t => t.id === selectedId);
      if (t) onCreateFromTemplate(t);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup value={mode} onValueChange={v => setMode(v as 'blank' | 'template')}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="blank" id="blank" />
              <Label htmlFor="blank" className="cursor-pointer">Em branco</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="template" id="template" />
              <Label htmlFor="template" className="cursor-pointer">A partir de template</Label>
            </div>
          </RadioGroup>

          {mode === 'template' && (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>📋 {t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={mode === 'template' && !selectedId}>
            Criar →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
