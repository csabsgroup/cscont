import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ExportEntity, fetchExportData, downloadCSV, downloadXLSX } from '@/lib/export-helpers';
import { format } from 'date-fns';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: ExportEntity;
}

export function ExportDialog({ open, onOpenChange, entity }: ExportDialogProps) {
  const { user, isCSM } = useAuth();
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await fetchExportData(entity, filters, isCSM ? user?.id : undefined);
      if (data.length === 0) {
        toast.error('Nenhum dado encontrado com os filtros aplicados.');
        setExporting(false);
        return;
      }
      const filename = `${entity.key}_export_${format(new Date(), 'yyyy-MM-dd')}`;
      if (exportFormat === 'csv') downloadCSV(data, filename);
      else downloadXLSX(data, filename);
      toast.success(`${data.length} registros exportados!`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro na exportação: ' + (err.message || 'erro desconhecido'));
    }
    setExporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar {entity.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Formato</Label>
            <div className="flex gap-3">
              <Button variant={exportFormat === 'csv' ? 'default' : 'outline'} size="sm" onClick={() => setExportFormat('csv')}>CSV</Button>
              <Button variant={exportFormat === 'xlsx' ? 'default' : 'outline'} size="sm" onClick={() => setExportFormat('xlsx')}>Excel (.xlsx)</Button>
            </div>
          </div>

          {entity.filters?.map(filter => (
            <div key={filter.key} className="space-y-2">
              <Label>{filter.label}</Label>
              <Select value={filters[filter.key] || ''} onValueChange={(v) => setFilters(prev => ({ ...prev, [filter.key]: v }))}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {filter.options?.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}

          {isCSM && <p className="text-xs text-muted-foreground">Seus dados serão filtrados pela sua carteira.</p>}

          <Button className="w-full gap-2" onClick={handleExport} disabled={exporting}>
            {exporting ? <><Loader2 className="h-4 w-4 animate-spin" />Exportando...</> : <><Download className="h-4 w-4" />Exportar</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
