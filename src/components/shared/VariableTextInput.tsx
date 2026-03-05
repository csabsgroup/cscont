import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const AVAILABLE_VARIABLES = [
  { key: '{{escritorio}}', label: 'Nome do escritório', group: 'Cliente', icon: '👤' },
  { key: '{{produto}}', label: 'Produto ativo', group: 'Cliente', icon: '👤' },
  { key: '{{status}}', label: 'Status do cliente', group: 'Cliente', icon: '👤' },
  { key: '{{etapa}}', label: 'Etapa da jornada', group: 'Cliente', icon: '👤' },
  { key: '{{cidade}}', label: 'Cidade', group: 'Cliente', icon: '👤' },
  { key: '{{estado}}', label: 'Estado', group: 'Cliente', icon: '👤' },
  { key: '{{cnpj}}', label: 'CNPJ', group: 'Cliente', icon: '👤' },
  { key: '{{whatsapp}}', label: 'WhatsApp', group: 'Cliente', icon: '👤' },
  { key: '{{email_escritorio}}', label: 'Email do escritório', group: 'Cliente', icon: '👤' },
  { key: '{{csm}}', label: 'Nome do CSM', group: 'Responsável', icon: '👥' },
  { key: '{{csm_email}}', label: 'Email do CSM', group: 'Responsável', icon: '👥' },
  { key: '{{gestor}}', label: 'Nome do Gestor', group: 'Responsável', icon: '👥' },
  { key: '{{health_score}}', label: 'Health Score (número)', group: 'Indicadores', icon: '📊' },
  { key: '{{health_faixa}}', label: 'Faixa do Health', group: 'Indicadores', icon: '📊' },
  { key: '{{nps}}', label: 'Último NPS', group: 'Indicadores', icon: '📊' },
  { key: '{{cobertura}}', label: 'Cobertura (reunião no mês)', group: 'Indicadores', icon: '📊' },
  { key: '{{okr_percentual}}', label: '% OKR concluído', group: 'Indicadores', icon: '📊' },
  { key: '{{valor_contrato}}', label: 'Valor total do contrato', group: 'Financeiro', icon: '💰' },
  { key: '{{valor_parcela}}', label: 'Valor da parcela', group: 'Financeiro', icon: '💰' },
  { key: '{{parcelas_vencidas}}', label: 'Parcelas vencidas', group: 'Financeiro', icon: '💰' },
  { key: '{{dias_renovacao}}', label: 'Dias para renovação', group: 'Financeiro', icon: '💰' },
  { key: '{{ltv}}', label: 'LTV total', group: 'Financeiro', icon: '💰' },
  { key: '{{data_hoje}}', label: 'Data de hoje', group: 'Datas', icon: '📅' },
  { key: '{{data_ativacao}}', label: 'Data de ativação', group: 'Datas', icon: '📅' },
  { key: '{{data_inicio_ciclo}}', label: 'Data início do ciclo', group: 'Datas', icon: '📅' },
  { key: '{{data_fim_ciclo}}', label: 'Data fim do ciclo', group: 'Datas', icon: '📅' },
  { key: '{{data_churn}}', label: 'Data do churn', group: 'Datas', icon: '📅' },
  { key: '{{faturamento_mes}}', label: 'Faturamento mensal', group: 'Percepção', icon: '📈' },
  { key: '{{faturamento_ano}}', label: 'Faturamento anual', group: 'Percepção', icon: '📈' },
  { key: '{{qtd_clientes}}', label: 'Qtd de clientes', group: 'Percepção', icon: '📈' },
  { key: '{{qtd_colaboradores}}', label: 'Qtd de colaboradores', group: 'Percepção', icon: '📈' },
  { key: '{{ultima_reuniao}}', label: 'Data última reunião', group: 'Engajamento', icon: '📋' },
  { key: '{{dias_sem_reuniao}}', label: 'Dias sem reunião', group: 'Engajamento', icon: '📋' },
  { key: '{{total_reunioes_ciclo}}', label: 'Total reuniões no ciclo', group: 'Engajamento', icon: '📋' },
  { key: '{{proxima_atividade}}', label: 'Próxima atividade', group: 'Engajamento', icon: '📋' },
  { key: '{{socio_nome}}', label: 'Nome do sócio principal', group: 'Contato', icon: '🤝' },
  { key: '{{socio_email}}', label: 'Email do sócio', group: 'Contato', icon: '🤝' },
  { key: '{{socio_telefone}}', label: 'Telefone do sócio', group: 'Contato', icon: '🤝' },
];

const GROUPS = [...new Set(AVAILABLE_VARIABLES.map(v => v.group))];

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  label?: string;
}

export function VariableTextInput({ value, onChange, placeholder, multiline = false, label }: Props) {
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);

  const insertVariable = (varKey: string) => {
    const el = inputRef.current;
    if (!el) {
      onChange((value || '') + varKey);
      return;
    }
    const start = el.selectionStart ?? (value || '').length;
    const end = el.selectionEnd ?? start;
    const newValue = (value || '').slice(0, start) + varKey + (value || '').slice(end);
    onChange(newValue);

    // Flash feedback
    setFlashKey(varKey);
    setTimeout(() => setFlashKey(null), 400);

    // Restore cursor position after React re-render
    setTimeout(() => {
      el.focus();
      const newPos = start + varKey.length;
      el.setSelectionRange(newPos, newPos);
    }, 0);
  };

  return (
    <div className="space-y-1">
      {label && <Label className="text-xs">{label}</Label>}
      <div className="flex gap-2">
        <div className="flex-1">
          {multiline ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={value || ''}
              onChange={e => onChange(e.target.value)}
              placeholder={placeholder}
              rows={3}
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={value || ''}
              onChange={e => onChange(e.target.value)}
              placeholder={placeholder}
            />
          )}
        </div>
        <TooltipProvider delayDuration={200}>
          <div className="w-52 border border-border rounded-lg bg-background max-h-64 overflow-y-auto flex-shrink-0">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase px-2.5 pt-2 pb-1 sticky top-0 bg-background z-10 border-b border-border">
              📋 Variáveis disponíveis
            </p>
            {GROUPS.map(group => {
              const vars = AVAILABLE_VARIABLES.filter(v => v.group === group);
              const icon = vars[0]?.icon || '';
              return (
                <div key={group}>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase px-2.5 pt-2 pb-0.5 sticky top-7 bg-background z-10">
                    {icon} {group}
                  </p>
                  {vars.map(v => (
                    <Tooltip key={v.key}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => insertVariable(v.key)}
                          className={cn(
                            "w-full text-left text-[11px] font-mono py-1 px-2.5 cursor-pointer rounded hover:bg-muted/50 transition-colors text-destructive",
                            flashKey === v.key && "bg-green-500/20"
                          )}
                        >
                          {v.key}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">
                        {v.label}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
