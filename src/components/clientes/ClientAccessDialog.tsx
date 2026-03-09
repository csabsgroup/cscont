import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { KeyRound, Copy, ShieldCheck, ShieldOff, Trash2, RefreshCw, Loader2 } from 'lucide-react';

interface ClientAccessDialogProps {
  officeId: string;
  officeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LinkedUser {
  userId: string;
  email: string;
  banned: boolean;
  lastSignIn: string | null;
  fullName: string | null;
}

export function ClientAccessDialog({ officeId, officeName, open, onOpenChange }: ClientAccessDialogProps) {
  const [loading, setLoading] = useState(false);
  const [linkedUser, setLinkedUser] = useState<LinkedUser | null>(null);
  const [checking, setChecking] = useState(true);

  // Create mode
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);

  // Manage mode
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [showUnlink, setShowUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    if (!open) return;
    checkExistingAccess();
  }, [open, officeId]);

  const checkExistingAccess = async () => {
    setChecking(true);
    setLinkedUser(null);
    try {
      // Check client_office_links for this office
      const { data: links } = await supabase
        .from('client_office_links')
        .select('user_id')
        .eq('office_id', officeId);

      if (links && links.length > 0) {
        const userId = links[0].user_id;
        // Get user details via admin-manage-user edge function
        const { data: listData, error: listErr } = await supabase.functions.invoke('admin-manage-user', {
          body: { action: 'list' },
        });

        if (!listErr && listData?.users) {
          const user = listData.users.find((u: any) => u.id === userId);
          if (user) {
            // Get profile name
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', userId)
              .maybeSingle();

            setLinkedUser({
              userId,
              email: user.email,
              banned: user.banned,
              lastSignIn: user.last_sign_in,
              fullName: profile?.full_name || null,
            });
          }
        }
      }
    } catch (err) {
      console.error('Error checking access:', err);
    }
    setChecking(false);
  };

  const handleCreate = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error('Preencha email e senha.');
      return;
    }
    if (password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: email.trim(),
        password,
        full_name: officeName,
        role: 'client',
        office_id: officeId,
      },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Erro ao criar acesso.');
    } else {
      toast.success('Acesso criado com sucesso! Repasse as credenciais ao cliente.');
      setEmail('');
      setPassword('');
      checkExistingAccess();
    }
    setCreating(false);
  };

  const handleResetPassword = async () => {
    if (!linkedUser || !newPassword.trim()) return;
    if (newPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    setResetting(true);
    const { data, error } = await supabase.functions.invoke('admin-manage-user', {
      body: { action: 'update_password', user_id: linkedUser.userId, password: newPassword },
    });
    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao resetar senha.');
    } else {
      toast.success('Senha atualizada!');
      setNewPassword('');
    }
    setResetting(false);
  };

  const handleToggleStatus = async () => {
    if (!linkedUser) return;
    setToggling(true);
    const action = linkedUser.banned ? 'reactivate' : 'deactivate';
    const { data, error } = await supabase.functions.invoke('admin-manage-user', {
      body: { action, user_id: linkedUser.userId },
    });
    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao alterar status.');
    } else {
      toast.success(linkedUser.banned ? 'Acesso reativado!' : 'Acesso desativado!');
      checkExistingAccess();
    }
    setToggling(false);
  };

  const handleUnlink = async () => {
    if (!linkedUser) return;
    setUnlinking(true);
    // Delete link
    const { error: linkErr } = await supabase
      .from('client_office_links')
      .delete()
      .eq('office_id', officeId)
      .eq('user_id', linkedUser.userId);
    
    if (linkErr) {
      toast.error('Erro ao desvincular: ' + linkErr.message);
    } else {
      // Also delete the user
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action: 'delete', user_id: linkedUser.userId },
      });
      if (error || data?.error) {
        toast.warning('Vínculo removido, mas não foi possível excluir o usuário.');
      } else {
        toast.success('Acesso desvinculado e usuário excluído!');
      }
      setLinkedUser(null);
      setShowUnlink(false);
    }
    setUnlinking(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Acesso ao Portal — {officeName}
            </DialogTitle>
          </DialogHeader>

          {checking ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : linkedUser ? (
            /* ── Manage Mode ── */
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Email</span>
                  <button onClick={() => copyToClipboard(linkedUser.email)} className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm">{linkedUser.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={linkedUser.banned ? 'destructive' : 'default'} className="text-xs">
                    {linkedUser.banned ? 'Desativado' : 'Ativo'}
                  </Badge>
                  {linkedUser.lastSignIn && (
                    <span className="text-xs text-muted-foreground">
                      Último login: {new Date(linkedUser.lastSignIn).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>

              <Separator />

              {/* Reset Password */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Nova Senha</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <Button size="sm" onClick={handleResetPassword} disabled={resetting || !newPassword.trim()}>
                    {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Toggle & Unlink */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleToggleStatus}
                  disabled={toggling}
                >
                  {toggling ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : linkedUser.banned ? <ShieldCheck className="mr-1 h-4 w-4" /> : <ShieldOff className="mr-1 h-4 w-4" />}
                  {linkedUser.banned ? 'Reativar' : 'Desativar'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowUnlink(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Desvincular
                </Button>
              </div>
            </div>
          ) : (
            /* ── Create Mode ── */
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Crie um acesso ao portal para o cliente. Repasse o email e a senha temporária manualmente.
              </p>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@cliente.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Senha Temporária</Label>
                <Input
                  type="text"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1 h-4 w-4" />}
                  Criar Acesso
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Unlink Confirmation */}
      <AlertDialog open={showUnlink} onOpenChange={setShowUnlink}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular Acesso</AlertDialogTitle>
            <AlertDialogDescription>
              O acesso do cliente será removido e o usuário será excluído permanentemente. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinking}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={handleUnlink} disabled={unlinking}>
              {unlinking ? 'Removendo...' : 'Confirmar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
