import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import logoDark from '@/assets/logo-dark.png';

interface FieldDef {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  description?: string;
  required: boolean;
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  section_id?: string | null;
  order: number;
  header_mapping: { enabled: boolean; target_field: string };
  conditional_logic: {
    enabled: boolean;
    logic_operator: 'and' | 'or';
    rules: { field_id: string; operator: string; value: string }[];
    action: 'show' | 'skip_to_section';
    target_section_id: string | null;
  };
}

interface SectionDef { id: string; title: string; order: number; }

function evaluateCondition(rule: { field_id: string; operator: string; value: string }, formData: Record<string, any>): boolean {
  const answer = formData[rule.field_id];
  const val = rule.value;
  switch (rule.operator) {
    case 'equals': return String(answer ?? '') === val;
    case 'not_equals': return String(answer ?? '') !== val;
    case 'contains': return String(answer ?? '').toLowerCase().includes(val.toLowerCase());
    case 'not_contains': return !String(answer ?? '').toLowerCase().includes(val.toLowerCase());
    case 'greater_than': return Number(answer) > Number(val);
    case 'less_than': return Number(answer) < Number(val);
    case 'is_filled': return answer !== undefined && answer !== null && answer !== '';
    case 'is_empty': return answer === undefined || answer === null || answer === '';
    default: return true;
  }
}

function isFieldVisible(field: FieldDef, formData: Record<string, any>): boolean {
  if (!field.conditional_logic?.enabled || !field.conditional_logic.rules.length) return true;
  const { rules, logic_operator } = field.conditional_logic;
  const results = rules.map(r => evaluateCondition(r, formData));
  return logic_operator === 'and' ? results.every(Boolean) : results.some(Boolean);
}

export default function FormPublic() {
  const { formHash } = useParams<{ formHash: string }>();
  const [searchParams] = useSearchParams();
  const officeParam = searchParams.get('office') || '';

  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!formHash) { setError('Link inválido'); setLoading(false); return; }

    supabase.from('form_templates').select('*')
      .eq('form_hash', formHash)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) { setError('Formulário não encontrado ou inativo'); }
        else { setTemplate(data); }
        setLoading(false);
      });
  }, [formHash]);

  const fields: FieldDef[] = useMemo(() => {
    if (!template) return [];
    return (Array.isArray(template.fields) ? template.fields : []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  }, [template]);

  const sections: SectionDef[] = useMemo(() => {
    if (!template) return [];
    return Array.isArray(template.sections) ? template.sections : [];
  }, [template]);

  const visibleFields = useMemo(() => fields.filter(f => isFieldVisible(f, formData)), [fields, formData]);

  const setValue = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async () => {
    if (!template || !officeParam) {
      toast.error('Link incompleto — falta o parâmetro do escritório');
      return;
    }

    for (const field of visibleFields) {
      if (field.required) {
        const val = formData[field.id];
        if (val === undefined || val === null || val === '') {
          toast.error(`Campo obrigatório: ${field.label}`);
          return;
        }
      }
    }

    setSubmitting(true);

    const submissionData: Record<string, any> = {};
    for (const f of visibleFields) {
      submissionData[f.id] = formData[f.id] ?? null;
    }

    try {
      const { error: fnError } = await supabase.functions.invoke('submit-public-form', {
        body: {
          form_hash: formHash,
          office_id: officeParam,
          data: submissionData,
        },
      });

      if (fnError) {
        toast.error('Erro ao enviar: ' + fnError.message);
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      toast.error('Erro ao enviar formulário');
    }

    setSubmitting(false);
  };

  const renderField = (field: FieldDef) => {
    const key = field.id;
    switch (field.type) {
      case 'text':
        return <Input value={formData[key] || ''} onChange={e => setValue(key, e.target.value)} placeholder={field.placeholder} />;
      case 'textarea':
        return <Textarea value={formData[key] || ''} onChange={e => setValue(key, e.target.value)} placeholder={field.placeholder} rows={3} />;
      case 'number':
        return <Input type="number" value={formData[key] || ''} onChange={e => setValue(key, e.target.value)} placeholder={field.placeholder} />;
      case 'currency':
        return <Input type="number" step="0.01" value={formData[key] || ''} onChange={e => setValue(key, e.target.value)} placeholder={field.placeholder || 'R$ 0,00'} />;
      case 'date':
        return <Input type="date" value={formData[key] || ''} onChange={e => setValue(key, e.target.value)} />;
      case 'dropdown':
        return (
          <Select value={formData[key] || ''} onValueChange={v => setValue(key, v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {(field.options || []).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      case 'multi_select': {
        const selected: string[] = Array.isArray(formData[key]) ? formData[key] : [];
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {selected.map(s => (
                <Badge key={s} variant="secondary" className="cursor-pointer" onClick={() => setValue(key, selected.filter(x => x !== s))}>{s} ✕</Badge>
              ))}
            </div>
            <Select onValueChange={v => { if (!selected.includes(v)) setValue(key, [...selected, v]); }}>
              <SelectTrigger><SelectValue placeholder="Adicionar" /></SelectTrigger>
              <SelectContent>{(field.options || []).filter(o => !selected.includes(o)).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        );
      }
      case 'rating_5':
        return (
          <div className="flex gap-1">
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button"
                className={`w-10 h-10 rounded border flex items-center justify-center text-sm transition-colors ${Number(formData[key]) === n ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                onClick={() => setValue(key, n)}
              >{n}</button>
            ))}
          </div>
        );
      case 'rating_nps':
        return (
          <div className="flex gap-1 flex-wrap">
            {Array.from({length:11},(_,n)=>n).map(n => (
              <button key={n} type="button"
                className={`w-9 h-9 rounded border flex items-center justify-center text-xs transition-colors ${Number(formData[key]) === n ? (n <= 6 ? 'bg-destructive text-destructive-foreground' : n <= 8 ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white') : 'hover:bg-muted'}`}
                onClick={() => setValue(key, n)}
              >{n}</button>
            ))}
          </div>
        );
      case 'boolean':
        return (
          <div className="flex items-center gap-3">
            <Switch checked={formData[key] === true || formData[key] === 'true'} onCheckedChange={val => setValue(key, val)} />
            <span className="text-sm">{formData[key] === true || formData[key] === 'true' ? 'Sim' : 'Não'}</span>
          </div>
        );
      case 'linear_scale': {
        const min = field.scale_min ?? 1;
        const max = field.scale_max ?? 10;
        return (
          <div className="flex gap-1 flex-wrap">
            {Array.from({length: max - min + 1}, (_, i) => min + i).map(n => (
              <button key={n} type="button"
                className={`w-9 h-9 rounded border flex items-center justify-center text-xs transition-colors ${Number(formData[key]) === n ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                onClick={() => setValue(key, n)}
              >{n}</button>
            ))}
          </div>
        );
      }
      default:
        return <Input value={formData[key] || ''} onChange={e => setValue(key, e.target.value)} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Obrigado!</h2>
            <p className="text-muted-foreground">Sua resposta foi enviada com sucesso.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <img src={logoDark} alt="Logo" className="h-10 mx-auto mb-4" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{template?.name}</CardTitle>
            {template?.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
          </CardHeader>
          <CardContent className="space-y-4">
            {visibleFields.map(field => (
              <div key={field.id} className="space-y-2">
                <Label>{field.label}{field.required && ' *'}</Label>
                {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
                {renderField(field)}
              </div>
            ))}
            <Button onClick={handleSubmit} className="w-full" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Enviar'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
