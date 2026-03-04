import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  Home, FileText, Target, Video, Calendar, Gift, Users, Contact, LogOut, Menu, X, FolderOpen,
} from 'lucide-react';

const navItems = [
  { to: '/portal', label: 'Início', icon: Home },
  { to: '/portal/contrato', label: 'Meu Contrato', icon: FileText },
  { to: '/portal/plano-de-acao', label: 'Plano de Ação', icon: Target },
  { to: '/portal/reunioes', label: 'Reuniões', icon: Video },
  { to: '/portal/eventos', label: 'Eventos', icon: Calendar },
  { to: '/portal/bonus', label: 'Bônus/Cashback', icon: Gift },
  { to: '/portal/arquivos', label: 'Arquivos', icon: FolderOpen },
  { to: '/portal/contatos', label: 'Contatos', icon: Contact },
  { to: '/portal/membros', label: 'Membros Ativos', icon: Users },
];

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">C</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">Contador CEO</span>
              <span className="hidden text-[10px] text-muted-foreground sm:inline">Portal do Cliente</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{profile?.full_name}</span>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <nav className={cn(
          "fixed inset-y-16 left-0 z-40 w-60 border-r border-border/60 bg-card p-3 transition-transform md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="space-y-1 mt-2">
            {navItems.map(item => {
              const active = location.pathname === item.to;
              return (
                <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)}>
                  <div className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
                    active 
                      ? "bg-primary/5 text-primary font-medium border-l-[3px] border-primary" 
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />}
    </div>
  );
}
