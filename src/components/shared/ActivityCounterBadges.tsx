import { cn } from '@/lib/utils';

export interface ActivityCounts {
  todas: number;
  atrasadas: number;
  vencemHoje: number;
  aVencer: number;
  concluidas: number;
}

export interface MeetingCounts {
  todas: number;
  agendadas: number;
  realizadas: number;
  canceladas: number;
}

interface BadgeItem {
  key: string;
  label: string;
  count: number;
  className: string;
}

interface ActivityCounterBadgesProps {
  counts: ActivityCounts;
  activeFilter?: string;
  onFilter?: (filter: string) => void;
}

interface MeetingCounterBadgesProps {
  counts: MeetingCounts;
  activeFilter?: string;
  onFilter?: (filter: string) => void;
  variant: 'meetings';
}

type Props = ActivityCounterBadgesProps | MeetingCounterBadgesProps;

export function ActivityCounterBadges(props: Props) {
  const isMeetings = 'variant' in props && props.variant === 'meetings';

  const badges: BadgeItem[] = isMeetings
    ? [
        { key: 'todas', label: 'TODAS', count: (props as MeetingCounterBadgesProps).counts.todas, className: 'bg-gray-800 text-white' },
        { key: 'agendadas', label: 'AGENDADAS', count: (props as MeetingCounterBadgesProps).counts.agendadas, className: 'bg-blue-600 text-white' },
        { key: 'realizadas', label: 'REALIZADAS', count: (props as MeetingCounterBadgesProps).counts.realizadas, className: 'bg-green-600 text-white' },
        { key: 'canceladas', label: 'CANCELADAS', count: (props as MeetingCounterBadgesProps).counts.canceladas, className: 'bg-red-600 text-white' },
      ]
    : [
        { key: 'todas', label: 'TODAS', count: (props as ActivityCounterBadgesProps).counts.todas, className: 'bg-gray-800 text-white' },
        { key: 'atrasadas', label: 'ATRASADAS', count: (props as ActivityCounterBadgesProps).counts.atrasadas, className: 'bg-red-600 text-white' },
        { key: 'vencemHoje', label: 'VENCEM HOJE', count: (props as ActivityCounterBadgesProps).counts.vencemHoje, className: 'bg-orange-500 text-white' },
        { key: 'aVencer', label: 'A VENCER', count: (props as ActivityCounterBadgesProps).counts.aVencer, className: 'bg-green-600 text-white' },
        { key: 'concluidas', label: 'CONCLUÍDAS', count: (props as ActivityCounterBadgesProps).counts.concluidas, className: 'bg-blue-600 text-white' },
      ];

  return (
    <div className="flex gap-3 justify-center flex-wrap">
      {badges.map((badge) => (
        <button
          key={badge.key}
          onClick={() => props.onFilter?.(badge.key)}
          className={cn(
            'rounded-lg px-6 py-3 text-center transition-all hover:opacity-90 min-w-[100px]',
            badge.className,
            props.activeFilter === badge.key && 'ring-2 ring-offset-2 ring-gray-400'
          )}
        >
          <div className="text-3xl font-bold leading-none">{badge.count}</div>
          <div className="text-xs uppercase mt-1 font-medium tracking-wide opacity-90">{badge.label}</div>
        </button>
      ))}
    </div>
  );
}
