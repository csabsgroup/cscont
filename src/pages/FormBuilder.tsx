import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Eye, Globe, GripVertical, Loader2, Save, Link2, Trash2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { FormItemCard } from '@/components/formularios/FormItemCard';
import { FormBuilderSidebar } from '@/components/formularios/FormBuilderSidebar';
import { FormBuilderSettings } from '@/components/formularios/FormBuilderSettings';
import { FormBuilderResponses } from '@/components/formularios/FormBuilderResponses';
import type { FormFieldDef } from '@/components/formularios/FormFieldRenderer';

interface SectionDef { id: string; title: string; description?: string; order: number; }

interface PostActions {
  create_activity?: { enabled?: boolean; type?: string; title?: string; days_offset?: number };
  move_stage?: { enabled?: boolean; stage_id?: string };
  notify?: { enabled?: boolean; channel?: string };
}

const HEADER_MAPPING_TARGETS = [
  { value: 'offices.faturamento_mensal', label: 'Faturamento mensal' },
  { value: 'offices.faturamento_anual', label: 'Faturamento anual' },
  { value: 'offices.qtd_clientes', label: 'Qtd de clientes' },
  { value: 'offices.qtd_colaboradores', label: 'Qtd de colaboradores' },
  { value: 'offices.last_nps', label: 'NPS (última nota)' },
  { value: 'offices.last_csat', label: 'CSAT (última nota)' },
  { value: 'offices.cs_feeling', label: 'CS Feeling' },
];

function defaultField(type: string = 'short_answer', order: number = 0): FormFieldDef {
  const field: FormFieldDef = {
    id: crypto.randomUUID(),
    label: '',
    type,
    required: false,
    order,
    header_mapping: { enabled: false, target_field: '' },
    conditional_logic: { enabled: false, logic_operator: 'and', rules: [], action: 'show', target_section_id: null },
  };
  if (type === 'linear_scale') { field.scale_min = 1; field.scale_max = 5; }
  if (type === 'rating') { field.rating_max = 5; field.rating_icon = 'star'; }
  if (['multiple_choice', 'checkboxes', 'dropdown'].includes(type)) { field.options = ['Opção 1']; }
  if (['multiple_choice_grid', 'checkbox_grid'].includes(type)) { field.grid_rows = ['Linha 1']; field.grid_columns = ['Coluna 1']; }
  return field;
}

// Canvas item types for unified drag & drop
type CanvasItem =
  | { type: 'section'; section: SectionDef; draggableId: string }
  | { type: 'field'; field: FormFieldDef; fieldIndex: number; draggableId: string };

export default function FormBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(isNew ? null : id || null);

  // Form state
  const [name, setName] = useState('Novo formulário');
  const [description, setDescription] = useState('');
  const [formType, setFormType] = useState('internal');
  const [productId, setProductId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [formHash, setFormHash] = useState<string | null>(null);
  const [fields, setFields] = useState<FormFieldDef[]>([]);
  const [sections, setSections] = useState<SectionDef[]>([]);
  const [postActions, setPostActions] = useState<PostActions>({});
  const [settings, setSettings] = useState<any>({});
  const [theme, setTheme] = useState<any>({});
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  // Reference data
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState('questions');

  useEffect(() => {
    supabase.from('products').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setProducts((data as any[]) || []));
    supabase.from('custom_fields').select('id, name, slug, field_type').order('sort_order')
      .then(({ data }) => setCustomFields((data as any[]) || []));
  }, []);

  useEffect(() => {
    if (isNew || !id) return;
    supabase.from('form_templates').select('*').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) { toast.error('Formulário não encontrado'); navigate('/formularios'); return; }
        const t = data as any;
        setName(t.name);
        setDescription(t.description || '');
        setFormType(t.form_type || 'internal');
        setProductId(t.product_id || '');
        setIsActive(t.is_active !== false);
        setIsPublished(t.is_published || false);
        setFormHash(t.form_hash || null);
        setSettings(t.settings || {});
        setTheme(t.theme || {});
        setPostActions(t.post_actions && typeof t.post_actions === 'object' ? t.post_actions : {});
        const rawFields = Array.isArray(t.fields) ? t.fields : [];
        setFields(rawFields.map((f: any, i: number) => ({
          ...defaultField(f.type, f.order ?? i),
          ...f,
          header_mapping: f.header_mapping || { enabled: false, target_field: '' },
          conditional_logic: f.conditional_logic || { enabled: false, logic_operator: 'and', rules: [], action: 'show', target_section_id: null },
        })));
        setSections(Array.isArray(t.sections) ? t.sections : []);
        setLoading(false);
      });
  }, [id, isNew]);

  const allMappingTargets = useMemo(() => [
    ...HEADER_MAPPING_TARGETS,
    ...customFields.map(cf => ({ value: `custom_field:${cf.id}`, label: `📋 ${cf.name}` })),
  ], [customFields]);

  // Build unified canvas items: sections interleaved with their fields
  const canvasItems = useMemo((): CanvasItem[] => {
    const items: CanvasItem[] = [];
    const usedFieldIds = new Set<string>();

    // First, add fields without a section (in their natural order)
    // Then for each section (in order), add the section header + its fields
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);

    // Collect fields by section
    const fieldsBySection = new Map<string, FormFieldDef[]>();
    const unsectionedFields: FormFieldDef[] = [];

    for (const f of fields) {
      if (f.section_id && sections.some(s => s.id === f.section_id)) {
        const arr = fieldsBySection.get(f.section_id) || [];
        arr.push(f);
        fieldsBySection.set(f.section_id, arr);
      } else {
        unsectionedFields.push(f);
      }
    }

    // Add unsectioned fields first (intercalated freely at top)
    for (const f of unsectionedFields) {
      items.push({ type: 'field', field: f, fieldIndex: fields.indexOf(f), draggableId: `field-${f.id}` });
      usedFieldIds.add(f.id);
    }

    // Add each section with its fields
    for (const sec of sortedSections) {
      items.push({ type: 'section', section: sec, draggableId: `section-${sec.id}` });
      const secFields = fieldsBySection.get(sec.id) || [];
      for (const f of secFields) {
        items.push({ type: 'field', field: f, fieldIndex: fields.indexOf(f), draggableId: `field-${f.id}` });
        usedFieldIds.add(f.id);
      }
    }

    return items;
  }, [fields, sections]);

  const handleSave = async () => {
    if (!session?.user?.id || !name.trim()) { toast.error('Preencha o nome'); return; }
    setSaving(true);

    // Recompute field order based on canvas order before saving
    const orderedFields = canvasItems
      .filter((item): item is CanvasItem & { type: 'field' } => item.type === 'field')
      .map((item, i) => ({ ...item.field, order: i }));

    const hash = formHash || (formType === 'external' ? crypto.randomUUID().replace(/-/g, '').slice(0, 16) : null);

    const payload: any = {
      name,
      description: description || null,
      form_type: formType,
      type: 'extra',
      product_id: productId || null,
      fields: orderedFields as any,
      sections: sections as any,
      post_actions: postActions as any,
      settings: settings as any,
      theme: theme as any,
      is_active: isActive,
      is_published: isPublished,
      form_hash: hash,
      created_by: session.user.id,
    };

    if (templateId) {
      const { error } = await supabase.from('form_templates').update(payload).eq('id', templateId);
      if (error) { toast.error('Erro: ' + error.message); }
      else { toast.success('Salvo!'); setFormHash(hash); }
    } else {
      const { data, error } = await supabase.from('form_templates').insert(payload).select('id').single();
      if (error) { toast.error('Erro: ' + error.message); }
      else {
        toast.success('Formulário criado!');
        setTemplateId(data.id);
        setFormHash(hash);
        navigate(`/formularios/builder/${data.id}`, { replace: true });
      }
    }
    setSaving(false);
  };

  // Field operations
  const addField = (type: string) => {
    const f = defaultField(type, fields.length);
    setFields(prev => [...prev, f]);
    setSelectedFieldId(f.id);
  };

  const addSection = () => {
    setSections(prev => [...prev, { id: crypto.randomUUID(), title: `Seção ${prev.length + 1}`, order: prev.length }]);
  };

  const addTextBlock = () => {
    addSection();
  };

  const updateField = (fieldId: string, patch: Partial<FormFieldDef>) => {
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, ...patch } : f));
  };

  const removeField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    setSelectedFieldId(null);
  };

  const duplicateField = (fieldId: string) => {
    const original = fields.find(f => f.id === fieldId);
    if (!original) return;
    const f = { ...original, id: crypto.randomUUID(), order: fields.length };
    setFields(prev => [...prev, f]);
    setSelectedFieldId(f.id);
  };

  // Auto-organize: when a field is assigned to a section, move it to the end of that section's group
  const handleFieldSectionChange = (fieldId: string, newSectionId: string | null) => {
    if (!newSectionId) return; // Moving to "no section" keeps position
    setFields(prev => {
      const field = prev.find(f => f.id === fieldId);
      if (!field) return prev;
      // Remove field from current position
      const without = prev.filter(f => f.id !== fieldId);
      // Find last field in the target section
      const lastIdx = without.reduce((acc, f, i) => f.section_id === newSectionId ? i : acc, -1);
      // Insert after the last field in the section, or at the end
      const insertAt = lastIdx >= 0 ? lastIdx + 1 : without.length;
      const result = [...without];
      result.splice(insertAt, 0, { ...field, section_id: newSectionId });
      return result.map((f, i) => ({ ...f, order: i }));
    });
  };

  // Unified drag & drop handler for both sections and fields
  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const srcIdx = result.source.index;
    const dstIdx = result.destination.index;
    if (srcIdx === dstIdx) return;

    const dragId = result.draggableId as string;

    if (dragId.startsWith('section-')) {
      const sectionIndexAt = (canvasIdx: number) =>
        canvasItems.slice(0, canvasIdx).filter(i => i.type === 'section').length;

      const srcSectionIdx = sectionIndexAt(srcIdx);
      const dstSectionIdx = sectionIndexAt(dstIdx);

      const sortedSections = [...sections].sort((a, b) => a.order - b.order);
      const [moved] = sortedSections.splice(srcSectionIdx, 1);
      sortedSections.splice(dstSectionIdx, 0, moved);
      setSections(sortedSections.map((s, i) => ({ ...s, order: i })));
    } else {
      // Dragging a field: reorder in the unified canvas
      const items = [...canvasItems];
      const [moved] = items.splice(srcIdx, 1);
      items.splice(dstIdx, 0, moved);

      // Determine new section_id based on position: a field belongs to the section above it
      const newFields: FormFieldDef[] = [];
      let currentSectionId: string | null = null;

      // Items before sections are unsectioned
      for (const item of items) {
        if (item.type === 'section') {
          currentSectionId = item.section.id;
        } else if (item.type === 'field') {
          // If this is the moved field, update its section_id based on position
          const updatedField = item.draggableId === dragId
            ? { ...item.field, section_id: currentSectionId }
            : item.field;
          newFields.push(updatedField);
        }
      }

      setFields(newFields.map((f, i) => ({ ...f, order: i })));
    }
  };

  const publicUrl = formHash ? `${window.location.origin}/forms/${formHash}` : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-background border-b px-4 py-2">
        <div className="flex items-center gap-3 max-w-6xl mx-auto">
          <Button variant="ghost" size="sm" onClick={() => navigate('/configuracoes')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <Input
            className="flex-1 max-w-md font-semibold border-0 text-lg h-auto py-1 focus-visible:ring-0 focus-visible:border-b focus-visible:border-primary"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome do formulário"
          />
          <div className="flex items-center gap-2 ml-auto">
            {publicUrl && (
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success('Link copiado!'); }}>
                <Link2 className="h-3.5 w-3.5 mr-1" /> Link
              </Button>
            )}
            <Badge variant={isPublished ? 'default' : 'secondary'} className="text-xs">
              {isPublished ? <><Globe className="h-3 w-3 mr-1" /> Publicado</> : 'Rascunho'}
            </Badge>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="questions">Perguntas</TabsTrigger>
            <TabsTrigger value="responses">Respostas</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          {/* Questions tab */}
          <TabsContent value="questions" className="mt-4">
            <div className="flex gap-4">
              {/* Canvas */}
              <div className="flex-1 space-y-3">
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="form-canvas">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                        {canvasItems.map((item, idx) => (
                          <Draggable key={item.draggableId} draggableId={item.draggableId} index={idx}>
                            {(provided) => (
                              <div ref={provided.innerRef} {...provided.draggableProps}>
                                {item.type === 'section' ? (
                                  <div className="flex items-center gap-2 p-3 bg-muted/60 rounded-lg border-2 border-dashed border-primary/30">
                                    <div {...provided.dragHandleProps} className="cursor-grab text-muted-foreground">
                                      <GripVertical className="h-4 w-4" />
                                    </div>
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      Seção {sections.sort((a, b) => a.order - b.order).findIndex(s => s.id === item.section.id) + 1}
                                    </Badge>
                                    <Input
                                      className="h-8 flex-1 text-sm font-semibold border-0 bg-transparent focus-visible:ring-0 focus-visible:border-b focus-visible:border-primary"
                                      value={item.section.title}
                                      onChange={e => setSections(prev => prev.map(s => s.id === item.section.id ? { ...s, title: e.target.value } : s))}
                                      placeholder="Nome da seção"
                                    />
                                    <Input
                                      className="h-8 flex-1 text-xs text-muted-foreground border-0 bg-transparent focus-visible:ring-0"
                                      value={item.section.description || ''}
                                      onChange={e => setSections(prev => prev.map(s => s.id === item.section.id ? { ...s, description: e.target.value } : s))}
                                      placeholder="Descrição da seção (opcional)"
                                    />
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0"
                                      onClick={() => {
                                        // Remove section and unassign fields
                                        setFields(prev => prev.map(f => f.section_id === item.section.id ? { ...f, section_id: null } : f));
                                        setSections(prev => prev.filter(s => s.id !== item.section.id).map((s, i) => ({ ...s, order: i })));
                                      }}>
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                ) : (
                                  <FormItemCard
                                    field={item.field}
                                    index={item.fieldIndex}
                                    dragHandleProps={provided.dragHandleProps}
                                    sections={sections}
                                    allFields={fields}
                                    onUpdate={patch => updateField(item.field.id, patch)}
                                    onDelete={() => removeField(item.field.id)}
                                    onDuplicate={() => duplicateField(item.field.id)}
                                    isSelected={selectedFieldId === item.field.id}
                                    onSelect={() => setSelectedFieldId(item.field.id)}
                                    mappingTargets={allMappingTargets}
                                    onSectionChange={(sectionId) => handleFieldSectionChange(item.field.id, sectionId)}
                                  />
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>

                {canvasItems.length === 0 && (
                  <div className="text-center py-16 text-muted-foreground">
                    <p className="text-sm">Clique nos botões à direita para adicionar perguntas</p>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <FormBuilderSidebar
                onAddQuestion={addField}
                onAddSection={addSection}
                onAddTextBlock={addTextBlock}
              />
            </div>
          </TabsContent>

          {/* Responses tab */}
          <TabsContent value="responses" className="mt-4">
            {templateId ? (
              <FormBuilderResponses templateId={templateId} fields={fields} />
            ) : (
              <p className="text-center text-muted-foreground py-8 text-sm">Salve o formulário primeiro para ver respostas</p>
            )}
          </TabsContent>

          {/* Settings tab */}
          <TabsContent value="settings" className="mt-4">
            <FormBuilderSettings
              settings={settings}
              theme={theme}
              isPublished={isPublished}
              formType={formType}
              description={description}
              productId={productId}
              products={products}
              onSettingsChange={setSettings}
              onThemeChange={setTheme}
              onPublishedChange={setIsPublished}
              onFormTypeChange={setFormType}
              onDescriptionChange={setDescription}
              onProductIdChange={setProductId}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
