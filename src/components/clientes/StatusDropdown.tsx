import { Badge } from '@/components/ui/badge';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { statusColors, statusLabels } from './StatusBadge';

const allStatuses = ['ativo', 'churn', 'nao_renovado', 'nao_iniciado', 'upsell', 'bonus_elite', 'pausado'];

const dotColors: Record<string, string> = {
  ativo: 'bg-success',
  churn: 'bg-destructive',
  nao_renovado: 'bg-warning',
  nao_iniciado: 'bg-muted-foreground',
  upsell: 'bg-primary',
  bonus_elite: 'bg-primary',
  pausado: 'bg-purple-500',
};

interface StatusDropdownProps {
  status: string;
  onStatusSelect: (newStatus: string) => void;
  readonly?: boolean;
}

export function StatusDropdown({ status, onStatusSelect, readonly }: StatusDropdownProps) {
  if (readonly) {
    return (
      <Badge variant="outline" className={statusColors[status] || ''}>
        {statusLabels[status] || status}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1 focus:outline-none">
          <Badge variant="outline" className={`${statusColors[status] || ''} cursor-pointer hover:opacity-80 transition-opacity`}>
            {statusLabels[status] || status}
            <ChevronDown className="ml-1 h-3 w-3" />
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        {allStatuses.filter(s => s !== status).map(s => (
          <DropdownMenuItem key={s} onClick={() => onStatusSelect(s)} className="cursor-pointer">
            <span className={`h-2 w-2 rounded-full mr-2 ${dotColors[s]}`} />
            {statusLabels[s] || s}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
