import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, Download, Building2, Users, FileText, Video, Target, Heart, MessageSquare, Trash2 } from 'lucide-react';
import { importTemplates, EntityTemplate } from '@/lib/import-templates';
import { exportEntities, ExportEntity } from '@/lib/export-helpers';
import { ImportWizard } from '@/components/import-export/ImportWizard';
import { ExportDialog } from '@/components/import-export/ExportDialog';
import { ImportHistorySection } from '@/components/import-export/ImportHistorySection';
import { BulkDeleteDialog, bulkDeleteEntities, BulkDeleteEntity } from '@/components/import-export/BulkDeleteDialog';

const importIcons: Record<string, any> = {
  offices: Building2, contacts: Users, contracts: FileText, meetings: Video, nps_csat: MessageSquare,
};

const exportIcons: Record<string, any> = {
  offices: Building2, contacts: Users, contracts: FileText, meetings: Video,
  activities: Target, action_plans: Target, health_scores: Heart,
};

const deleteIcons: Record<string, any> = {
  offices: Building2, contacts: Users, contracts: FileText, meetings: Video,
};

export function ImportExportTab() {
  const { isAdmin, isManager } = useAuth();
  const canImport = isAdmin || isManager;

  const [importEntity, setImportEntity] = useState<EntityTemplate | null>(null);
  const [exportEntity, setExportEntity] = useState<ExportEntity | null>(null);
  const [deleteEntity, setDeleteEntity] = useState<BulkDeleteEntity | null>(null);

  return (
    <div className="space-y-8">
      {/* Import Section */}
      {canImport && (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2"><Upload className="h-5 w-5 text-primary" />Importar Dados</h3>
            <p className="text-sm text-muted-foreground">Importe dados em massa a partir de arquivos CSV ou Excel.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {importTemplates.map(tmpl => {
              const Icon = importIcons[tmpl.key] || FileText;
              return (
                <Card key={tmpl.key} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setImportEntity(tmpl)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />{tmpl.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{tmpl.fields.filter(f => f.required).length} campos obrigatórios</p>
                    <Button variant="outline" size="sm" className="mt-2 gap-1.5"><Upload className="h-3 w-3" />Importar</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Import History */}
      {canImport && <ImportHistorySection />}

      {/* Export Section */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><Download className="h-5 w-5 text-primary" />Exportar Dados</h3>
          <p className="text-sm text-muted-foreground">Exporte dados em CSV ou Excel com filtros opcionais.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exportEntities.map(entity => {
            const Icon = exportIcons[entity.key] || FileText;
            return (
              <Card key={entity.key} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setExportEntity(entity)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />{entity.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3 w-3" />Exportar</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Bulk Delete Section - Admin only */}
      {isAdmin && (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />Exclusão em Massa
            </h3>
            <p className="text-sm text-muted-foreground">Exclua registros em massa com filtros. Ação irreversível, restrita a administradores.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bulkDeleteEntities.map(entity => {
              const Icon = deleteIcons[entity.key] || FileText;
              return (
                <Card key={entity.key} className="cursor-pointer hover:border-destructive/50 transition-colors border-destructive/20" onClick={() => setDeleteEntity(entity)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Icon className="h-4 w-4 text-destructive" />{entity.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                      <Trash2 className="h-3 w-3" />Excluir
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Modals */}
      {importEntity && (
        <ImportWizard open={!!importEntity} onOpenChange={(o) => !o && setImportEntity(null)} template={importEntity} />
      )}
      {exportEntity && (
        <ExportDialog open={!!exportEntity} onOpenChange={(o) => !o && setExportEntity(null)} entity={exportEntity} />
      )}
      {deleteEntity && (
        <BulkDeleteDialog open={!!deleteEntity} onOpenChange={(o) => !o && setDeleteEntity(null)} entity={deleteEntity} />
      )}
    </div>
  );
}
