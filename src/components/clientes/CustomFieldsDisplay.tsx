import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Pencil, Check, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  officeId: string;
  productId: string | null;
  position?: 'body' | 'header';
}

interface CustomField {
  id: string;
  name: string;
  slug: string;
  field_type: string;
  description: string | null;
  scope: string;
  product_id: string | null;
  is_required: boolean;
  default_value: string | null;
  options: string[] | null;
  data_source: string;
  position: string;
  is_visible: boolean;
  is_editable: boolean;
  sort_order: number;
}

interface FieldValue {
  id: string;
  custom_field_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_boolean: boolean | null;
  value_json: any;
}

export function CustomFieldsDisplay({ officeId, productId, position = 'body' }: Props) {
  const { user } = useAuth();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [values, setValues] = useState<Map<string, FieldValue>>(new Map());
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [fieldsRes, valuesRes] = await Promise.all([
      supabase.from('custom_fields' as any).select('*').eq('is_visible', true).eq('position', position).order('sort_order'),
      supabase.from('custom_field_values' as any).select('*').eq('office_id', officeId),
    ]);

    const allFields = (fieldsRes.data as unknown as CustomField[]) || [];
    // Filter by scope
    const filtered = allFields.filter(f => {
      if (f.scope === 'global') return true;
      if (f.scope === 'product' && f.product_id === productId) return true;
      return false;
    });
    setFields(filtered);

    const valMap = new Map<string, FieldValue>();
    ((valuesRes.data as unknown as FieldValue[]) || []).forEach(v => valMap.set(v.custom_field_id, v));
    setValues(valMap);
  }, [officeId, productId, position]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getDisplayValue = (field: CustomField): string => {
    const val = values.get(field.id);
    if (!val) return field.default_value || '—';

    switch (field.field_type) {
      case 'text': case 'textarea': case 'dropdown': case 'url': case 'email': case 'phone':
        return val.value_text || '—';
      case 'number':
        return val.value_number !== null ? String(val.value_number) : '—';
      case 'currency':
        return val.value_number !== null ? `R$ ${val.value_number.toLocaleString('pt-BR')}` : '—';
      case 'date':
        return val.value_date ? format(new Date(val.value_date), 'dd/MM/yyyy', { locale: ptBR }) : '—';
      case 'boolean':
        return val.value_boolean !== null ? (val.value_boolean ? 'Sim' : 'Não') : '—';
      case 'multi_select':
        return Array.isArray(val.value_json) ? val.value_json.join(', ') : '—';
      default:
        return val.value_text || '—';
    }
  };

  const getCurrentValue = (field: CustomField) => {
    const val = values.get(field.id);
    if (!val) return field.default_value || '';
    switch (field.field_type) {
      case 'text': case 'textarea': case 'dropdown': case 'url': case 'email': case 'phone':
        return val.value_text || '';
      case 'number': case 'currency':
        return val.value_number !== null ? val.value_number : '';
      case 'date':
        return val.value_date || '';
      case 'boolean':
        return val.value_boolean || false;
      case 'multi_select':
        return Array.isArray(val.value_json) ? val.value_json : [];
      default:
        return val.value_text || '';
    }
  };

  const startEdit = (field: CustomField) => {
    if (!field.is_editable || field.data_source !== 'manual') return;
    setEditingField(field.id);
    setEditValue(getCurrentValue(field));
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue(null);
  };

  const saveEdit = async (field: CustomField) => {
    setSaving(true);
    const payload: any = {
      office_id: officeId,
      custom_field_id: field.id,
      updated_at: new Date().toISOString(),
      updated_by: user?.id,
    };

    switch (field.field_type) {
      case 'text': case 'textarea': case 'dropdown': case 'url': case 'email': case 'phone':
        payload.value_text = editValue || null;
        break;
      case 'number': case 'currency':
        payload.value_number = editValue !== '' ? Number(editValue) : null;
        break;
      case 'date':
        payload.value_date = editValue || null;
        break;
      case 'boolean':
        payload.value_boolean = editValue;
        break;
      case 'multi_select':
        payload.value_json = editValue;
        break;
    }

    const existing = values.get(field.id);
    if (existing) {
      const { error } = await supabase.from('custom_field_values' as any).update(payload).eq('id', existing.id);
      if (error) toast.error('Erro: ' + error.message);
    } else {
      const { error } = await supabase.from('custom_field_values' as any).insert(payload);
      if (error) toast.error('Erro: ' + error.message);
    }

    setSaving(false);
    setEditingField(null);
    setEditValue(null);
    fetchData();
  };

  const renderEditInput = (field: CustomField) => {
    switch (field.field_type) {
      case 'text': case 'url': case 'email': case 'phone':
        return <Input type={field.field_type === 'url' ? 'url' : field.field_type === 'email' ? 'email' : 'text'}
          value={editValue} onChange={e => setEditValue(e.target.value)} className="h-7 text-sm" autoFocus />;
      case 'textarea':
        return <Textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={2} className="text-sm" autoFocus />;
      case 'number': case 'currency':
        return <Input type="number" step="any" value={editValue} onChange={e => setEditValue(e.target.value)} className="h-7 text-sm" autoFocus />;
      case 'date':
        return <Input type="date" value={editValue} onChange={e => setEditValue(e.target.value)} className="h-7 text-sm" autoFocus />;
      case 'boolean':
        return <Switch checked={!!editValue} onCheckedChange={v => setEditValue(v)} />;
      case 'dropdown':
        return (
          <Select value={editValue} onValueChange={v => setEditValue(v)}>
            <SelectTrigger className="h-7 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{(field.options || []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        );
      case 'multi_select':
        return (
          <div className="flex flex-wrap gap-1.5">
            {(field.options || []).map(o => {
              const checked = Array.isArray(editValue) && editValue.includes(o);
              return (
                <label key={o} className="flex items-center gap-1 text-xs cursor-pointer">
                  <Checkbox checked={checked} onCheckedChange={(v) => {
                    const arr = Array.isArray(editValue) ? [...editValue] : [];
                    if (v) arr.push(o); else { const idx = arr.indexOf(o); if (idx >= 0) arr.splice(idx, 1); }
                    setEditValue(arr);
                  }} />
                  {o}
                </label>
              );
            })}
          </div>
        );
      default:
        return <Input value={editValue} onChange={e => setEditValue(e.target.value)} className="h-7 text-sm" autoFocus />;
    }
  };

  if (fields.length === 0) return null;

  return (
    <>
      {fields.map(field => {
        const isEditing = editingField === field.id;
        const canEdit = field.is_editable && field.data_source === 'manual';
        const displayVal = getDisplayValue(field);
        const isLink = field.field_type === 'url' && displayVal !== '—';
        const isEmailLink = field.field_type === 'email' && displayVal !== '—';

        return (
          <Card key={field.id} className="p-3 group">
            <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider flex items-center gap-1">
              {field.name}
              {canEdit && !isEditing && (
                <button onClick={() => startEdit(field)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Pencil className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
            {isEditing ? (
              <div className="mt-1 space-y-1">
                {renderEditInput(field)}
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => saveEdit(field)} disabled={saving}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={cancelEdit}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm font-semibold text-foreground mt-0.5 truncate">
                {isLink ? (
                  <a href={displayVal} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    {displayVal} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : isEmailLink ? (
                  <a href={`mailto:${displayVal}`} className="text-primary hover:underline">{displayVal}</a>
                ) : displayVal}
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}
