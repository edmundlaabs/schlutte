import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 1000;
let channelSeq = 0;

/**
 * Lädt alle Zeilen einer Tabelle und hält sie live aktuell (Supabase Realtime) —
 * Ersatz für Firestore onSnapshot. Bei jeder Änderung wird die Tabelle neu geladen
 * (kleine Datenmengen), ebenso nach An-/Abmeldung. setRows erlaubt optimistische
 * Updates, damit eigene Änderungen sofort sichtbar sind.
 */
export function useLiveRows<Row>(
  table: string,
  keyColumn: string
): { rows: Row[]; setRows: Dispatch<SetStateAction<Row[]>> } {
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const all: Row[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order(keyColumn, { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error(`Fehler beim Laden von ${table}:`, error.message);
        return;
      }
      all.push(...((data ?? []) as Row[]));
      if (!data || data.length < PAGE_SIZE) break;
    }
    setRows(all);
  }, [table, keyColumn]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Mehrere Änderungen kurz hintereinander (z. B. Umsortieren) → ein Reload.
    const schedule = (delay = 120) => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), delay);
    };

    schedule(0);

    const channel = supabase
      .channel(`${table}-${++channelSeq}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => schedule())
      .subscribe();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setRows([]);
      else if (event === 'SIGNED_IN') schedule();
    });

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
      authListener.subscription.unsubscribe();
    };
  }, [table, load]);

  return { rows, setRows };
}
