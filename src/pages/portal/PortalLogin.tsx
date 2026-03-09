import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo.png';

export default function PortalLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Check if user is a client
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single();
    if (roleData?.role === 'client') {
      navigate('/portal', { replace: true });
    } else {
      await supabase.auth.signOut();
      toast({ title: 'Acesso negado', description: 'Esta área é exclusiva para clientes.', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="Contador CEO" className="mx-auto mb-2 h-12 w-auto" />
          <CardTitle className="text-xl">Portal do Cliente</CardTitle>
          <CardDescription>Entre com suas credenciais para acessar o portal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={async () => {
                  if (!email) { toast({ title: 'Informe seu email primeiro', variant: 'destructive' }); return; }
                  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/portal/login' });
                  if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
                  else toast({ title: 'Email enviado', description: 'Verifique sua caixa de entrada para redefinir a senha.' });
                }}
              >
                Esqueci minha senha
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
