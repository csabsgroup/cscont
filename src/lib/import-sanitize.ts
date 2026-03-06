import type { ImportField } from './import-templates';

// ── Accent & normalization helpers ──────────────────────────
export function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalize(str: string): string {
  return stripAccents(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ── CPF / CNPJ ─────────────────────────────────────────────
function onlyDigits(val: string): string {
  return val.replace(/\D/g, '');
}

export function formatCPF(val: string): string {
  const d = onlyDigits(val);
  if (d.length !== 11) return d;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

export function formatCNPJ(val: string): string {
  const d = onlyDigits(val);
  if (d.length !== 14) return d;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

// ── Phone ───────────────────────────────────────────────────
export function sanitizePhone(val: string): string {
  let d = onlyDigits(val);
  // Remove leading 0 (e.g. 011...)
  if (d.startsWith('0') && d.length > 10) {
    d = d.substring(1);
  }
  // Already has country code 55
  if (d.length === 13 && d.startsWith('55')) return d;
  // Add country code if 10-11 digits (DDD + number)
  if (d.length === 10 || d.length === 11) return '55' + d;
  return d;
}

// ── CEP ─────────────────────────────────────────────────────
export function formatCEP(val: string): string {
  const d = onlyDigits(val);
  if (d.length !== 8) return d;
  return `${d.slice(0,5)}-${d.slice(5)}`;
}

// ── Monetary ────────────────────────────────────────────────
export function parseMoney(val: string): number | null {
  let s = String(val).trim();
  // Remove R$, spaces
  s = s.replace(/R\$\s*/gi, '').trim();
  // Brazilian format: 1.500,00 → 1500.00
  if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  // Also handle comma as decimal: 1500,50
  else if (/^\d+(,\d{1,2})$/.test(s)) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ── Title Case ──────────────────────────────────────────────
export function titleCase(val: string): string {
  const lower = ['de', 'da', 'do', 'dos', 'das', 'e', 'em', 'a', 'o', 'os', 'as', 'na', 'no', 'nos', 'nas'];
  return val.trim().split(/\s+/).map((w, i) => {
    const wl = w.toLowerCase();
    if (i > 0 && lower.includes(wl)) return wl;
    return wl.charAt(0).toUpperCase() + wl.slice(1);
  }).join(' ');
}

// ── Date parsing (multiple formats) ─────────────────────────
export function parseFlexDate(val: string): string | null {
  if (!val || !val.trim()) return null;
  const s = val.trim();

  // ISO: 2024-01-15 or 2024-01-15T...
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YY (short year)
  const m2 = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/);
  if (m2) {
    const [, d, mo, y2] = m2;
    const y = Number(y2) > 50 ? `19${y2}` : `20${y2}`;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try Date.parse as last resort
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

// ── State ───────────────────────────────────────────────────
const VALID_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
export function sanitizeState(val: string): string {
  const up = val.trim().toUpperCase();
  if (VALID_STATES.includes(up)) return up;
  const nameMap: Record<string, string> = {
    'saopaulo': 'SP', 'riodejaneiro': 'RJ', 'minasgerais': 'MG', 'bahia': 'BA',
    'parana': 'PR', 'riograndedosul': 'RS', 'santacatarina': 'SC', 'goias': 'GO',
    'ceara': 'CE', 'pernambuco': 'PE', 'para': 'PA', 'maranhao': 'MA',
    'matogrosso': 'MT', 'matogrossodosul': 'MS', 'espiritosanto': 'ES',
    'distritofederal': 'DF', 'amazonas': 'AM', 'paraiba': 'PB', 'piaui': 'PI',
    'riograndedonorte': 'RN', 'alagoas': 'AL', 'sergipe': 'SE', 'rondonia': 'RO',
    'tocantins': 'TO', 'acre': 'AC', 'amapa': 'AP', 'roraima': 'RR',
  };
  const norm = normalize(val);
  return nameMap[norm] || up;
}

// ── Status normalization ────────────────────────────────────
export function normalizeStatus(val: string): string {
  const statusMap: Record<string, string> = {
    'ativo': 'ativo', 'active': 'ativo', 'sim': 'ativo', 'yes': 'ativo',
    'churn': 'churn', 'cancelado': 'churn', 'cancelled': 'churn', 'canceled': 'churn',
    'naorenovado': 'nao_renovado', 'naorenovou': 'nao_renovado', 'notrenewed': 'nao_renovado',
    'naoiniciado': 'nao_iniciado', 'novo': 'nao_iniciado', 'new': 'nao_iniciado',
    'upsell': 'upsell', 'expansao': 'upsell', 'upgrade': 'upsell',
    'bonuselite': 'bonus_elite', 'elite': 'bonus_elite',
    'pausado': 'pausado', 'paused': 'pausado', 'suspenso': 'pausado',
  };
  const norm = normalize(val);
  return statusMap[norm] || val.toLowerCase().trim();
}

// ── Main sanitizer ──────────────────────────────────────────
export function sanitizeValue(val: any, field: ImportField): any {
  if (val === null || val === undefined) return val;
  const str = String(val).trim();
  if (!str) return str;

  const key = field.key;

  // Status field — normalize before anything else
  if (key === 'status') return normalizeStatus(str);
  // CPF fields
  if (key === 'cpf' || key === 'contact_cpf') return formatCPF(str);
  // CNPJ fields
  if (key === 'cnpj') return formatCNPJ(str);
  // CEP
  if (key === 'cep') return formatCEP(str);
  // State
  if (key === 'state') return sanitizeState(str);
  // Phone / WhatsApp
  if (key === 'phone' || key === 'whatsapp' || key === 'contact_phone') return sanitizePhone(str);
  // Instagram - ensure @ prefix
  if (key === 'instagram') return str.startsWith('@') ? str : `@${str}`;

  // By type
  switch (field.type) {
    case 'email':
      return str.toLowerCase().trim();
    case 'date':
      return parseFlexDate(str) || str;
    case 'number': {
      const num = parseMoney(str);
      return num !== null ? num : str;
    }
    case 'boolean':
      return str;
    case 'enum':
      return str.toLowerCase().trim();
    case 'text':
      if (['name', 'office_name', 'title', 'contact_name'].includes(key)) return titleCase(str);
      return str.trim();
    default:
      return str.trim();
  }
}
