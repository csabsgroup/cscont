import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PiperunField {
  key: string;
  label: string;
  example_value?: string;
}

interface FieldCategory {
  label: string;
  prefix: string;
}

const FIELD_CATEGORIES: FieldCategory[] = [
  { label: 'Deal (Negócio)', prefix: '' },
  { label: 'Pessoa (Contato)', prefix: 'person.' },
  { label: 'Organização (Empresa)', prefix: 'organization.' },
];

const FALLBACK_FIELDS: PiperunField[] = [
  // ── Deal ──
  { key: 'id', label: 'ID da oportunidade', example_value: '57368530' },
  { key: 'hash', label: 'Hash', example_value: 'abc123' },
  { key: 'title', label: 'Título', example_value: 'Escritório ABC' },
  { key: 'value', label: 'Valor total', example_value: '5000' },
  { key: 'monthly_value', label: 'Valor mensal', example_value: '500' },
  { key: 'status', label: 'Status', example_value: 'won' },
  { key: 'pipeline.name', label: 'Funil', example_value: 'Vendas' },
  { key: 'pipeline.id', label: 'ID do Funil', example_value: '123' },
  { key: 'stage.name', label: 'Etapa', example_value: 'Fechamento' },
  { key: 'stage.id', label: 'ID da Etapa', example_value: '456' },
  { key: 'moved_at', label: 'Movido em', example_value: '2026-03-04' },
  { key: 'created_at', label: 'Criado em', example_value: '2026-01-15' },
  { key: 'updated_at', label: 'Atualizado em', example_value: '2026-03-04' },
  { key: 'won_at', label: 'Ganho em', example_value: '2026-02-20' },
  { key: 'lost_at', label: 'Perdido em', example_value: '' },
  { key: 'close_forecast', label: 'Previsão de fechamento', example_value: '2026-04-01' },
  { key: 'tags', label: 'Tags', example_value: 'premium, contabil' },
  { key: 'observation', label: 'Observações', example_value: 'Cliente indicado' },
  { key: 'origin', label: 'Origem', example_value: 'Indicação' },
  { key: 'owner.name', label: 'Responsável (nome)', example_value: 'Maria CSM' },
  { key: 'owner.email', label: 'Responsável (email)', example_value: 'maria@empresa.com' },
  { key: 'custom_fields', label: 'Campos customizados (JSON)', example_value: '{}' },

  // ── Pessoa (Contato) ──
  { key: 'person.id', label: 'ID do contato', example_value: '99001' },
  { key: 'person.name', label: 'Nome do contato', example_value: 'João Silva' },
  { key: 'person.email', label: 'Email do contato', example_value: 'joao@email.com' },
  { key: 'person.phone', label: 'Telefone do contato', example_value: '11999998888' },
  { key: 'person.mobile', label: 'Celular do contato', example_value: '11988887777' },
  { key: 'person.cpf', label: 'CPF do contato', example_value: '123.456.789-00' },
  { key: 'person.birthday', label: 'Aniversário', example_value: '1990-05-15' },
  { key: 'person.city', label: 'Cidade', example_value: 'São Paulo' },
  { key: 'person.state', label: 'Estado', example_value: 'SP' },
  { key: 'person.cep', label: 'CEP', example_value: '01310-100' },
  { key: 'person.address', label: 'Endereço', example_value: 'Av. Paulista 1000' },
  { key: 'person.neighborhood', label: 'Bairro', example_value: 'Bela Vista' },
  { key: 'person.country', label: 'País', example_value: 'Brasil' },
  { key: 'person.facebook', label: 'Facebook', example_value: '' },
  { key: 'person.linkedin', label: 'LinkedIn', example_value: '' },
  { key: 'person.instagram', label: 'Instagram', example_value: '@joaosilva' },
  { key: 'person.twitter', label: 'Twitter/X', example_value: '' },
  { key: 'person.whatsapp', label: 'WhatsApp', example_value: '5511999998888' },
  { key: 'person.website', label: 'Website', example_value: '' },
  { key: 'person.company_name', label: 'Nome da empresa (pessoa)', example_value: '' },
  { key: 'person.role', label: 'Cargo', example_value: 'Sócio' },
  { key: 'person.created_at', label: 'Pessoa criada em', example_value: '2025-12-01' },
  { key: 'person.updated_at', label: 'Pessoa atualizada em', example_value: '2026-02-15' },
  { key: 'person.observation', label: 'Observações da pessoa', example_value: '' },
  { key: 'person.custom_fields', label: 'Campos custom (pessoa)', example_value: '{}' },

  // ── Organização (Empresa) ──
  { key: 'organization.id', label: 'ID da organização', example_value: '55001' },
  { key: 'organization.name', label: 'Nome da organização', example_value: 'Empresa XYZ' },
  { key: 'organization.cnpj', label: 'CNPJ', example_value: '12.345.678/0001-99' },
  { key: 'organization.email', label: 'Email da organização', example_value: 'contato@xyz.com' },
  { key: 'organization.phone', label: 'Telefone da organização', example_value: '1133334444' },
  { key: 'organization.mobile', label: 'Celular da organização', example_value: '' },
  { key: 'organization.website', label: 'Website', example_value: 'https://xyz.com' },
  { key: 'organization.segment', label: 'Segmento', example_value: 'Contabilidade' },
  { key: 'organization.address', label: 'Endereço', example_value: 'Rua Augusta 500' },
  { key: 'organization.neighborhood', label: 'Bairro', example_value: 'Consolação' },
  { key: 'organization.city', label: 'Cidade', example_value: 'São Paulo' },
  { key: 'organization.state', label: 'Estado', example_value: 'SP' },
  { key: 'organization.cep', label: 'CEP', example_value: '01305-000' },
  { key: 'organization.country', label: 'País', example_value: 'Brasil' },
  { key: 'organization.employee_count', label: 'Qtd funcionários', example_value: '50' },
  { key: 'organization.annual_revenue', label: 'Faturamento anual', example_value: '1200000' },
  { key: 'organization.facebook', label: 'Facebook', example_value: '' },
  { key: 'organization.linkedin', label: 'LinkedIn', example_value: '' },
  { key: 'organization.instagram', label: 'Instagram', example_value: '@empresaxyz' },
  { key: 'organization.twitter', label: 'Twitter/X', example_value: '' },
  { key: 'organization.observation', label: 'Observações da organização', example_value: '' },
  { key: 'organization.created_at', label: 'Organização criada em', example_value: '2025-10-01' },
  { key: 'organization.updated_at', label: 'Organização atualizada em', example_value: '2026-01-20' },
  { key: 'organization.custom_fields', label: 'Campos custom (organização)', example_value: '{}' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (field: PiperunField) => void;
  isConnected?: boolean;
}

let cachedFields: PiperunField[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function PiperunFieldPicker({ open, onClose, onSelect, isConnected }: Props) {
  const [fields, setFields] = useState<PiperunField[]>(FALLBACK_FIELDS);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setTimeout(() => inputRef.current?.focus(), 100);

    if (isConnected) {
      if (cachedFields && Date.now() - cacheTime < CACHE_TTL) {
        setFields(cachedFields);
        return;
      }
      setLoading(true);
      supabase.functions.invoke('integration-piperun', { body: { action: 'listFields' } })
        .then(({ data }) => {
          if (data?.fields) {
            cachedFields = data.fields;
            cacheTime = Date.now();
            setFields(data.fields);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setFields(FALLBACK_FIELDS);
    }
  }, [open, isConnected]);

  const filtered = fields.filter(f =>
    f.label.toLowerCase().includes(search.toLowerCase()) ||
    f.key.toLowerCase().includes(search.toLowerCase())
  );

  const getCategoryForField = (key: string): FieldCategory => {
    if (key.startsWith('organization.')) return FIELD_CATEGORIES[2];
    if (key.startsWith('person.')) return FIELD_CATEGORIES[1];
    return FIELD_CATEGORIES[0];
  };

  const groupedFields = FIELD_CATEGORIES.map(cat => ({
    ...cat,
    fields: filtered.filter(f => getCategoryForField(f.key).prefix === cat.prefix),
  })).filter(g => g.fields.length > 0);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Inserir Informações</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Buscar informações..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto space-y-0.5">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando campos...</p>
          ) : groupedFields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum campo encontrado</p>
          ) : groupedFields.map(group => (
            <div key={group.prefix}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-3 pb-1">{group.label}</p>
              {group.fields.map(f => (
                <button
                  key={f.key}
                  onClick={() => { onSelect(f); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <Circle className="h-2.5 w-2.5 text-destructive fill-destructive flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{f.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{f.key}</span>
                  </div>
                  {f.example_value && (
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{f.example_value}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
