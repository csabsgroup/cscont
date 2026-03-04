import { supabase } from '@/integrations/supabase/client';

export async function checkHealthPlaybook(
  officeId: string,
  productId: string,
  newBand: string,
  oldBand: string | null
) {
  if (!newBand || newBand === oldBand) return null;

  try {
    const { data, error } = await supabase.functions.invoke('execute-health-playbook', {
      body: {
        office_id: officeId,
        product_id: productId,
        new_band: newBand,
        old_band: oldBand,
      },
    });
    if (error) console.error('Health playbook error:', error);
    return data;
  } catch (err) {
    console.error('Health playbook invocation error:', err);
    return null;
  }
}
