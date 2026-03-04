import { cn } from '@/lib/utils';

interface HealthScoreBarsProps {
  score: number | null;
  band: string | null;
}

export function HealthScoreBars({ score, band }: HealthScoreBarsProps) {
  const fillCount = score != null ? Math.round((score / 100) * 10) : 0;
  const barColor = band === 'green' ? 'bg-green-500' : band === 'yellow' ? 'bg-yellow-500' : band === 'red' ? 'bg-red-500' : 'bg-muted';
  const textColor = band === 'green' ? 'text-green-600' : band === 'yellow' ? 'text-yellow-600' : band === 'red' ? 'text-red-600' : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-2">
      <span className={cn('text-2xl font-bold', textColor)}>
        {score != null ? Math.round(score) : '—'}
      </span>
      <div className="flex items-end gap-0.5 h-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-1.5 rounded-sm transition-all',
              i < fillCount ? barColor : 'bg-muted/40'
            )}
            style={{ height: `${40 + i * 6}%` }}
          />
        ))}
      </div>
    </div>
  );
}
