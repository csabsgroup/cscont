import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Home, FileText, Target, Video, Calendar, Gift, Users, Contact, LogOut, Menu, X,
} from 'lucide-react';

const navItems = [
  { to: '/portal', label: 'Início', icon: Home },
  { to: '/portal/contrato', label: 'Meu Contrato', icon: FileText },
  { to: '/portal/plano-de-acao', label: 'Plano de Ação', icon: Target },
  { to: '/portal/reunioes', label: 'Reuniões', icon: Video },
  { to: '/portal/eventos', label: 'Eventos', icon: Calendar },
  { to: '/portal/bonus', label: 'Bônus/Cashback', icon: Gift },
  { to: '/portal/contatos', label: 'Contatos', icon: Contact },
  { to: '/portal/membros', label: 'Membros Ativos', icon: Users },
];

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <span className="text-lg font-bold text-primary">Contador CEO</span>
            <span className="hidden text-sm text-muted-foreground sm:inline">Portal do Cliente</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{profile?.full_name}</span>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <nav className={cn(
          "fixed inset-y-14 left-0 z-40 w-56 border-r bg-background p-3 transition-transform md:sticky md:top-14 md:h-[calc(100vh-3.5rem)] md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="space-y-1">
            {navItems.map(item => {
              const active = location.pathname === item.to;
              return (
                <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)}>
                  <div className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />}
    </div>
  );
}
