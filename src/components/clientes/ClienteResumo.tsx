import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Mail, Phone, Instagram, Calendar, FileText, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Office {
  cnpj: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  onboarding_date: string | null;
  activation_date: string | null;
}

interface Contract {
  value: number | null;
  monthly_value: number | null;
  installments_overdue: number | null;
  renewal_date: string | null;
  status: string;
}

interface Contact {
  name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
}

interface ClienteResumoProps {
  office: Office;
  activeContract: Contract | null;
  mainContact: Contact | null;
}

function fmt(date: string | null) {
  if (!date) return '—';
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
}

function currency(val: number | null) {
  if (val == null) return '—';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ClienteResumo({ office, activeContract, mainContact }: ClienteResumoProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Dados do Escritório */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Dados do Escritório
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="CNPJ" value={office.cnpj} />
          <Row label="Cidade/UF" value={[office.city, office.state].filter(Boolean).join('/') || null} />
          {office.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> {office.email}
            </div>
          )}
          {office.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5" /> {office.phone}
            </div>
          )}
          {office.instagram && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Instagram className="h-3.5 w-3.5" /> {office.instagram}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Datas & Contrato */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Contrato & Datas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Onboarding" value={fmt(office.onboarding_date)} />
          <Row label="Ativação" value={fmt(office.activation_date)} />
          {activeContract ? (
            <>
              <Row label="Valor" value={currency(activeContract.value)} />
              <Row label="Mensal" value={currency(activeContract.monthly_value)} />
              <Row label="Parcelas vencidas" value={String(activeContract.installments_overdue ?? 0)} />
              <Row label="Renovação" value={fmt(activeContract.renewal_date)} />
            </>
          ) : (
            <p className="text-muted-foreground">Nenhum contrato ativo</p>
          )}
        </CardContent>
      </Card>

      {/* Contato Principal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            Contato Principal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {mainContact ? (
            <>
              <p className="font-medium">{mainContact.name}</p>
              {mainContact.role_title && <p className="text-muted-foreground">{mainContact.role_title}</p>}
              {mainContact.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> {mainContact.email}
                </div>
              )}
              {mainContact.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> {mainContact.phone}
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Nenhum contato principal definido</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  );
}
