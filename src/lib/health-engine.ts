import { supabase } from '@/integrations/supabase/client';

export async function recalculateHealth(officeId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('calculate-health-score', {
      body: { office_id: officeId },
    });
    if (error) {
      console.error('Health recalculation error:', error);
      return null;
    }
    console.log('Health recalculated:', data);
    return data;
  } catch (err) {
    console.error('Health recalculation invocation error:', err);
    return null;
  }
}
