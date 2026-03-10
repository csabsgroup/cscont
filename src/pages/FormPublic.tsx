import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import logoDark from '@/assets/logo-dark.png';
import { FormFieldRenderer, type FormFieldDef } from '@/components/formularios/FormFieldRenderer';

interface SectionDef { id: string; title: string; description?: string; order: number; }

interface FormTheme {
  primary_color?: string;
  bg_color?: string;
  header_image_url?: string;
  font_style?: string;
}

interface FormSettings {
  show_progress?: boolean;
  confirmation_message?: string;
  is_accepting_responses?: boolean;
}

function getNextSectionFromRouting(field: FormFieldDef, formData: Record<string, any>): string | null {
  if (!field.conditional_logic?.enabled || field.conditional_logic.routing_type !== 'answer_routing') return null;
  const answer = formData[field.id];
  const answerStr = answer === true ? 'Sim' : answer === false ? 'Não' : String(answer ?? '');
  const route = (field.conditional_logic.routes || []).find((r: any) => r.answer_value === answerStr);
  if (route?.target_section_id) return route.target_section_id;
  return field.conditional_logic.default_target_section_id || null;
}

function isFieldVisible(field: FormFieldDef, formData: Record<string, any>): boolean {
  if (!field.conditional_logic?.enabled || field.conditional_logic.routing_type === 'answer_routing') return true;
  if (!field.conditional_logic.rules?.length) return true;
  const { rules, logic_operator } = field.conditional_logic;
  const results = rules.map((r: any) => {
    const answer = formData[r.field_id];
    const val = r.value;
    switch (r.operator) {
      case 'equals': return String(answer ?? '') === val;
      case 'not_equals': return String(answer ?? '') !== val;
      case 'contains': return String(answer ?? '').toLowerCase().includes(val.toLowerCase());
      case 'is_filled': return answer !== undefined && answer !== null && answer !== '';
      case 'is_empty': return answer === undefined || answer === null || answer === '';
      default: return true;
    }
  });
  return logic_operator === 'and' ? results.every(Boolean) : results.some(Boolean);
}

function validateField(field: FormFieldDef, value: any): string | null {
  if (field.required && (value === undefined || value === null || value === '')) {
    return `Campo obrigatório`;
  }
  if (!value || !field.validation) return null;
  const v = field.validation;
  const str = String(value);
  if (v.min_length && str.length < v.min_length) return v.error_message || `Mínimo ${v.min_length} caracteres`;
  if (v.max_length && str.length > v.max_length) return v.error_message || `Máximo ${v.max_length} caracteres`;
  if (v.pattern) {
    try {
      if (!new RegExp(v.pattern).test(str)) return v.error_message || 'Formato inválido';
    } catch {}
  }
  if (v.min_selections && Array.isArray(value) && value.length < v.min_selections)
    return v.error_message || `Selecione pelo menos ${v.min_selections}`;
  if (v.max_selections && Array.isArray(value) && value.length > v.max_selections)
    return v.error_message || `Selecione no máximo ${v.max_selections}`;
  return null;
}

export default function FormPublic() {
  const { formHash } = useParams<{ formHash: string }>();
  const [searchParams] = useSearchParams();
  const officeParam = searchParams.get('office') || '';

  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [sectionHistory, setSectionHistory] = useState<number[]>([0]);

  useEffect(() => {
    if (!formHash) { setError('Link inválido'); setLoading(false); return; }
    supabase.from('form_templates').select('*')
      .eq('form_hash', formHash)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) setError('Formulário não encontrado ou inativo');
        else {
          const settings = (data as any).settings || {};
          if (settings.is_accepting_responses === false) setError('Este formulário não está aceitando respostas no momento.');
          else setTemplate(data);
        }
        setLoading(false);
      });
  }, [formHash]);

  const fields: FormFieldDef[] = useMemo(() => {
    if (!template) return [];
    return (Array.isArray(template.fields) ? template.fields : []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  }, [template]);

  const sections: SectionDef[] = useMemo(() => {
    if (!template) return [];
    return (Array.isArray(template.sections) ? template.sections : []).sort((a: any, b: any) => a.order - b.order);
  }, [template]);

  const formTheme: FormTheme = template?.theme || {};
  const formSettings: FormSettings = template?.settings || {};
  const hasSections = sections.length > 0;

  const getFieldsForSection = useCallback((sectionId: string | null) => {
    return fields.filter(f => f.section_id === sectionId).filter(f => isFieldVisible(f, formData));
  }, [fields, formData]);

  // Step-by-step: get current section fields
  const currentSection = hasSections ? sections[currentSectionIdx] : null;
  const currentFields = useMemo(() => {
    if (!hasSections) return fields.filter(f => isFieldVisible(f, formData));
    return getFieldsForSection(currentSection?.id || null);
  }, [hasSections, currentSection, getFieldsForSection, fields, formData]);

  // Unsectioned fields (always shown first)
  const unsectionedFields = useMemo(() => fields.filter(f => !f.section_id && isFieldVisible(f, formData)), [fields, formData]);

  const progress = hasSections ? Math.round(((currentSectionIdx + 1) / sections.length) * 100) : 0;

  const setValue = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n; });
  };

  const validateCurrentPage = (): boolean => {
    const fieldsToValidate = hasSections ? [...unsectionedFields, ...currentFields] : currentFields;
    const newErrors: Record<string, string> = {};
    for (const field of fieldsToValidate) {
      const err = validateField(field, formData[field.id]);
      if (err) newErrors[field.id] = err;
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      toast.error('Preencha os campos obrigatórios');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentPage()) return;
    // Check routing
    const sectionFields = fields.filter(f => f.section_id === currentSection?.id);
    let targetSectionId: string | null = null;
    for (const f of sectionFields) {
      const t = getNextSectionFromRouting(f, formData);
      if (t === '__end__') { handleSubmit(); return; }
      if (t) { targetSectionId = t; break; }
    }
    let nextIdx: number;
    if (targetSectionId) {
      nextIdx = sections.findIndex(s => s.id === targetSectionId);
      if (nextIdx < 0) nextIdx = currentSectionIdx + 1;
    } else {
      nextIdx = currentSectionIdx + 1;
    }
    if (nextIdx >= sections.length) { handleSubmit(); return; }
    setSectionHistory(prev => [...prev, nextIdx]);
    setCurrentSectionIdx(nextIdx);
  };

  const handleBack = () => {
    if (sectionHistory.length <= 1) return;
    const newHistory = sectionHistory.slice(0, -1);
    setSectionHistory(newHistory);
    setCurrentSectionIdx(newHistory[newHistory.length - 1]);
  };

  const handleSubmit = async () => {
    if (!template || !officeParam) {
      toast.error('Link incompleto — falta o parâmetro do escritório');
      return;
    }
    if (!validateCurrentPage()) return;

    setSubmitting(true);
    const submissionData: Record<string, any> = {};
    for (const f of fields) {
      if (isFieldVisible(f, formData)) submissionData[f.id] = formData[f.id] ?? null;
    }

    try {
      const { error: fnError } = await supabase.functions.invoke('submit-public-form', {
        body: { form_hash: formHash, office_id: officeParam, data: submissionData },
      });
      if (fnError) toast.error('Erro ao enviar: ' + fnError.message);
      else setSubmitted(true);
    } catch { toast.error('Erro ao enviar formulário'); }
    setSubmitting(false);
  };

  const fontClass = formTheme.font_style === 'serif' ? 'font-serif' : formTheme.font_style === 'mono' ? 'font-mono' : '';

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: formTheme.bg_color }}>
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: formTheme.primary_color }} />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: formTheme.bg_color || '#f3f4f6' }}>
      <Card className="max-w-md w-full mx-4"><CardContent className="py-8 text-center"><p className="text-muted-foreground">{error}</p></CardContent></Card>
    </div>
  );

  if (submitted) {
    const msg = formSettings.confirmation_message || 'Sua resposta foi enviada com sucesso.';
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: formTheme.bg_color || '#f3f4f6' }}>
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 mx-auto" style={{ color: formTheme.primary_color || '#22c55e' }} />
            <h2 className="text-xl font-semibold">Obrigado!</h2>
            <p className="text-muted-foreground">{msg}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLastSection = !hasSections || currentSectionIdx >= sections.length - 1;

  return (
    <div className={`min-h-screen py-8 px-4 ${fontClass}`} style={{ backgroundColor: formTheme.bg_color || '#f3f4f6' }}>
      <div className="max-w-lg mx-auto space-y-4">
        <div className="text-center">
          <img src={logoDark} alt="Logo" className="h-10 mx-auto mb-4" />
        </div>

        {/* Header image */}
        {formTheme.header_image_url && (
          <div className="rounded-t-lg overflow-hidden h-32">
            <img src={formTheme.header_image_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Progress */}
        {hasSections && formSettings.show_progress && (
          <Progress value={progress} className="h-2" />
        )}

        <Card>
          <CardHeader style={{ borderTopColor: formTheme.primary_color, borderTopWidth: formTheme.primary_color ? 4 : 0 }}>
            <CardTitle>{template?.name}</CardTitle>
            {template?.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
            {hasSections && currentSection && (
              <div className="pt-2 border-t">
                <h3 className="text-sm font-semibold">{currentSection.title}</h3>
                {currentSection.description && <p className="text-xs text-muted-foreground">{currentSection.description}</p>}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Unsectioned fields (always shown) */}
            {hasSections && currentSectionIdx === 0 && unsectionedFields.map(field => (
              <div key={field.id} className="space-y-2">
                <Label>{field.label}{field.required && ' *'}</Label>
                {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
                <FormFieldRenderer field={field} value={formData[field.id]} onChange={v => setValue(field.id, v)} error={errors[field.id]} />
              </div>
            ))}

            {/* Current page fields */}
            {currentFields.map(field => (
              <div key={field.id} className="space-y-2">
                <Label>{field.label}{field.required && ' *'}</Label>
                {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
                <FormFieldRenderer field={field} value={formData[field.id]} onChange={v => setValue(field.id, v)} error={errors[field.id]} />
              </div>
            ))}

            {/* Navigation */}
            <div className="flex items-center gap-2 pt-2">
              {hasSections && sectionHistory.length > 1 && (
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
              )}
              <div className="flex-1" />
              {hasSections && !isLastSection ? (
                <Button onClick={handleNext} style={{ backgroundColor: formTheme.primary_color }}>
                  Próximo <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={hasSections ? handleNext : handleSubmit} disabled={submitting}
                  style={{ backgroundColor: formTheme.primary_color }}>
                  {submitting ? 'Enviando...' : 'Enviar'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
