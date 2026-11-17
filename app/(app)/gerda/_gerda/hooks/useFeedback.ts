import { useMemo } from 'react';
import { v4 as uuidv4 } from '../utils/uuid';
import { supabase } from '../lib/supabase';
import { useLiveRows } from './useLiveRows';
import type { Feedback } from '../types';

const TABLE = 'gerda_feedback';

interface FeedbackRow {
  id: string;
  text: string;
  created_at: string | null;
  reply: string | null;
  erledigt: boolean;
}

export function useFeedback() {
  const { rows, setRows } = useLiveRows<FeedbackRow>(TABLE, 'id');
  const feedbacks = useMemo<Feedback[]>(
    () =>
      rows
        .map(r => ({
          id: r.id,
          text: r.text,
          createdAt: r.created_at ?? '',
          reply: r.reply ?? undefined,
          erledigt: r.erledigt,
        }))
        // Neueste zuerst (ISO-Zeitstempel sind als Text sortierbar).
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [rows]
  );

  const addFeedback = async (text: string) => {
    if (!text.trim()) return;
    const row: FeedbackRow = {
      id: uuidv4(),
      text: text.trim(),
      created_at: new Date().toISOString(),
      reply: null,
      erledigt: false,
    };
    setRows(prev => [...prev, row]);
    const { error } = await supabase.from(TABLE).insert(row);
    if (error) console.error('Error adding feedback: ', error.message);
  };

  const updateFeedback = async (id: string, updatedData: Partial<Feedback>) => {
    const patch: Partial<FeedbackRow> = {};
    if ('text' in updatedData) patch.text = updatedData.text ?? '';
    if ('createdAt' in updatedData) patch.created_at = updatedData.createdAt ?? null;
    if ('reply' in updatedData) patch.reply = updatedData.reply ?? null;
    if ('erledigt' in updatedData) patch.erledigt = !!updatedData.erledigt;
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from(TABLE).update(patch).eq('id', id);
    if (error) console.error('Error updating feedback: ', error.message);
  };

  const deleteFeedback = async (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) console.error('Error deleting feedback: ', error.message);
  };

  return { feedbacks, addFeedback, updateFeedback, deleteFeedback };
}
