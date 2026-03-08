import { useRef, useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusDropdown } from './StatusDropdown';
import { HealthScoreBars } from './HealthScoreBars';
import { CustomFieldsDisplay } from './CustomFieldsDisplay';
import { ArrowLeft, Pencil, MoreVertical, UserCog, RefreshCw, StickyNote, Eye, Camera, Phone, Trash2 } from 'lucide-react';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { differenceInDays } from 'date-fns';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Office {
  id: string;
  name: string;
  status: string;
  photo_url: string | null;
  logo_url?: string | null;
  products?: { name: string } | null;
  active_product_id?: string | null;
  activation_date?: string | null;
  cycle_start_date?: string | null;
  cycle_end_date?: string | null;
  faturamento_mensal?: number | null;
  city?: string | null;
  state?: string | null;
  cnpj?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  office_code?: string | null;
}

interface ConfigItem {
  key: string;
  visible: boolean;
  order: number;
}

interface ClienteHeaderProps {
  office: Office;
  onEdit?: () => void;
  onDelete?: () => void;
  health?: { score: number; band: string } | null;
  stageName?: string | null;
  csmProfile?: { full_name: string | null; avatar_url: string | null } | null;
  onReassignCSM?: () => void;
  onChangeStatus?: () => void;
  onStatusSelect?: (newStatus: string) => void;
  canEditStatus?: boolean;
  onQuickNote?: () => void;
  onLogoUpdated?: () => void;
  onPreviewOpen?: () => void;
  onWhatsApp?: () => void;
  contracts?: any[];
}

export function ClienteHeader({
  office, onEdit, onDelete, health, stageName, csmProfile,
  onReassignCSM, onChangeStatus, onStatusSelect, canEditStatus, onQuickNote, onLogoUpdated, onPreviewOpen, onWhatsApp, contracts,
}: ClienteHeaderProps) {
  const navigate = useNavigate();
  const { isViewer, isClient, isAdmin, isManager } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const initials = office.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const csmInitials = csmProfile?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const logoSrc = office.logo_url || office.photo_url || undefined;
  const canUploadLogo = !isViewer && !isClient;

  const [headerConfig, setHeaderConfig] = useState<ConfigItem[]>([]);

  useEffect(() => {
    if (!office.active_product_id) return;
    supabase.from('product_360_config' as any)
      .select('items')
      .eq('product_id', office.active_product_id)
      .eq('config_type', 'header')
      .maybeSingle()
      .then(({ data }) => {
        if (data && (data as any).items) {
          setHeaderConfig((data as any).items);
        }
      });
  }, [office.active_product_id]);

  const isFieldVisible = (key: string, defaultVisible = true) => {
    if (headerConfig.length === 0) return defaultVisible;
    const item = headerConfig.find(c => c.key === key);
    return item ? item.visible : defaultVisible;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(f.type)) { toast.error('Formato inválido. Use JPG, PNG ou WebP.'); return; }
    if (f.size > 2 * 1024 * 1024) { toast.error('Imagem muito grande. Máximo 2MB.'); return; }
    const ext = f.name.split('.').pop();
    const path = `${office.id}/logo.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('office-logos').upload(path, f, { upsert: true });
    if (uploadErr) { toast.error('Erro no upload: ' + uploadErr.message); return; }
    const { data: urlData } = supabase.storage.from('office-logos').getPublicUrl(path);
    const logoUrl = urlData.publicUrl + '?t=' + Date.now();
    const { error } = await supabase.from('offices').update({ logo_url: logoUrl }).eq('id', office.id);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else { toast.success('Logo atualizada!'); onLogoUpdated?.(); }
  };

  const activeContract = contracts?.find((c: any) => c.status === 'ativo');
  const ltv = contracts?.reduce((sum: number, c: any) => sum + (c.value || 0), 0) || 0;
  const officeMrr = Number(office.faturamento_mensal) || (activeContract?.monthly_value || 0);
  const overdueInstallments = activeContract?.installments_overdue || 0;
  const renewalDays = office.cycle_end_date ? differenceInDays(new Date(office.cycle_end_date), new Date()) : null;

  // Build visible header badges (Line 2)
  const headerBadges: { key: string; label: string; value: string | null; order: number }[] = [];
  
  const badgeDefs: { key: string; label: string; getValue: () => string | null }[] = [
    { key: 'header_status', label: 'Status', getValue: () => null }, // rendered as StatusBadge
    { key: 'header_health', label: 'Health', getValue: () => null }, // rendered as HealthScoreBars
    { key: 'header_product', label: 'Produto', getValue: () => office.products?.name || null },
    { key: 'header_csm', label: 'CSM', getValue: () => null }, // rendered as UserAvatar
    { key: 'header_stage', label: 'Etapa', getValue: () => stageName || null },
    { key: 'header_activation_date', label: 'Ativação', getValue: () => office.activation_date ? format(new Date(office.activation_date), 'dd/MM/yyyy', { locale: ptBR }) : null },
    { key: 'header_cycle_start', label: 'Início Ciclo', getValue: () => office.cycle_start_date ? format(new Date(office.cycle_start_date), 'dd/MM/yyyy', { locale: ptBR }) : null },
    { key: 'header_cycle_end', label: 'Fim Ciclo', getValue: () => office.cycle_end_date ? format(new Date(office.cycle_end_date), 'dd/MM/yyyy', { locale: ptBR }) : null },
    { key: 'header_renewal_days', label: 'Renovação', getValue: () => renewalDays !== null ? `${renewalDays}d` : null },
    { key: 'header_overdue', label: 'Vencidas', getValue: () => overdueInstallments > 0 ? String(overdueInstallments) : null },
    { key: 'header_ltv', label: 'LTV', getValue: () => ltv > 0 ? `R$ ${ltv.toLocaleString('pt-BR')}` : null },
    { key: 'header_revenue', label: 'MRR', getValue: () => {
      const mrr = Number((office as any).mrr) || 0;
      return mrr > 0 ? `R$ ${mrr.toLocaleString('pt-BR')}` : null;
    }},
    { key: 'header_city_state', label: 'Local', getValue: () => [office.city, office.state].filter(Boolean).join('/') || null },
    { key: 'header_cnpj', label: 'CNPJ', getValue: () => office.cnpj || null },
    { key: 'header_whatsapp', label: 'WhatsApp', getValue: () => office.whatsapp || null },
    { key: 'header_email', label: 'Email', getValue: () => office.email || null },
  ];

  return (
    <div className="space-y-2">
      {/* Line 1: Logo + Name + Actions */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate('/clientes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {isFieldVisible('header_logo') && (
          <div className="relative group" onClick={() => canUploadLogo && fileRef.current?.click()}>
            <Avatar className={`h-12 w-12 ${canUploadLogo ? 'cursor-pointer' : ''}`}>
              <AvatarImage src={logoSrc} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
            </Avatar>
            {canUploadLogo && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-4 w-4 text-white" />
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleLogoUpload} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-mono">
              {(office as any).office_code || office.id.slice(0, 8).toUpperCase()}
            </Badge>
            <h1 className="text-xl font-bold truncate">{office.name}</h1>
          </div>
          {/* Line 2: Configurable badges */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {isFieldVisible('header_status') && onStatusSelect && (
              <StatusDropdown status={office.status} onStatusSelect={onStatusSelect} readonly={!canEditStatus} />
            )}
            {isFieldVisible('header_health') && health && <HealthScoreBars score={health.score} band={health.band} />}
            {isFieldVisible('header_csm', true) && csmProfile?.full_name && (
              <UserAvatar
                name={csmProfile.full_name}
                avatarUrl={csmProfile.avatar_url}
                size="xs"
                showName
                subtitle="CSM"
              />
            )}
            {badgeDefs.filter(b => !['header_status', 'header_health', 'header_csm'].includes(b.key)).map(b => {
              if (!isFieldVisible(b.key, ['header_product'].includes(b.key))) return null;
              const val = b.getValue();
              if (!val) return null;
              return (
                <Badge key={b.key} variant="outline" className="text-xs">
                  <span className="text-muted-foreground mr-1">{b.label}:</span>{val}
                </Badge>
              );
            })}
            {/* Custom fields in header */}
            <CustomFieldsDisplay officeId={office.id} productId={office.active_product_id || null} position="header" />
          </div>
        </div>
        {!isViewer && !isClient && onWhatsApp && (
          <Button variant="outline" size="sm" onClick={onWhatsApp}><Phone className="mr-2 h-4 w-4" />WhatsApp</Button>
        )}
        {!isViewer && !isClient && (
          <Button variant="outline" size="sm" onClick={() => onPreviewOpen?.()}><Eye className="mr-2 h-4 w-4" />Ver como cliente</Button>
        )}
        {!isViewer && onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
        )}
        {!isViewer && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onReassignCSM}>
                <UserCog className="mr-2 h-4 w-4" />Reatribuir CSM
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onQuickNote}>
                <StickyNote className="mr-2 h-4 w-4" />Nota Rápida
              </DropdownMenuItem>
              {(isAdmin || isManager) && onDelete && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                  <Trash2 className="mr-2 h-4 w-4" />Excluir Cliente
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
