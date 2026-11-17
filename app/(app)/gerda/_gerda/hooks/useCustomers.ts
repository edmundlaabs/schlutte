import { useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useLiveRows } from './useLiveRows';

const TABLE = 'gerda_customers';

export function useCustomers() {
  const { rows, setRows } = useLiveRows<{ name: string }>(TABLE, 'name');
  const customers = useMemo(
    () => rows.map(r => r.name).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const addCustomer = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setRows(prev => (prev.some(r => r.name === trimmed) ? prev : [...prev, { name: trimmed }]));
    const { error } = await supabase.from(TABLE).upsert({ name: trimmed });
    if (error) console.error('Error adding customer: ', error.message);
  };

  const deleteCustomer = async (name: string) => {
    setRows(prev => prev.filter(r => r.name !== name));
    const { error } = await supabase.from(TABLE).delete().eq('name', name);
    if (error) console.error('Error deleting customer: ', error.message);
  };

  return { customers, addCustomer, deleteCustomer };
}
