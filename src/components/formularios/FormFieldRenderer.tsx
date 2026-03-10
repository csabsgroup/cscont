import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Star, Heart, ThumbsUp } from 'lucide-react';

export interface FormFieldDef {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  description?: string;
  required: boolean;
  options?: string[];
  allow_other?: boolean;
  scale_min?: number;
  scale_max?: number;
  scale_low_label?: string;
  scale_high_label?: string;
  rating_icon?: 'star' | 'heart' | 'thumbs_up';
  rating_max?: number;
  grid_rows?: string[];
  grid_columns?: string[];
  include_year?: boolean;
  include_time?: boolean;
  time_is_duration?: boolean;
  max_files?: number;
  max_file_size_mb?: number;
  accepted_file_types?: string[];
  section_id?: string | null;
  order: number;
  header_mapping?: { enabled: boolean; target_field: string };
  conditional_logic?: any;
  controls_meeting_date?: boolean;
  validation?: {
    type?: string;
    pattern?: string;
    error_message?: string;
    min_length?: number;
    max_length?: number;
    min_selections?: number;
    max_selections?: number;
    min_value?: number;
    max_value?: number;
  };
}

interface Props {
  field: FormFieldDef;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

export function FormFieldRenderer({ field, value, onChange, error, disabled }: Props) {
  const resolvedType = resolveType(field.type);

  const renderInput = () => {
    switch (resolvedType) {
      case 'short_answer':
        return (
          <Input
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
          />
        );

      case 'paragraph':
        return (
          <Textarea
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            disabled={disabled}
          />
        );

      case 'multiple_choice': {
        const options = field.options?.filter(o => o.trim()) || [];
        return (
          <RadioGroup value={value || ''} onValueChange={onChange} disabled={disabled}>
            {options.map(opt => (
              <div key={opt} className="flex items-center gap-2">
                <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                <Label htmlFor={`${field.id}-${opt}`} className="text-sm font-normal cursor-pointer">{opt}</Label>
              </div>
            ))}
            {field.allow_other && (
              <div className="flex items-center gap-2">
                <RadioGroupItem value="__other__" id={`${field.id}-other`} />
                <Label htmlFor={`${field.id}-other`} className="text-sm font-normal cursor-pointer">Outro</Label>
                {value === '__other__' && (
                  <Input className="h-7 w-48" placeholder="Especifique..." onChange={e => onChange(`__other__:${e.target.value}`)} />
                )}
              </div>
            )}
          </RadioGroup>
        );
      }

      case 'checkboxes': {
        const selected: string[] = Array.isArray(value) ? value : [];
        const options = field.options?.filter(o => o.trim()) || [];
        return (
          <div className="space-y-2">
            {options.map(opt => (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox
                  checked={selected.includes(opt)}
                  onCheckedChange={checked => {
                    if (checked) onChange([...selected, opt]);
                    else onChange(selected.filter(s => s !== opt));
                  }}
                  disabled={disabled}
                  id={`${field.id}-${opt}`}
                />
                <Label htmlFor={`${field.id}-${opt}`} className="text-sm font-normal cursor-pointer">{opt}</Label>
              </div>
            ))}
          </div>
        );
      }

      case 'dropdown':
        return (
          <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {(field.options || []).filter(o => o.trim()).map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'file_upload':
        return (
          <div className="space-y-2">
            <Input
              type="file"
              multiple={field.max_files ? field.max_files > 1 : false}
              accept={field.accepted_file_types?.join(',') || undefined}
              onChange={e => onChange(e.target.files?.[0]?.name || '')}
              disabled={disabled}
            />
            {field.max_file_size_mb && (
              <p className="text-xs text-muted-foreground">Máx: {field.max_file_size_mb}MB</p>
            )}
          </div>
        );

      case 'linear_scale': {
        const min = field.scale_min ?? 1;
        const max = field.scale_max ?? 5;
        return (
          <div className="space-y-1">
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(n => (
                <button
                  key={n}
                  type="button"
                  className={`w-9 h-9 rounded-md border flex items-center justify-center text-xs transition-colors ${
                    Number(value) === n ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'
                  }`}
                  onClick={() => onChange(n)}
                  disabled={disabled}
                >
                  {n}
                </button>
              ))}
            </div>
            {(field.scale_low_label || field.scale_high_label) && (
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>{field.scale_low_label || ''}</span>
                <span>{field.scale_high_label || ''}</span>
              </div>
            )}
          </div>
        );
      }

      case 'rating': {
        const max = field.rating_max ?? 5;
        const iconType = field.rating_icon || 'star';
        const IconComponent = iconType === 'heart' ? Heart : iconType === 'thumbs_up' ? ThumbsUp : Star;
        return (
          <div className="flex gap-1">
            {Array.from({ length: max }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                type="button"
                className="transition-colors"
                onClick={() => onChange(n)}
                disabled={disabled}
              >
                <IconComponent
                  className={`h-7 w-7 ${Number(value) >= n ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`}
                />
              </button>
            ))}
          </div>
        );
      }

      case 'multiple_choice_grid': {
        const rows = field.grid_rows || [];
        const cols = field.grid_columns || [];
        const gridVal: Record<string, string> = typeof value === 'object' && value ? value : {};
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2"></th>
                  {cols.map(c => <th key={c} className="text-center p-2 text-xs font-medium text-muted-foreground">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row} className="border-t">
                    <td className="p-2 text-sm">{row}</td>
                    {cols.map(col => (
                      <td key={col} className="text-center p-2">
                        <RadioGroupItem
                          value={col}
                          checked={gridVal[row] === col}
                          onClick={() => onChange({ ...gridVal, [row]: col })}
                          className="mx-auto"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case 'checkbox_grid': {
        const rows = field.grid_rows || [];
        const cols = field.grid_columns || [];
        const gridVal: Record<string, string[]> = typeof value === 'object' && value ? value : {};
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2"></th>
                  {cols.map(c => <th key={c} className="text-center p-2 text-xs font-medium text-muted-foreground">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const rowSel = gridVal[row] || [];
                  return (
                    <tr key={row} className="border-t">
                      <td className="p-2 text-sm">{row}</td>
                      {cols.map(col => (
                        <td key={col} className="text-center p-2">
                          <Checkbox
                            checked={rowSel.includes(col)}
                            onCheckedChange={checked => {
                              const newRow = checked ? [...rowSel, col] : rowSel.filter(s => s !== col);
                              onChange({ ...gridVal, [row]: newRow });
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      case 'time':
        return (
          <Input
            type="time"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      // Legacy types for backward compat
      case 'number':
        return <Input type="number" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} disabled={disabled} />;
      case 'currency':
        return <Input type="number" step="0.01" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || 'R$ 0,00'} disabled={disabled} />;
      case 'boolean':
        return (
          <div className="flex items-center gap-3">
            <Switch checked={value === true || value === 'true'} onCheckedChange={onChange} disabled={disabled} />
            <span className="text-sm">{value === true || value === 'true' ? 'Sim' : 'Não'}</span>
          </div>
        );
      case 'rating_5':
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" disabled={disabled}
                className={`w-10 h-10 rounded-md border flex items-center justify-center text-sm transition-colors ${Number(value) === n ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                onClick={() => onChange(n)}
              >{n}</button>
            ))}
          </div>
        );
      case 'rating_nps':
        return (
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: 11 }, (_, n) => n).map(n => (
              <button key={n} type="button" disabled={disabled}
                className={`w-9 h-9 rounded-md border flex items-center justify-center text-xs transition-colors ${Number(value) === n ? (n <= 6 ? 'bg-destructive text-destructive-foreground' : n <= 8 ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white') : 'hover:bg-muted'}`}
                onClick={() => onChange(n)}
              >{n}</button>
            ))}
          </div>
        );

      default:
        return <Input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} disabled={disabled} />;
    }
  };

  return (
    <div className="space-y-1">
      {renderInput()}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Map legacy types to new canonical names */
function resolveType(type: string): string {
  const map: Record<string, string> = {
    text: 'short_answer',
    textarea: 'paragraph',
    multi_select: 'checkboxes',
    file: 'file_upload',
  };
  return map[type] || type;
}

export const QUESTION_TYPES = [
  { value: 'short_answer', label: 'Texto curto', icon: '📝' },
  { value: 'paragraph', label: 'Parágrafo', icon: '📄' },
  { value: 'multiple_choice', label: 'Múltipla escolha', icon: '⊙' },
  { value: 'checkboxes', label: 'Caixas de seleção', icon: '☑️' },
  { value: 'dropdown', label: 'Menu suspenso', icon: '▼' },
  { value: 'file_upload', label: 'Upload de arquivo', icon: '📎' },
  { value: 'linear_scale', label: 'Escala linear', icon: '📏' },
  { value: 'rating', label: 'Avaliação', icon: '⭐' },
  { value: 'multiple_choice_grid', label: 'Grade (única)', icon: '▦' },
  { value: 'checkbox_grid', label: 'Grade (múltipla)', icon: '▩' },
  { value: 'date', label: 'Data', icon: '📅' },
  { value: 'time', label: 'Hora', icon: '🕐' },
];

/** Legacy types that still work in the renderer */
export const LEGACY_TYPES = ['text', 'textarea', 'multi_select', 'file', 'number', 'currency', 'boolean', 'rating_5', 'rating_nps'];

export function getQuestionTypeLabel(type: string): string {
  const q = QUESTION_TYPES.find(t => t.value === type);
  if (q) return `${q.icon} ${q.label}`;
  // Legacy fallback
  const legacyLabels: Record<string, string> = {
    text: '📝 Texto curto', textarea: '📄 Parágrafo', number: '🔢 Número', currency: '💰 Moeda',
    multi_select: '☑️ Múltipla escolha', boolean: '🔘 Sim/Não', rating_5: '⭐ Rating 1-5',
    rating_nps: '📊 NPS 0-10', file: '📎 Arquivo',
  };
  return legacyLabels[type] || type;
}
