import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InlineEditFieldProps {
  value: string | number | null;
  fieldType: 'text' | 'number' | 'currency' | 'date' | 'phone' | 'email' | 'dropdown' | 'textarea';
  onSave: (newValue: string | number | null) => Promise<void>;
  readOnly?: boolean;
  label: string;
  options?: string[];
  placeholder?: string;
}

function formatCurrency(v: number | null): string {
  if (v == null || v === 0) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDisplay(value: string | number | null, fieldType: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (fieldType === 'currency') return formatCurrency(Number(value));
  return String(value);
}

function parseInputValue(raw: string, fieldType: string): string | number | null {
  if (!raw || raw.trim() === '') return null;
  if (fieldType === 'currency' || fieldType === 'number') {
    const cleaned = raw.replace(/[^\d.,-]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return raw.trim();
}

export function InlineEditField({ value, fieldType, onSave, readOnly, label, options, placeholder }: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    if (readOnly) return;
    const raw = value != null ? String(value) : '';
    setEditValue(raw);
    setEditing(true);
  }, [readOnly, value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const cancel = () => { setEditing(false); };

  const save = async () => {
    if (saving) return;
    const parsed = fieldType === 'dropdown' ? editValue : parseInputValue(editValue, fieldType);
    // Don't save if value hasn't changed
    const currentStr = value != null ? String(value) : '';
    const newStr = parsed != null ? String(parsed) : '';
    if (currentStr === newStr) { setEditing(false); return; }

    setSaving(true);
    try {
      await onSave(parsed);
      setEditing(false);
      setFlash(true);
      setTimeout(() => setFlash(false), 1000);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Don't save on blur if clicking save/cancel buttons
    const related = e.relatedTarget as HTMLElement;
    if (related?.closest('[data-inline-action]')) return;
    save();
  };

  if (editing) {
    if (fieldType === 'dropdown' && options) {
      return (
        <div className="flex items-center gap-1">
          <Select value={editValue} onValueChange={(v) => { setEditValue(v); }}>
            <SelectTrigger className="h-7 text-sm flex-1">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button data-inline-action size="icon" variant="ghost" className="h-6 w-6" onClick={save} disabled={saving}><Check className="h-3 w-3 text-green-600" /></Button>
          <Button data-inline-action size="icon" variant="ghost" className="h-6 w-6" onClick={cancel}><X className="h-3 w-3 text-destructive" /></Button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type={fieldType === 'date' ? 'date' : fieldType === 'email' ? 'email' : fieldType === 'number' || fieldType === 'currency' ? 'number' : 'text'}
          step={fieldType === 'currency' ? '0.01' : undefined}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="h-7 text-sm flex-1"
          placeholder={placeholder}
        />
        <Button data-inline-action size="icon" variant="ghost" className="h-6 w-6" onClick={save} disabled={saving}><Check className="h-3 w-3 text-green-600" /></Button>
        <Button data-inline-action size="icon" variant="ghost" className="h-6 w-6" onClick={cancel}><X className="h-3 w-3 text-destructive" /></Button>
      </div>
    );
  }

  // Display mode
  return (
    <div
      className={cn(
        'group flex items-center gap-1 min-h-[24px] transition-colors rounded',
        !readOnly && 'cursor-pointer hover:bg-muted/50',
        flash && 'animate-pulse bg-green-100 dark:bg-green-900/30'
      )}
      onClick={startEdit}
    >
      <span className="text-sm font-semibold text-foreground truncate">
        {formatDisplay(value, fieldType)}
      </span>
      {!readOnly && (
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </div>
  );
}
