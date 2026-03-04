import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface Office {
  id: string;
  name: string;
  status: string;
  photo_url: string | null;
  products?: { name: string } | null;
}

interface ClienteHeaderProps {
  office: Office;
  onEdit: () => void;
}

export function ClienteHeader({ office, onEdit }: ClienteHeaderProps) {
  const navigate = useNavigate();
  const { isViewer } = useAuth();
  const initials = office.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="icon" onClick={() => navigate('/clientes')}>
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <Avatar className="h-12 w-12">
        <AvatarImage src={office.photo_url || undefined} />
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold truncate">{office.name}</h1>
          <StatusBadge status={office.status} />
          {office.products?.name && (
            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {office.products.name}
            </span>
          )}
        </div>
      </div>
      {!isViewer && (
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      )}
    </div>
  );
}
