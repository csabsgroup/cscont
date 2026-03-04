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

const FALLBACK_FIELDS: PiperunField[] = [
  { key: 'title', label: 'Título', example_value: 'Escritório ABC' },
  { key: 'value', label: 'Valor', example_value: '5000' },
  { key: 'person.name', label: 'Nome do contato', example_value: 'João Silva' },
  { key: 'person.email', label: 'Email do contato', example_value: 'joao@email.com' },
  { key: 'person.phone', label: 'Telefone do contato', example_value: '11999998888' },
  { key: 'person.city', label: 'Cidade', example_value: 'São Paulo' },
  { key: 'person.state', label: 'Estado', example_value: 'SP' },
  { key: 'id', label: 'ID da oportunidade', example_value: '57368530' },
  { key: 'hash', label: 'Hash', example_value: 'abc123' },
  { key: 'status', label: 'Status', example_value: 'won' },
  { key: 'pipeline.name', label: 'Funil', example_value: 'Vendas' },
  { key: 'stage.name', label: 'Etapa', example_value: 'Fechamento' },
  { key: 'moved_at', label: 'Movido em', example_value: '2026-03-04' },
  { key: 'created_at', label: 'Criado em', example_value: '2026-01-15' },
  { key: 'organization.name', label: 'Organização', example_value: 'Empresa XYZ' },
  { key: 'organization.cnpj', label: 'CNPJ', example_value: '12.345.678/0001-99' },
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
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum campo encontrado</p>
          ) : filtered.map(f => (
            <button
              key={f.key}
              onClick={() => { onSelect(f); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
            >
              <Circle className="h-2.5 w-2.5 text-red-500 fill-red-500 flex-shrink-0" />
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
      </DialogContent>
    </Dialog>
  );
}
