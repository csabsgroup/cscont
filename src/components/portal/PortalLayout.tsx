import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { usePortalSettings } from '@/hooks/usePortalSettings';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  Home, FileText, Target, Video, Calendar, Gift, Users, Contact, LogOut, Menu, X, FolderOpen, Sun, Moon,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

const allNavItems = [
  { to: '/portal', label: 'Início', icon: Home, settingKey: null },
  { to: '/portal/contrato', label: 'Meu Contrato', icon: FileText, settingKey: 'portal_show_contract' },
  { to: '/portal/plano-de-acao', label: 'Plano de Ação', icon: Target, settingKey: 'portal_show_okr' },
  { to: '/portal/reunioes', label: 'Reuniões', icon: Video, settingKey: 'portal_show_meetings' },
  { to: '/portal/eventos', label: 'Eventos', icon: Calendar, settingKey: 'portal_show_events' },
  { to: '/portal/bonus', label: 'Bônus/Cashback', icon: Gift, settingKey: 'portal_show_bonus' },
  { to: '/portal/arquivos', label: 'Arquivos', icon: FolderOpen, settingKey: 'portal_show_files' },
  { to: '/portal/contatos', label: 'Contatos', icon: Contact, settingKey: 'portal_show_contacts' },
  { to: '/portal/membros', label: 'Membros Ativos', icon: Users, settingKey: 'portal_show_members' },
];

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const { signOut, profile, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [officeName, setOfficeName] = useState('');
  const [officeLogo, setOfficeLogo] = useState<string | null>(null);
  const { settings, loading: settingsLoading } = usePortalSettings();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: links } = await supabase.from('client_office_links').select('office_id').eq('user_id', user.id);
      const oid = links?.[0]?.office_id;
      if (!oid) return;
      const { data: office } = await supabase.from('offices').select('name, logo_url, photo_url').eq('id', oid).single();
      if (office?.name) setOfficeName(office.name);
      setOfficeLogo(office?.logo_url || office?.photo_url || null);
    })();
  }, [user]);

  // Filter nav items based on settings
  const navItems = allNavItems.filter(
    (item) => !item.settingKey || settings[item.settingKey]
  );

  // Redirect if current page is disabled
  useEffect(() => {
    if (settingsLoading) return;
    const current = allNavItems.find((item) => item.to === location.pathname);
    if (current?.settingKey && !settings[current.settingKey]) {
      navigate('/portal', { replace: true });
    }
  }, [location.pathname, settings, settingsLoading, navigate]);

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const officeInitials = officeName?.slice(0, 2).toUpperCase() || 'C';

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Avatar className="h-8 w-8">
              <AvatarImage src={officeLogo || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {officeInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">{officeName || 'Portal do Cliente'}</span>
              <span className="hidden text-[10px] text-muted-foreground sm:inline">Portal do Cliente</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-yellow-500" />}
            </button>
            <span className="text-sm text-muted-foreground hidden sm:inline">{profile?.full_name}</span>
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar_url || undefined} />
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
