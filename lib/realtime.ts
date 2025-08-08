import { supabase } from './supabase';

export const subscribeToUserKpis = (
  userId: string,
  onChange: () => void
): (() => void) => {
  const channel = supabase
    .channel(`kpis:user:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'dashboard_kpis',
        filter: `user_id=eq.${userId}`,
      },
      () => onChange()
    )
    .subscribe();

  return () => {
    try { supabase.removeChannel(channel); } catch {}
  };
};


