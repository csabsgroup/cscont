import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CATEGORY_LABELS: Record<string, string> = {
  encontro: 'Encontro',
  imersao: 'Imersão',
  workshop: 'Workshop',
  treinamento: 'Treinamento',
  confraternizacao: 'Confraternização',
  outro: 'Outro',
};

const TYPE_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  online: 'Online',
  hibrido: 'Híbrido',
};

interface EventCardProps {
  event: any;
  confirmedCount?: number;
  totalCount?: number;
  onClick: () => void;
  isPast?: boolean;
}

export function EventCard({ event, confirmedCount = 0, totalCount = 0, onClick, isPast }: EventCardProps) {
  const coverUrl = event.cover_url;

  return (
    <Card
      className={`cursor-pointer overflow-hidden transition-all hover:shadow-lg hover:scale-[1.01] group ${isPast ? 'opacity-60' : ''}`}
      onClick={onClick}
    >
      {/* Cover image */}
      <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5">
        {coverUrl ? (
          <img src={coverUrl} alt={event.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Calendar className="h-12 w-12 text-primary/30" />
          </div>
        )}
        {/* Badges overlay */}
        <div className="absolute top-2 right-2 flex gap-1.5">
          <Badge variant="secondary" className="text-xs backdrop-blur-sm bg-background/80">
            {TYPE_LABELS[event.type] || event.type}
          </Badge>
          <Badge variant="outline" className="text-xs backdrop-blur-sm bg-background/80">
            {CATEGORY_LABELS[event.category] || event.category}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4 space-y-2">
        <h3 className="font-semibold text-base line-clamp-1">{event.title}</h3>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          {format(new Date(event.event_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>

        {event.location && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{event.location}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{confirmedCount} confirmado{confirmedCount !== 1 ? 's' : ''} / {totalCount}</span>
          </div>
          {event.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 max-w-[50%] text-right">{event.description?.replace(/<[^>]*>/g, '')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
