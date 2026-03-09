import { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { Search, User, LogOut, Sun, Moon } from 'lucide-react';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useTheme } from '@/contexts/ThemeContext';
import { NavigationTabs } from '@/components/NavigationTabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserProfileDialog } from '@/components/UserProfileDialog';
import { NotificationPanel } from '@/components/NotificationPanel';

interface AppLayoutProps {
  children: React.ReactNode;
}

const pageNames: Record<string, string> = {
  '/': 'Minha Carteira',
  '/clientes': 'Clientes',
  '/jornada': 'Jornada',
  '/atividades': 'Atividades',
  '/reunioes': 'Reuniões',
  '/eventos': 'Eventos',
  '/contratos': 'Contratos',
  '/contatos': 'Contatos',
  '/financeiro': 'Financeiro',
  '/relatorios': 'Performance',
  '/configuracoes': 'Configurações',
  '/tarefas-internas': 'Tarefas Internas',
  '/formularios': 'Formulários',
};

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, role, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  const currentPage = pageNames[location.pathname] || 
    (location.pathname.startsWith('/clientes/') ? 'Cliente 360' : 'Página');

  const breadcrumb = location.pathname.startsWith('/clientes/') 
    ? ['Clientes', 'Cliente 360']
    : [currentPage];

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border/60 bg-card px-4 shadow-sm">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <nav className="hidden sm:flex items-center gap-1.5">
                {breadcrumb.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-border">/</span>}
                    <span className={i === breadcrumb.length - 1 ? 'text-page-title text-foreground' : 'text-sm text-muted-foreground'}>
                      {crumb}
                    </span>
                  </span>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Buscar..." 
                  className="h-9 w-56 rounded-full bg-muted/50 border-0 pl-9 text-sm focus-visible:ring-1"
                />
              </div>
              <NotificationPanel />
              <button
                onClick={toggleTheme}
                className="rounded-[10px] h-[38px] w-[38px] flex items-center justify-center border border-border text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground"
                title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
              >
                {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-yellow-500" />}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                    <UserAvatar
                      name={profile?.full_name || 'Usuário'}
                      avatarUrl={profile?.avatar_url}
                      size="sm"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                    <User className="mr-2 h-4 w-4" />
                    Meu Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          {!location.pathname.match(/^\/clientes\/[^/]+$/) && <NavigationTabs />}
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </SidebarProvider>
  );
}
