import { supabase } from '@/integrations/supabase/client';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ExportEntity {
  key: string;
  label: string;
  table: string;
  filters?: ExportFilter[];
}

export interface ExportFilter {
  key: string;
  label: string;
  type: 'select' | 'date_range';
  options?: { value: string; label: string }[];
}

export const exportEntities: ExportEntity[] = [
  {
    key: 'offices', label: 'Clientes (Escritórios)', table: 'offices',
    filters: [
      { key: 'status', label: 'Status', type: 'select', options: [
        { value: 'ativo', label: 'Ativo' }, { value: 'churn', label: 'Churn' },
        { value: 'nao_renovado', label: 'Não Renovado' }, { value: 'nao_iniciado', label: 'Não Iniciado' },
      ]},
    ],
  },
  { key: 'contacts', label: 'Contatos', table: 'contacts', filters: [] },
  {
    key: 'contracts', label: 'Contratos', table: 'contracts',
    filters: [
      { key: 'status', label: 'Status', type: 'select', options: [
        { value: 'ativo', label: 'Ativo' }, { value: 'encerrado', label: 'Encerrado' }, { value: 'cancelado', label: 'Cancelado' },
      ]},
    ],
  },
  {
    key: 'meetings', label: 'Reuniões', table: 'meetings',
    filters: [
      { key: 'status', label: 'Status', type: 'select', options: [
        { value: 'scheduled', label: 'Agendada' }, { value: 'completed', label: 'Realizada' }, { value: 'cancelled', label: 'Cancelada' },
      ]},
    ],
  },
  { key: 'activities', label: 'Atividades', table: 'activities', filters: [] },
  { key: 'action_plans', label: 'Plano de Ação (OKR)', table: 'action_plans', filters: [] },
  { key: 'health_scores', label: 'Health Score', table: 'health_scores', filters: [] },
];

export async function fetchExportData(
  entity: ExportEntity,
  filters: Record<string, string>,
  csmId?: string
): Promise<any[]> {
  let query = supabase.from(entity.table as any).select('*');

  // Apply filters
  for (const [key, value] of Object.entries(filters)) {
    if (value && key !== 'date_from' && key !== 'date_to') {
      query = query.eq(key, value);
    }
  }

  // CSM portfolio filter
  if (csmId && ['offices'].includes(entity.key)) {
    query = query.eq('csm_id', csmId);
  }

  const { data, error } = await query.limit(5000);
  if (error) throw error;
  return data || [];
}

export function downloadCSV(data: any[], filename: string) {
  const csv = Papa.unparse(data);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

export function downloadXLSX(data: any[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerDownload(blob, `${filename}.xlsx`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseUploadedFile(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  return new Promise((resolve, reject) => {
    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          resolve({
            headers: result.meta.fields || [],
            rows: result.data as Record<string, any>[],
          });
        },
        error: (err) => reject(err),
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { raw: false, defval: '' });
        const headers = json.length > 0 ? Object.keys(json[0]) : [];
        resolve({ headers, rows: json });
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    }
  });
}
