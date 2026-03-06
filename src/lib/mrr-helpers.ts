import { supabase } from '@/integrations/supabase/client';

export function calculateMRR(contract: any): number {
  if (contract.monthly_value && contract.monthly_value > 0) return contract.monthly_value;
  if (contract.value && contract.value > 0) return contract.value / 12;
  return 0;
}

/**
 * Process contract dates: auto-fill end_date, cycle dates, activation_date, and MRR.
 * Call after creating or editing a contract.
 */
export async function processContractDates(officeId: string, contract: { start_date?: string | null; end_date?: string | null; monthly_value?: number | null; value?: number | null }) {
  const startDate = contract.start_date;
  let endDate = contract.end_date;

  // 1. Auto-calculate end_date = start_date + 12 months if missing
  if (!endDate && startDate) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + 12);
    endDate = d.toISOString().split('T')[0];
  }

  const officeUpdate: Record<string, any> = {};

  // 2. Update cycle dates
  if (startDate) officeUpdate.cycle_start_date = startDate;
  if (startDate) {
    const cycleEnd = new Date(startDate);
    cycleEnd.setMonth(cycleEnd.getMonth() + 12);
    officeUpdate.cycle_end_date = cycleEnd.toISOString().split('T')[0];
  }

  // 3. Set activation_date only if null (first contract)
  const { data: office } = await supabase.from('offices').select('activation_date').eq('id', officeId).single();
  if (office && !office.activation_date && startDate) {
    officeUpdate.activation_date = startDate;
  }

  // 4. Calculate and save MRR
  officeUpdate.mrr = calculateMRR(contract);

  if (Object.keys(officeUpdate).length > 0) {
    await supabase.from('offices').update(officeUpdate).eq('id', officeId);
  }

  return { endDate };
}
