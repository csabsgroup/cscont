import logo from '@/assets/logo.png';
import {
  LayoutDashboard,
  ClipboardList,
  Building2,
  Kanban,
  CheckSquare,
  Video,
  Calendar,
  FileText,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ScrollText,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useMemo } from 'react';

const allOperationItems = [
  { title: 'Minha Carteira', url: '/', icon: LayoutDashboard },
  { title: 'Jornada', url: '/jornada', icon: Kanban },
  { title: 'Formulários', url: '/formularios', icon: FileText },
  { title: 'Eventos', url: '/eventos', icon: Calendar },
  { title: 'Tarefas Internas', url: '/tarefas-internas', icon: ClipboardList },
];

const managementItems = [
  { title: 'Relatórios', url: '/relatorios', icon: BarChart3 },
  { title: 'Configurações', url: '/configuracoes', icon: Settings },
  { title: 'Auditoria', url: '/auditoria', icon: ScrollText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { profile, role, signOut } = useAuth();

  // Hide "Tarefas Internas" for clients
  const operationItems = useMemo(() => {
    if (role === 'client') {
      return allOperationItems.filter(item => item.url !== '/tarefas-internas' && item.url !== '/eventos');
    }
    return allOperationItems;
  }, [role]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const roleLabel: Record<string, string> = {
    admin: 'Admin',
    manager: 'Gestor',
    csm: 'CSM',
    viewer: 'Viewer',
    client: 'Cliente',
  };

  const renderGroup = (label: string, items: typeof operationItems) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-label-micro text-muted-foreground/60 px-3">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                <NavLink
                  to={item.url}
                  end={item.url === '/'}
                  className="rounded-card px-3 py-2.5 text-muted-foreground transition-all duration-150 hover:bg-surface-elevated hover:text-foreground"
                  activeClassName="!bg-foreground !text-background font-semibold border-l-0"
                >
                  <item.icon className="h-4 w-4" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="py-6 px-5">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Contador CEO" className="h-9 w-auto" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Contador CEO</span>
              <span className="text-[10px] text-muted-foreground">Customer Success</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator className="mx-4 bg-border/50" />

      <SidebarContent className="px-2">
        {renderGroup('Operação', operationItems)}
        <SidebarSeparator className="mx-2 bg-border/40" />
        {renderGroup('Gestão', managementItems)}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              tooltip="Sair"
              className="rounded-card px-3 py-2.5 hover:bg-surface-elevated transition-all duration-150"
            >
              <UserAvatar
                name={profile?.full_name || 'Usuário'}
                avatarUrl={profile?.avatar_url || undefined}
                size="sm"
              />
              {!collapsed && (
                <div className="flex flex-1 items-center justify-between min-w-0">
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-xs font-medium text-foreground">{profile?.full_name || 'Usuário'}</span>
                    {role && (
                      <span className="text-[10px] text-muted-foreground">{roleLabel[role] || role}</span>
                    )}
                  </div>
                  <LogOut className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
