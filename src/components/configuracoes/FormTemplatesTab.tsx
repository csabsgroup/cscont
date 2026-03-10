import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

/**
 * FormTemplatesTab has been replaced by the dedicated Form Builder.
 * This component redirects to /formularios for managing forms.
 */
export function FormTemplatesTab() {
  const navigate = useNavigate();

  return (
    <div className="text-center py-12 space-y-4">
      <p className="text-muted-foreground">
        A gestão de formulários foi movida para uma página dedicada com editor visual completo.
      </p>
      <Button onClick={() => navigate('/formularios')}>
        <ExternalLink className="h-4 w-4 mr-1" />
        Abrir Formulários
      </Button>
    </div>
  );
}
