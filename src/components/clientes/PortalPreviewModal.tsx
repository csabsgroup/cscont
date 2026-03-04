import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { AlertTriangle, X, Home, FileText, Target, Video, Calendar, Gift, Users, Contact, FolderOpen } from 'lucide-react';
import { PortalProvider, usePortal } from '@/contexts/PortalContext';
import PortalHome from '@/pages/portal/PortalHome';
import PortalContrato from '@/pages/portal/PortalContrato';
import PortalOKR from '@/pages/portal/PortalOKR';
import PortalReunioes from '@/pages/portal/PortalReunioes';
import PortalEventos from '@/pages/portal/PortalEventos';
import PortalBonus from '@/pages/portal/PortalBonus';
import PortalArquivos from '@/pages/portal/PortalArquivos';
import PortalContatos from '@/pages/portal/PortalContatos';
import PortalMembros from '@/pages/portal/PortalMembros';

const allNavItems = [
  { key: 'home', label: 'Início', icon: Home, settingKey: null },
  { key: 'contrato', label: 'Meu Contrato', icon: FileText, settingKey: 'portal_show_contract' },
  { key: 'okr', label: 'Plano de Ação', icon: Target, settingKey: 'portal_show_okr' },
  { key: 'reunioes', label: 'Reuniões', icon: Video, settingKey: 'portal_show_meetings' },
  { key: 'eventos', label: 'Eventos', icon: Calendar, settingKey: 'portal_show_events' },
  { key: 'bonus', label: 'Bônus/Cashback', icon: Gift, settingKey: 'portal_show_bonus' },
  { key: 'arquivos', label: 'Arquivos', icon: FolderOpen, settingKey: 'portal_show_files' },
  { key: 'contatos', label: 'Contatos', icon: Contact, settingKey: 'portal_show_contacts' },
  { key: 'membros', label: 'Membros Ativos', icon: Users, settingKey: 'portal_show_members' },
];

const pageComponents: Record<string, React.ComponentType> = {
  home: PortalHome,
  contrato: PortalContrato,
  okr: PortalOKR,
  reunioes: PortalReunioes,
  eventos: PortalEventos,
  bonus: PortalBonus,
  arquivos: PortalArquivos,
  contatos: PortalContatos,
  membros: PortalMembros,
};

interface PortalPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  officeId: string;
  officeName: string;
}

function ModalContent({ onClose, officeName }: { onClose: () => void; officeName: string }) {
  const { settings, officeLogo } = usePortal();
  const [activePage, setActivePage] = useState('home');

  const navItems = allNavItems.filter(
    (item) => !item.settingKey || settings[item.settingKey as keyof typeof settings]
  );

  const ActiveComponent = pageComponents[activePage] || PortalHome;
  const officeInitials = officeName?.slice(0, 2).toUpperCase() || 'C';

  return (
    <div className="flex flex-col h-full">
      {/* Amber banner */}
      <div className="sticky top-0 z-[60] flex items-center justify-between gap-2 bg-amber-50 border-b border-amber-200 px-4 h-12 shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <span>
            Você está visualizando o portal como o cliente <strong>{officeName}</strong> vê.
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-amber-900 hover:bg-amber-200/50"
          onClick={onClose}
        >
          <X className="mr-1 h-4 w-4" />
          Fechar pré-visualização
        </Button>
      </div>

      {/* Header */}
      <header className="sticky top-12 z-50 border-b border-border/60 bg-card shadow-sm shrink-0">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={officeLogo || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {officeInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground">{officeName || 'Portal do Cliente'}</span>
            <span className="text-[10px] text-muted-foreground">Pré-visualização</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="hidden md:block w-60 border-r border-border/60 bg-card p-3 overflow-y-auto shrink-0">
          <div className="space-y-1 mt-2">
            {navItems.map((item) => {
              const active = activePage === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActivePage(item.key)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 text-left',
                    active
                      ? 'bg-primary/5 text-primary font-medium border-l-[3px] border-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content — read-only */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto pointer-events-none opacity-90">
          <ActiveComponent />
        </main>
      </div>
    </div>
  );
}

export function PortalPreviewModal({ isOpen, onClose, officeId, officeName }: PortalPreviewModalProps) {
  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEsc]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex flex-col h-full bg-background">
        <PortalProvider previewOfficeId={officeId}>
          <ModalContent onClose={onClose} officeName={officeName} />
        </PortalProvider>
      </div>
    </div>,
    document.body
  );
}
