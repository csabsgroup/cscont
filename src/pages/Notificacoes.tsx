import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Bell, Info, AlertTriangle, CheckCircle2, XCircle, CheckCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

const typeConfig: Record<string, { icon: typeof Info; className: string; label: string }> = {
  info: { icon: Info, className: 'text-blue-500', label: 'Info' },
  warning: { icon: AlertTriangle, className: 'text-yellow-500', label: 'Alerta' },
  success: { icon: CheckCircle2, className: 'text-emerald-500', label: 'Sucesso' },
  error: { icon: XCircle, className: 'text-red-500', label: 'Erro' },
};

export default function Notificacoes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (filterType !== 'all') q = q.eq('type', filterType);
    if (filterStatus === 'unread') q = q.eq('read', false);
    if (filterStatus === 'read') q = q.eq('read', true);
    const { data } = await q;
    setNotifications((data as Notification[]) || []);
    setLoading(false);
  }, [user, filterType, filterStatus]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notificacoes-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchAll]);

  const toggleRead = async (n: Notification) => {
    await supabase.from('notifications').update({ read: !n.read }).eq('id', n.id);
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: !x.read } : x));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(x => x.id !== id));
    toast({ title: 'Notificação excluída' });
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifications(prev => prev.map(x => ({ ...x, read: true })));
    toast({ title: 'Todas marcadas como lidas' });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
          <p className="text-sm text-muted-foreground">{unreadCount} não lida{unreadCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Alerta</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="unread">Não lidas</SelectItem>
              <SelectItem value="read">Lidas</SelectItem>
            </SelectContent>
          </Select>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="mr-1 h-4 w-4" />
              Marcar todas
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-muted-foreground">
          <Bell className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">Nenhuma notificação encontrada</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Notificação</TableHead>
                <TableHead className="w-24">Tipo</TableHead>
                <TableHead className="w-40">Data</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map(n => {
                const cfg = typeConfig[n.type] || typeConfig.info;
                const Icon = cfg.icon;
                return (
                  <TableRow
                    key={n.id}
                    className={cn("cursor-pointer", !n.read && "bg-primary/5")}
                    onClick={() => { if (n.link) navigate(n.link); }}
                  >
                    <TableCell>
                      <Icon className={cn("h-4 w-4", cfg.className)} />
                    </TableCell>
                    <TableCell>
                      <p className={cn("text-sm", !n.read ? "font-medium text-foreground" : "text-muted-foreground")}>{n.title}</p>
                      {n.message && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{n.message}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleRead(n)} title={n.read ? 'Marcar como não lida' : 'Marcar como lida'}>
                          <CheckCircle2 className={cn("h-3.5 w-3.5", n.read ? "text-muted-foreground" : "text-primary")} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteNotification(n.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
