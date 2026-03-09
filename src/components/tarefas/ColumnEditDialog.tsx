import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const QUICK_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#16a34a',
  '#3b82f6', '#8b5cf6', '#000000', '#6b7280',
];

const ICON_OPTIONS = [
  { value: '', label: 'Nenhum' },
  { value: 'clipboard-list', label: '📋 Lista' },
  { value: 'pin', label: '📌 Pin' },
  { value: 'target', label: '🎯 Alvo' },
  { value: 'star', label: '⭐ Estrela' },
  { value: 'flame', label: '🔥 Fogo' },
  { value: 'rocket', label: '🚀 Foguete' },
  { value: 'circle-check', label: '✅ Check' },
  { value: 'hourglass', label: '⏳ Ampulheta' },
  { value: 'lock', label: '🔒 Cadeado' },
  { value: 'lightbulb', label: '💡 Ideia' },
  { value: 'zap', label: '⚡ Raio' },
  { value: 'calendar', label: '📅 Calendário' },
  { value: 'inbox', label: '📥 Inbox' },
];

interface ColumnEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column: {
    id: string; name: string; color: string;
    header_color: string | null; bg_color: string | null;
    bg_gradient_from: string | null; bg_gradient_to: string | null;
    bg_opacity: number | null; icon: string | null;
  } | null;
  onSave: (col: any) => Promise<void>;
}

type BgMode = 'solid' | 'gradient' | 'transparent';

export function ColumnEditDialog({ open, onOpenChange, column, onSave }: ColumnEditDialogProps) {
  const [name, setName] = useState('');
  const [headerColor, setHeaderColor] = useState('#374151');
  const [bgMode, setBgMode] = useState<BgMode>('solid');
  const [bgColor, setBgColor] = useState('#f3f4f6');
  const [gradFrom, setGradFrom] = useState('#3b82f6');
  const [gradTo, setGradTo] = useState('#8b5cf6');
  const [opacity, setOpacity] = useState(100);
  const [icon, setIcon] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (column) {
      setName(column.name);
      setHeaderColor(column.header_color || column.color || '#374151');
      setBgColor(column.bg_color || '#f3f4f6');
      setGradFrom(column.bg_gradient_from || '#3b82f6');
      setGradTo(column.bg_gradient_to || '#8b5cf6');
      setOpacity(column.bg_opacity ?? 100);
      setIcon(column.icon || '');
      if (column.bg_gradient_from && column.bg_gradient_to) {
        setBgMode('gradient');
      } else if (column.bg_color) {
        setBgMode('solid');
      } else {
        setBgMode('transparent');
      }
    }
  }, [column]);

  const handleSave = async () => {
    if (!column) return;
    setSaving(true);
    await onSave({
      id: column.id,
      name,
      color: headerColor,
      header_color: headerColor,
      bg_color: bgMode === 'solid' ? bgColor : bgMode === 'transparent' ? null : null,
      bg_gradient_from: bgMode === 'gradient' ? gradFrom : null,
      bg_gradient_to: bgMode === 'gradient' ? gradTo : null,
      bg_opacity: bgMode === 'transparent' ? 0 : opacity,
      icon: icon || null,
    });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Coluna</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>

          {/* Header color */}
          <div className="space-y-1.5">
            <Label>Cor do Header</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={headerColor} onChange={e => setHeaderColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0" />
              <div className="flex gap-1">
                {QUICK_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setHeaderColor(c)}
                    className={`h-6 w-6 rounded-full border-2 transition-all ${headerColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Background */}
          <div className="space-y-2">
            <Label>Background da Coluna</Label>
            <RadioGroup value={bgMode} onValueChange={v => setBgMode(v as BgMode)} className="space-y-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="solid" id="bg-solid" />
                <Label htmlFor="bg-solid" className="cursor-pointer">Cor sólida</Label>
                {bgMode === 'solid' && (
                  <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="h-6 w-6 rounded cursor-pointer border-0 ml-2" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="gradient" id="bg-gradient" />
                <Label htmlFor="bg-gradient" className="cursor-pointer">Gradiente</Label>
                {bgMode === 'gradient' && (
                  <div className="flex items-center gap-1 ml-2">
                    <input type="color" value={gradFrom} onChange={e => setGradFrom(e.target.value)} className="h-6 w-6 rounded cursor-pointer border-0" />
                    <span className="text-xs text-muted-foreground">→</span>
                    <input type="color" value={gradTo} onChange={e => setGradTo(e.target.value)} className="h-6 w-6 rounded cursor-pointer border-0" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="transparent" id="bg-transparent" />
                <Label htmlFor="bg-transparent" className="cursor-pointer">Transparente</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Opacity */}
          {bgMode !== 'transparent' && (
            <div className="space-y-1.5">
              <Label>Opacidade: {opacity}%</Label>
              <Slider value={[opacity]} onValueChange={v => setOpacity(v[0])} min={10} max={100} step={5} />
            </div>
          )}

          {/* Icon */}
          <div className="space-y-1.5">
            <Label>Ícone (opcional)</Label>
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Nenhum ícone" />
              </SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value || '_none'}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>💾 Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
