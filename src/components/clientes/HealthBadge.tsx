import { Badge } from '@/components/ui/badge';
import { Heart } from 'lucide-react';

interface HealthBadgeProps {
  score: number | null;
  band: string | null;
  size?: 'sm' | 'md';
}

const bandStyles: Record<string, string> = {
  red: 'bg-destructive/10 text-destructive border-destructive/20',
  yellow: 'bg-warning/10 text-warning border-warning/20',
  green: 'bg-success/10 text-success border-success/20',
};

const bandLabels: Record<string, string> = {
  red: 'Vermelho',
  yellow: 'Amarelo',
  green: 'Verde',
};

export function HealthBadge({ score, band, size = 'sm' }: HealthBadgeProps) {
  if (score == null || !band) {
    return (
      <Badge variant="outline" className="text-muted-foreground border-border gap-1">
        <Heart className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
        —
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={`${bandStyles[band] || ''} gap-1`}>
      <Heart className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {Math.round(score)}
    </Badge>
  );
}
