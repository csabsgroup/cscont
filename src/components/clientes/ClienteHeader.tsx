import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from './StatusBadge';
import { HealthBadge } from './HealthBadge';
import { ArrowLeft, Pencil, MoreVertical, UserCog, RefreshCw, StickyNote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Office {
  id: string;
  name: string;
  status: string;
  photo_url: string | null;
  products?: { name: string } | null;
}

interface ClienteHeaderProps {
  office: Office;
  onEdit?: () => void;
  health?: { score: number; band: string } | null;
  stageName?: string | null;
  csmProfile?: { full_name: string | null; avatar_url: string | null } | null;
  onReassignCSM?: () => void;
  onChangeStatus?: () => void;
  onQuickNote?: () => void;
}

export function ClienteHeader({
  office, onEdit, health, stageName, csmProfile,
  onReassignCSM, onChangeStatus, onQuickNote,
}: ClienteHeaderProps) {
  const navigate = useNavigate();
  const { isViewer } = useAuth();
  const initials = office.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const csmInitials = csmProfile?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <Button variant="ghost" size="icon" onClick={() => navigate('/clientes')}>
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <Avatar className="h-12 w-12">
        <AvatarImage src={office.photo_url || undefined} />
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold truncate">{office.name}</h1>
          <StatusBadge status={office.status} />
          {health && <HealthBadge score={health.score} band={health.band} size="sm" />}
          {office.products?.name && (
            <Badge variant="outline" className="text-xs">{office.products.name}</Badge>
          )}
          {stageName && (
            <Badge variant="secondary" className="text-xs">{stageName}</Badge>
          )}
        </div>
        {csmProfile?.full_name && (
          <div className="flex items-center gap-1.5 mt-1">
            <Avatar className="h-5 w-5">
              <AvatarImage src={csmProfile.avatar_url || undefined} />
              <AvatarFallback className="text-[10px] bg-muted">{csmInitials}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">CSM: {csmProfile.full_name}</span>
          </div>
        )}
      </div>
      {!isViewer && onEdit && (
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      )}
      {!isViewer && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onReassignCSM}>
              <UserCog className="mr-2 h-4 w-4" />Reatribuir CSM
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onChangeStatus}>
              <RefreshCw className="mr-2 h-4 w-4" />Alterar Status
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onQuickNote}>
              <StickyNote className="mr-2 h-4 w-4" />Nota Rápida
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
