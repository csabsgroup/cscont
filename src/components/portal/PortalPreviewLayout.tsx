import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePortal } from '@/contexts/PortalContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { AlertTriangle, X, Home, FileText, Target, Video, Calendar, Gift, Users, Contact, FolderOpen } from 'lucide-react';

const allNavItems = [
  { to: '', label: 'Início', icon: Home, settingKey: null },
  { to: 'contrato', label: 'Meu Contrato', icon: FileText, settingKey: 'portal_show_contract' },
  { to: 'plano-de-acao', label: 'Plano de Ação', icon: Target, settingKey: 'portal_show_okr' },
  { to: 'reunioes', label: 'Reuniões', icon: Video, settingKey: 'portal_show_meetings' },
  { to: 'eventos', label: 'Eventos', icon: Calendar, settingKey: 'portal_show_events' },
  { to: 'bonus', label: 'Bônus/Cashback', icon: Gift, settingKey: 'portal_show_bonus' },
  { to: 'arquivos', label: 'Arquivos', icon: FolderOpen, settingKey: 'portal_show_files' },
  { to: 'contatos', label: 'Contatos', icon: Contact, settingKey: 'portal_show_contacts' },
  { to: 'membros', label: 'Membros Ativos', icon: Users, settingKey: 'portal_show_members' },
];

export function PortalPreviewLayout({ children }: { children: React.ReactNode }) {
  const { officeName, officeLogo, officeId, settings } = usePortal();
  const location = useLocation();
  const basePath = `/portal/preview/${officeId}`;

  const navItems = allNavItems.filter(
    (item) => !item.settingKey || settings[item.settingKey]
  );

  const initials = officeName?.slice(0, 2).toUpperCase() || 'C';

  return (
    <div className="min-h-screen bg-background">
      {/* Preview banner */}
      <div className="sticky top-0 z-[60] flex items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>
            Você está visualizando o portal como o cliente <strong>{officeName}</strong> vê. Esta é uma pré-visualização.
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-amber-950 hover:bg-amber-600/20"
          onClick={() => window.close()}
        >
          <X className="mr-1 h-4 w-4" />
          Fechar
        </Button>
      </div>

      {/* Header */}
      <header className="sticky top-[40px] z-50 border-b border-border/60 bg-card shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={officeLogo || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">{officeName || 'Portal do Cliente'}</span>
              <span className="text-[10px] text-muted-foreground">Pré-visualização</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <nav className="sticky top-[104px] hidden h-[calc(100vh-104px)] w-60 border-r border-border/60 bg-card p-3 md:block">
          <div className="space-y-1 mt-2">
            {navItems.map((item) => {
              const fullPath = item.to ? `${basePath}/${item.to}` : basePath;
              const active = item.to
                ? location.pathname.includes(`/${item.to}`)
                : location.pathname === basePath || location.pathname === basePath + '/';
              return (
                <Link key={item.to} to={fullPath}>
                  <div
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all duration-150',
                      active
                        ? 'bg-primary/5 text-primary font-medium border-l-[3px] border-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Content — all interactions disabled */}
        <main className="flex-1 p-4 md:p-6 pointer-events-none opacity-90">
          {children}
        </main>
      </div>
    </div>
  );
}
