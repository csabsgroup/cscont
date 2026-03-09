import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Camera, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  manager: 'Gestor',
  csm: 'CSM',
  viewer: 'Viewer',
  client: 'Cliente',
};

export function UserProfileDialog({ open, onOpenChange }: Props) {
  const { user, profile, role, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Sync form on open
  useEffect(() => {
    if (open && profile) {
      setFullName(profile.full_name || '');
      setWhatsapp(profile.whatsapp || '');
      setPreviewUrl(null);
      setFile(null);
      setRemoveAvatar(false);
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open, profile]);

  const initials = (profile?.full_name || 'U')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(f.type)) {
      toast.error('Formato inválido. Use JPG, PNG ou WebP.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB.');
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setRemoveAvatar(false);
  };

  const handleRemoveAvatar = () => {
    setRemoveAvatar(true);
    setFile(null);
    setPreviewUrl(null);
  };

  const handleSave = async () => {
    if (!user) return;
    if (fullName.trim().length < 2) {
      toast.error('Nome deve ter pelo menos 2 caracteres.');
      return;
    }
    setSaving(true);

    let avatarUrl = profile?.avatar_url || null;

    if (removeAvatar) {
      avatarUrl = null;
    } else if (file) {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadErr) {
        toast.error('Erro no upload: ' + uploadErr.message);
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      avatarUrl = urlData.publicUrl + '?t=' + Date.now();
    }

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), avatar_url: avatarUrl, whatsapp: whatsapp || null } as any)
      .eq('id', user.id);

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Perfil atualizado!');
      await refreshProfile();
      onOpenChange(false);
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error('Erro ao alterar senha: ' + error.message);
    } else {
      toast.success('Senha alterada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
    }
    setChangingPassword(false);
  };

  const displayAvatarUrl = removeAvatar ? undefined : (previewUrl || profile?.avatar_url || undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Meu Perfil</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative cursor-pointer group" onClick={() => fileRef.current?.click()}>
              <Avatar className="h-20 w-20">
                <AvatarImage src={displayAvatarUrl} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => fileRef.current?.click()}>
                <Camera className="h-3 w-3 mr-1" /> Alterar foto
              </Button>
              {(profile?.avatar_url || previewUrl) && !removeAvatar && (
                <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={handleRemoveAvatar}>
                  <Trash2 className="h-3 w-3 mr-1" /> Remover
                </Button>
              )}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label>Nome completo *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          {/* Email (read-only) */}
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input value={user?.email || ''} disabled className="bg-muted/50" />
          </div>

          {/* WhatsApp */}
          <div className="space-y-1.5">
            <Label>WhatsApp</Label>
            <Input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
              placeholder="5511999999999"
              maxLength={15}
            />
            <p className="text-xs text-muted-foreground">Número completo com DDI + DDD (ex: 5511999999999).</p>
          </div>

          {/* Role (read-only) */}
          <div className="space-y-1.5">
            <Label>Perfil</Label>
            <div>
              <Badge variant="secondary">{roleLabels[role || ''] || role || '—'}</Badge>
            </div>
          </div>

          {/* Save profile */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              💾 Salvar perfil
            </Button>
          </div>

          <Separator />

          {/* Change password section */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Alterar Senha</Label>
            <div className="space-y-1.5">
              <Label>Nova senha (mín. 8 caracteres)</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar nova senha</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não coincidem.</p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={handleChangePassword}
              disabled={changingPassword || newPassword.length < 8 || newPassword !== confirmPassword}
            >
              {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Alterar senha
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
