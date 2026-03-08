import { supabase } from '@/integrations/supabase/client';

export async function generateNextOfficeCode(productId: string): Promise<string | null> {
  const { data: product } = await supabase
    .from('products')
    .select('code_prefix')
    .eq('id', productId)
    .single();

  const prefix = (product as any)?.code_prefix;
  if (!prefix) return null;

  const { data: existing } = await supabase
    .from('offices')
    .select('office_code')
    .ilike('office_code', `${prefix}%`)
    .order('office_code', { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (existing && existing.length > 0 && existing[0].office_code) {
    const match = existing[0].office_code.match(/(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  const paddedNumber = String(nextNumber).padStart(3, '0');
  return `${prefix} - ${paddedNumber}`;
}

export async function generateNextOfficeCodeSafe(productId: string, maxRetries = 3): Promise<string | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = await generateNextOfficeCode(productId);
    if (!code) return null;

    // On retry, increment the number
    if (attempt > 0) {
      const match = code.match(/^(.+) - (\d+)$/);
      if (match) {
        const num = parseInt(match[2], 10) + attempt;
        return `${match[1]} - ${String(num).padStart(3, '0')}`;
      }
    }

    return code;
  }
  return null;
}
