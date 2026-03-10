import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { GripVertical, Trash2, Copy, ChevronDown, Settings2, Plus } from 'lucide-react';
import { FormFieldRenderer, QUESTION_TYPES, getQuestionTypeLabel, type FormFieldDef } from './FormFieldRenderer';

interface SectionDef { id: string; title: string; description?: string; order: number; }

interface Props {
  field: FormFieldDef;
  index: number;
  dragHandleProps?: any;
  sections: SectionDef[];
  allFields: FormFieldDef[];
  onUpdate: (patch: Partial<FormFieldDef>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isSelected: boolean;
  onSelect: () => void;
  mappingTargets: { value: string; label: string }[];
  onSectionChange?: (sectionId: string | null) => void;
}

export function FormItemCard({
  field, index, dragHandleProps, sections, allFields,
  onUpdate, onDelete, onDuplicate, isSelected, onSelect, mappingTargets, onSectionChange,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasOptions = ['multiple_choice', 'checkboxes', 'dropdown', 'multi_select'].includes(field.type);
  const hasGridConfig = ['multiple_choice_grid', 'checkbox_grid'].includes(field.type);
  const hasScaleConfig = field.type === 'linear_scale';
  const hasRatingConfig = field.type === 'rating';
  const supportsRouting = ['multiple_choice', 'checkboxes', 'dropdown', 'multi_select', 'boolean', 'rating_5', 'rating_nps'].includes(field.type);

  const getFieldOptions = (): string[] => {
    if (field.type === 'boolean') return ['Sim', 'Não'];
    if (field.type === 'rating_5') return ['1', '2', '3', '4', '5'];
    if (field.type === 'rating_nps') return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    return field.options?.filter(o => o.trim()) || [];
  };

  return (
    <div
      className={`border rounded-lg bg-card transition-shadow ${isSelected ? 'ring-2 ring-primary shadow-md' : 'hover:shadow-sm'}`}
      onClick={onSelect}
    >
      {/* Header row */}
      <div className="p-3 space-y-3">
        <div className="flex items-start gap-2">
          <div {...dragHandleProps} className="cursor-grab text-muted-foreground mt-2.5">
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-2">
            <Input
              className="font-medium border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
              placeholder="Título da pergunta"
              value={field.label}
              onChange={e => onUpdate({ label: e.target.value })}
            />
            {isSelected && (
              <Input
                className="text-sm border-0 border-b rounded-none px-0 text-muted-foreground focus-visible:ring-0"
                placeholder="Descrição (opcional)"
                value={field.description || ''}
                onChange={e => onUpdate({ description: e.target.value })}
              />
            )}
          </div>
          <Select value={field.type} onValueChange={v => onUpdate({ type: v })}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map(qt => (
                <SelectItem key={qt.value} value={qt.value}>
                  {qt.icon} {qt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Options editor for choice types */}
        {isSelected && hasOptions && (
          <div className="pl-6 space-y-1.5">
            {(field.options && field.options.length > 0 ? field.options : ['']).map((opt, optIdx) => (
              <div key={optIdx} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5">{optIdx + 1}.</span>
                <Input
                  className="h-7 text-sm flex-1"
                  placeholder={`Opção ${optIdx + 1}`}
                  value={opt}
                  onChange={e => {
                    const newOpts = [...(field.options || [''])];
                    newOpts[optIdx] = e.target.value;
                    onUpdate({ options: newOpts });
                  }}
                />
                {(field.options || ['']).length > 1 && (
                  <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0"
                    onClick={() => onUpdate({ options: (field.options || ['']).filter((_, i) => i !== optIdx) })}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-primary"
              onClick={() => onUpdate({ options: [...(field.options || ['']), ''] })}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar opção
            </Button>
          </div>
        )}

        {/* Grid config */}
        {isSelected && hasGridConfig && (
          <div className="pl-6 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Linhas</Label>
              {(field.grid_rows || ['']).map((row, rIdx) => (
                <div key={rIdx} className="flex items-center gap-2">
                  <Input className="h-7 text-xs flex-1" placeholder={`Linha ${rIdx + 1}`} value={row}
                    onChange={e => {
                      const rows = [...(field.grid_rows || [''])];
                      rows[rIdx] = e.target.value;
                      onUpdate({ grid_rows: rows });
                    }}
                  />
                  {(field.grid_rows || ['']).length > 1 && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => onUpdate({ grid_rows: (field.grid_rows || ['']).filter((_, i) => i !== rIdx) })}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="ghost" size="sm" className="h-6 text-xs text-primary"
                onClick={() => onUpdate({ grid_rows: [...(field.grid_rows || ['']), ''] })}>
                <Plus className="h-3 w-3 mr-1" /> Linha
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Colunas</Label>
              {(field.grid_columns || ['']).map((col, cIdx) => (
                <div key={cIdx} className="flex items-center gap-2">
                  <Input className="h-7 text-xs flex-1" placeholder={`Coluna ${cIdx + 1}`} value={col}
                    onChange={e => {
                      const cols = [...(field.grid_columns || [''])];
                      cols[cIdx] = e.target.value;
                      onUpdate({ grid_columns: cols });
                    }}
                  />
                  {(field.grid_columns || ['']).length > 1 && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => onUpdate({ grid_columns: (field.grid_columns || ['']).filter((_, i) => i !== cIdx) })}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="ghost" size="sm" className="h-6 text-xs text-primary"
                onClick={() => onUpdate({ grid_columns: [...(field.grid_columns || ['']), ''] })}>
                <Plus className="h-3 w-3 mr-1" /> Coluna
              </Button>
            </div>
          </div>
        )}

        {/* Scale config */}
        {isSelected && hasScaleConfig && (
          <div className="pl-6 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">De</span>
            <Input type="number" className="h-7 w-16" value={field.scale_min ?? 1}
              onChange={e => onUpdate({ scale_min: parseInt(e.target.value) || 0 })} />
            <span className="text-muted-foreground">até</span>
            <Input type="number" className="h-7 w-16" value={field.scale_max ?? 10}
              onChange={e => onUpdate({ scale_max: parseInt(e.target.value) || 10 })} />
            <Input className="h-7 w-24" placeholder="Label mín" value={field.scale_low_label || ''}
              onChange={e => onUpdate({ scale_low_label: e.target.value })} />
            <Input className="h-7 w-24" placeholder="Label máx" value={field.scale_high_label || ''}
              onChange={e => onUpdate({ scale_high_label: e.target.value })} />
          </div>
        )}

        {/* Rating config */}
        {isSelected && hasRatingConfig && (
          <div className="pl-6 flex items-center gap-3 text-xs">
            <Select value={field.rating_icon || 'star'} onValueChange={v => onUpdate({ rating_icon: v as any })}>
              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="star">⭐ Estrela</SelectItem>
                <SelectItem value="heart">❤️ Coração</SelectItem>
                <SelectItem value="thumbs_up">👍 Polegar</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">até</span>
            <Input type="number" className="h-7 w-16" value={field.rating_max ?? 5} min={3} max={10}
              onChange={e => onUpdate({ rating_max: parseInt(e.target.value) || 5 })} />
          </div>
        )}

        {/* Footer actions */}
        {isSelected && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={field.required} onCheckedChange={v => onUpdate({ required: v })} />
                  <Label className="text-xs">Obrigatório</Label>
                </div>
                {sections.length > 0 && (
                  <Select value={field.section_id || '__none__'} onValueChange={v => {
                    const newSectionId = v === '__none__' ? null : v;
                    onUpdate({ section_id: newSectionId });
                    onSectionChange?.(newSectionId);
                  }}>
                    <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Seção" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem seção</SelectItem>
                      {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={onDuplicate} title="Duplicar">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={onDelete} title="Excluir">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAdvanced(!showAdvanced)} title="Avançado">
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Conditional routing - always visible when type supports it */}
            {supportsRouting && (
              <div className="space-y-2 p-2 rounded-md bg-muted/50 border border-dashed">
                {sections.length === 0 ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    🔀 <span>Crie seções na barra lateral para habilitar lógica condicional (ir para seção por resposta).</span>
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={field.conditional_logic?.enabled && field.conditional_logic?.routing_type === 'answer_routing'}
                        onCheckedChange={v => {
                          if (v) {
                            const options = getFieldOptions();
                            onUpdate({
                              conditional_logic: {
                                enabled: true,
                                logic_operator: 'and',
                                rules: [],
                                action: 'show',
                                target_section_id: null,
                                routing_type: 'answer_routing',
                                routes: options.map(o => ({ answer_value: o, target_section_id: '' })),
                                default_target_section_id: null,
                              },
                            });
                          } else {
                            onUpdate({
                              conditional_logic: {
                                enabled: false,
                                logic_operator: 'and',
                                rules: [],
                                action: 'show',
                                target_section_id: null,
                              },
                            });
                          }
                        }}
                      />
                      <Label className="text-xs font-medium">🔀 Ir para seção por resposta</Label>
                    </div>
                    {field.conditional_logic?.enabled && field.conditional_logic?.routing_type === 'answer_routing' && (
                      <div className="pl-4 border-l-2 border-primary/20 space-y-1.5">
                        {getFieldOptions().map((opt, oIdx) => {
                          const route = (field.conditional_logic?.routes || []).find((r: any) => r.answer_value === opt);
                          return (
                            <div key={oIdx} className="flex items-center gap-2">
                              <span className="text-xs min-w-[80px] truncate font-medium">{opt}</span>
                              <span className="text-xs text-muted-foreground">→</span>
                              <Select
                                value={route?.target_section_id || '__next__'}
                                onValueChange={val => {
                                  const routes = getFieldOptions().map(o => {
                                    const existing = (field.conditional_logic?.routes || []).find((r: any) => r.answer_value === o);
                                    if (o === opt) return { answer_value: o, target_section_id: val === '__next__' ? '' : val };
                                    return existing || { answer_value: o, target_section_id: '' };
                                  });
                                  onUpdate({
                                    conditional_logic: { ...field.conditional_logic, routes },
                                  });
                                }}
                              >
                                <SelectTrigger className="h-6 text-xs flex-1"><SelectValue placeholder="Próxima" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__next__">Próxima seção</SelectItem>
                                  <SelectItem value="__end__">Encerrar formulário</SelectItem>
                                  {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Advanced settings */}
        {isSelected && showAdvanced && (
          <div className="space-y-3 pt-2 border-t">
            {/* Header mapping */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={field.header_mapping?.enabled || false}
                  onCheckedChange={v => onUpdate({ header_mapping: { ...field.header_mapping!, enabled: v, target_field: field.header_mapping?.target_field || '' } })}
                />
                <Label className="text-xs">🎯 Mapear para campo do header</Label>
              </div>
              {field.header_mapping?.enabled && (
                <Select value={field.header_mapping.target_field} onValueChange={v => onUpdate({ header_mapping: { ...field.header_mapping!, target_field: v } })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Campo destino" /></SelectTrigger>
                  <SelectContent>
                    {mappingTargets.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Validation */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Validação</Label>
              <div className="grid grid-cols-2 gap-2">
                {['short_answer', 'text', 'paragraph', 'textarea'].includes(field.type) && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Mín caracteres</Label>
                      <Input type="number" className="h-7 text-xs" value={field.validation?.min_length || ''}
                        onChange={e => onUpdate({ validation: { ...field.validation, min_length: parseInt(e.target.value) || undefined } })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Máx caracteres</Label>
                      <Input type="number" className="h-7 text-xs" value={field.validation?.max_length || ''}
                        onChange={e => onUpdate({ validation: { ...field.validation, max_length: parseInt(e.target.value) || undefined } })} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px]">Regex</Label>
                      <Input className="h-7 text-xs" placeholder="^[0-9]{5}-[0-9]{3}$" value={field.validation?.pattern || ''}
                        onChange={e => onUpdate({ validation: { ...field.validation, pattern: e.target.value } })} />
                    </div>
                  </>
                )}
                {['checkboxes', 'multi_select'].includes(field.type) && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Mín seleções</Label>
                      <Input type="number" className="h-7 text-xs" value={field.validation?.min_selections || ''}
                        onChange={e => onUpdate({ validation: { ...field.validation, min_selections: parseInt(e.target.value) || undefined } })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Máx seleções</Label>
                      <Input type="number" className="h-7 text-xs" value={field.validation?.max_selections || ''}
                        onChange={e => onUpdate({ validation: { ...field.validation, max_selections: parseInt(e.target.value) || undefined } })} />
                    </div>
                  </>
                )}
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px]">Mensagem de erro</Label>
                  <Input className="h-7 text-xs" placeholder="Preencha corretamente" value={field.validation?.error_message || ''}
                    onChange={e => onUpdate({ validation: { ...field.validation, error_message: e.target.value } })} />
                </div>
              </div>
            </div>

            {/* Controls meeting date */}
            {field.type === 'boolean' && (
              <div className="flex items-center gap-2">
                <Switch checked={field.controls_meeting_date || false} onCheckedChange={v => onUpdate({ controls_meeting_date: v })} />
                <Label className="text-xs">🔀 Controla data da reunião</Label>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
