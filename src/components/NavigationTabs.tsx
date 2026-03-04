import { Link, useLocation } from 'react-router-dom';
import { Home, CheckSquare, Building2, FileText, DollarSign, Phone, Kanban, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Minha Carteira', icon: Home, path: '/' },
  { label: 'Atividades', icon: CheckSquare, path: '/atividades' },
  { label: 'Clientes', icon: Building2, path: '/clientes' },
  { label: 'Contratos', icon: FileText, path: '/contratos' },
  { label: 'Financeiro', icon: DollarSign, path: '/financeiro' },
  { label: 'Contatos', icon: Phone, path: '/contatos' },
  { label: 'Jornada', icon: Kanban, path: '/jornada' },
  { label: 'Performance', icon: BarChart3, path: '/relatorios' },
];

export function NavigationTabs() {
  const { pathname } = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <div className="bg-white border-b border-gray-200 overflow-x-auto">
      <nav className="flex min-w-max px-2">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2',
                active
                  ? 'text-red-700 border-red-600 bg-red-50 rounded-t-lg'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
