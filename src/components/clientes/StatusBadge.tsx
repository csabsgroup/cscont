import { Badge } from '@/components/ui/badge';

const statusColors: Record<string, string> = {
  ativo: 'bg-success/10 text-success border-success/20',
  churn: 'bg-destructive/10 text-destructive border-destructive/20',
  nao_renovado: 'bg-warning/10 text-warning border-warning/20',
  nao_iniciado: 'bg-muted text-muted-foreground border-border',
  upsell: 'bg-primary/10 text-primary border-primary/20',
  bonus_elite: 'bg-primary/10 text-primary border-primary/20',
};

const statusLabels: Record<string, string> = {
  ativo: 'Ativo',
  churn: 'Churn',
  nao_renovado: 'Não Renovado',
  nao_iniciado: 'Não Iniciado',
  upsell: 'Upsell',
  bonus_elite: 'Bônus Elite',
};

const contractStatusColors: Record<string, string> = {
  ativo: 'bg-success/10 text-success border-success/20',
  encerrado: 'bg-muted text-muted-foreground border-border',
  cancelado: 'bg-destructive/10 text-destructive border-destructive/20',
  pendente: 'bg-warning/10 text-warning border-warning/20',
};

const contractStatusLabels: Record<string, string> = {
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
  pendente: 'Pendente',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={statusColors[status] || ''}>
      {statusLabels[status] || status}
    </Badge>
  );
}

export function ContractStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={contractStatusColors[status] || ''}>
      {contractStatusLabels[status] || status}
    </Badge>
  );
}

export { statusColors, statusLabels };
