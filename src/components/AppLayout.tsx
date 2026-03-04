import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, role } = useAuth();

  const roleLabel: Record<string, string> = {
    admin: 'Admin',
    manager: 'Gestor',
    csm: 'CSM',
    viewer: 'Viewer',
    client: 'Cliente',
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b bg-card px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
            </div>
            <div className="flex items-center gap-3">
              {role && (
                <Badge variant="secondary" className="text-xs font-normal">
                  {roleLabel[role] || role}
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {profile?.full_name || 'Usuário'}
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
