import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, GripVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '@/components/clientes/StatusBadge';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  name: string;
  position: number;
  description: string | null;
  sla_days: number | null;
}

interface OfficeInStage {
  id: string;
  office_id: string;
  journey_stage_id: string;
  entered_at: string;
  offices: {
    id: string;
    name: string;
    status: string;
    city: string | null;
    state: string | null;
  };
}

export default function Jornada() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [stages, setStages] = useState<Stage[]>([]);
  const [officeJourneys, setOfficeJourneys] = useState<OfficeInStage[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from('products').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => {
        const prods = data || [];
        setProducts(prods);
        if (prods.length > 0) setSelectedProduct(prods[0].id);
      });
  }, []);

  const fetchStagesAndOffices = useCallback(async () => {
    if (!selectedProduct) return;
    setLoading(true);
    const [stagesRes, journeysRes] = await Promise.all([
      supabase.from('journey_stages').select('*').eq('product_id', selectedProduct).order('position'),
      supabase.from('office_journey').select('*, offices!office_journey_office_id_fkey(id, name, status, city, state)')
        .in('journey_stage_id', 
          (await supabase.from('journey_stages').select('id').eq('product_id', selectedProduct)).data?.map(s => s.id) || []
        ),
    ]);
    setStages((stagesRes.data as Stage[]) || []);
    setOfficeJourneys((journeysRes.data as any[]) || []);
    setLoading(false);
  }, [selectedProduct]);

  useEffect(() => { fetchStagesAndOffices(); }, [fetchStagesAndOffices]);

  const moveOffice = async (journeyId: string, newStageId: string) => {
    const { error } = await supabase.from('office_journey').update({
      journey_stage_id: newStageId,
      entered_at: new Date().toISOString(),
    }).eq('id', journeyId);
    if (error) {
      toast.error('Erro ao mover: ' + error.message);
    } else {
      toast.success('Cliente movido!');
      fetchStagesAndOffices();
    }
  };

  const officesByStage = (stageId: string) =>
    officeJourneys.filter(oj => oj.journey_stage_id === stageId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jornada</h1>
          <p className="text-sm text-muted-foreground">Kanban por produto — acompanhe a jornada dos clientes</p>
        </div>
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Selecione o produto" />
          </SelectTrigger>
          <SelectContent>
            {products.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : stages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma etapa configurada para este produto.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map(stage => {
            const offices = officesByStage(stage.id);
            return (
              <div key={stage.id} className="flex-shrink-0 w-[280px]">
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs">{offices.length}</Badge>
                    </div>
                    {stage.sla_days && (
                      <p className="text-xs text-muted-foreground">SLA: {stage.sla_days} dias</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 min-h-[200px]">
                    {offices.length === 0 ? (
                      <p className="text-xs text-muted-foreground/60 text-center py-8">Nenhum cliente</p>
                    ) : (
                      offices.map(oj => (
                        <Card
                          key={oj.id}
                          className="cursor-pointer hover:shadow-md transition-shadow p-3"
                          onClick={() => navigate(`/clientes/${oj.offices.id}`)}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{oj.offices.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {[oj.offices.city, oj.offices.state].filter(Boolean).join('/') || '—'}
                              </p>
                              <div className="mt-1">
                                <StatusBadge status={oj.offices.status} />
                              </div>
                            </div>
                          </div>
                          {/* Move dropdown */}
                          <div className="mt-2" onClick={e => e.stopPropagation()}>
                            <Select
                              value={oj.journey_stage_id}
                              onValueChange={(val) => moveOffice(oj.id, val)}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {stages.map(s => (
                                  <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </Card>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
