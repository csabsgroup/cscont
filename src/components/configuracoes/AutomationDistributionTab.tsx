import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function AutomationDistributionTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [csmList, setCsmList] = useState<any[]>([]);
  const [method, setMethod] = useState('manual');
  const [fixedCsmId, setFixedCsmId] = useState('');
  const [eligibleCsmIds, setEligibleCsmIds] = useState<string[]>([]);
  const [ruleId, setRuleId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
      supabase.from('user_roles').select('user_id').eq('role', 'csm'),
    ]).then(async ([prodRes, roleRes]) => {
      const prods = prodRes.data || [];
      setProducts(prods);
      if (prods.length > 0) setSelectedProduct(prods[0].id);
      const ids = (roleRes.data || []).map(r => r.user_id);
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
        setCsmList(profiles || []);
      }
      setLoading(false);
    });
  }, []);

  const fetchRule = useCallback(async () => {
    if (!selectedProduct) return;
    const { data } = await supabase.from('automation_rules' as any).select('*')
      .eq('product_id', selectedProduct).eq('rule_type', 'distribution').maybeSingle();
    if (data) {
      const config = (data as any).config || {};
      setMethod(config.method || 'manual');
      setFixedCsmId(config.fixed_csm_id || '');
      setEligibleCsmIds(config.eligible_csm_ids || csmList.map(c => c.id));
      setRuleId((data as any).id);
    } else {
      setMethod('manual');
      setFixedCsmId('');
      setEligibleCsmIds(csmList.map(c => c.id));
      setRuleId(null);
    }
  }, [selectedProduct, csmList]);

  useEffect(() => { fetchRule(); }, [fetchRule]);

  const toggleCsm = (csmId: string) => {
    setEligibleCsmIds(prev => prev.includes(csmId) ? prev.filter(id => id !== csmId) : [...prev, csmId]);
  };

  const handleSave = async () => {
    setSaving(true);
    const config = { method, fixed_csm_id: fixedCsmId || null, eligible_csm_ids: eligibleCsmIds };
    if (ruleId) {
      await supabase.from('automation_rules' as any).update({ config, updated_at: new Date().toISOString() }).eq('id', ruleId);
    } else {
      await supabase.from('automation_rules' as any).insert({ product_id: selectedProduct, rule_type: 'distribution', config });
    }
    toast.success('Regra de distribuição salva!');
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Configure como novos clientes são atribuídos automaticamente a CSMs por produto.</p>
      <Select value={selectedProduct} onValueChange={setSelectedProduct}>
        <SelectTrigger className="w-[220px]"><SelectValue placeholder="Produto" /></SelectTrigger>
        <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
      </Select>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Método de Distribuição</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="least_clients">CSM com menos clientes</SelectItem>
                <SelectItem value="round_robin">Round-robin</SelectItem>
                <SelectItem value="fixed">CSM fixo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {method === 'fixed' && (
            <div className="space-y-2">
              <Label>CSM Fixo</Label>
              <Select value={fixedCsmId} onValueChange={setFixedCsmId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{csmList.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name || c.id}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          {method !== 'manual' && method !== 'fixed' && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">CSMs Elegíveis</Label>
              {csmList.map(csm => (
                <div key={csm.id} className="flex items-center justify-between py-1">
                  <span className="text-sm">{csm.full_name || csm.id}</span>
                  <Switch checked={eligibleCsmIds.includes(csm.id)} onCheckedChange={() => toggleCsm(csm.id)} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Distribuição'}</Button>
    </div>
  );
}
