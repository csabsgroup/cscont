import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Search, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Office {
  id: string;
  name: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  status: string;
  email: string | null;
  phone: string | null;
  csm_id: string | null;
  active_product_id: string | null;
  created_at: string;
  products?: { name: string } | null;
}

interface Product {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  ativo: 'bg-success/10 text-success border-success/20',
  churn: 'bg-destructive/10 text-destructive border-destructive/20',
  nao_renovado: 'bg-warning/10 text-warning border-warning/20',
  nao_iniciado: 'bg-muted text-muted-foreground border-border',
  upsell: 'bg-primary/10 text-primary border-primary/20',
  bonus_elite: 'bg-primary/10 text-primary border-primary/20',
};

const statusLabels: Record<string, string> = {
  ativo: 'Ativo',
  churn: 'Churn',
  nao_renovado: 'Não Renovado',
  nao_iniciado: 'Não Iniciado',
  upsell: 'Upsell',
  bonus_elite: 'Bônus Elite',
};

export default function Clientes() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCnpj, setNewCnpj] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newProductId, setNewProductId] = useState('');
  const [creating, setCreating] = useState(false);
  const { isViewer } = useAuth();
  const navigate = useNavigate();

  const fetchOffices = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('offices')
      .select('*, products:active_product_id(name)')
      .order('name');
    if (err) {
      setError(err.message);
    } else {
      setOffices((data as Office[]) || []);
    }
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('id, name').eq('is_active', true);
    setProducts(data || []);
  };

  useEffect(() => {
    fetchOffices();
    fetchProducts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const { error: err } = await supabase.from('offices').insert({
      name: newName,
      cnpj: newCnpj || null,
      city: newCity || null,
      state: newState || null,
      email: newEmail || null,
      phone: newPhone || null,
      active_product_id: newProductId || null,
      status: 'nao_iniciado',
    });
    if (err) {
      toast.error('Erro ao criar escritório: ' + err.message);
    } else {
      toast.success('Escritório criado com sucesso!');
      setDialogOpen(false);
      setNewName('');
      setNewCnpj('');
      setNewCity('');
      setNewState('');
      setNewEmail('');
      setNewPhone('');
      setNewProductId('');
      fetchOffices();
    }
    setCreating(false);
  };

  const filtered = offices.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.city?.toLowerCase().includes(search.toLowerCase()) ||
      o.state?.toLowerCase().includes(search.toLowerCase())
  );

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-destructive">Erro ao carregar clientes: {error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchOffices}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {offices.length} escritório{offices.length !== 1 ? 's' : ''} cadastrado{offices.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!isViewer && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Escritório
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Escritório</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input value={newCnpj} onChange={(e) => setNewCnpj(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Produto</Label>
                    <Select value={newProductId} onValueChange={setNewProductId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={newCity} onChange={(e) => setNewCity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input value={newState} onChange={(e) => setNewState(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? 'Criando...' : 'Criar Escritório'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, cidade ou estado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        {loading ? (
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        ) : filtered.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search ? 'Nenhum escritório encontrado.' : 'Nenhum escritório cadastrado.'}
            </p>
            {!search && !isViewer && (
              <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar primeiro escritório
              </Button>
            )}
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Escritório</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((office) => (
                <TableRow
                  key={office.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/clientes/${office.id}`)}
                >
                  <TableCell className="font-medium">{office.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {office.products?.name || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {[office.city, office.state].filter(Boolean).join('/') || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[office.status] || ''}>
                      {statusLabels[office.status] || office.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {office.email || office.phone || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
