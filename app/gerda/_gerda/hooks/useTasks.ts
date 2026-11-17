import { useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useLiveRows } from './useLiveRows';
import type { Priority, Task } from '../types';

const TABLE = 'gerda_tasks';

interface TaskRow {
  id: string;
  person: string;
  kommissions_nummer: string;
  kunde: string;
  priorisierung: number;
  bezeichnung: string;
  aufgabe: string;
  created_at: string | null;
  eingetragen_am: string | null;
  deadline: string | null;
  erledigt: boolean;
  sort_order: number | null;
  parent_id: string | null;
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    person: row.person,
    kommissionsNummer: row.kommissions_nummer,
    kunde: row.kunde,
    priorisierung: row.priorisierung as Priority,
    bezeichnung: row.bezeichnung,
    aufgabe: row.aufgabe,
    createdAt: row.created_at ?? '',
    eingetragenAm: row.eingetragen_am ?? '',
    deadline: row.deadline ?? undefined,
    erledigt: row.erledigt,
    order: row.sort_order ?? undefined,
    parentId: row.parent_id ?? undefined,
  };
}

/** Nur die übergebenen Felder → Spalten (undefined = Feld leeren). */
function toRow(task: Partial<Task>): Partial<TaskRow> {
  const row: Partial<TaskRow> = {};
  if ('id' in task) row.id = task.id;
  if ('person' in task) row.person = task.person ?? '';
  if ('kommissionsNummer' in task) row.kommissions_nummer = task.kommissionsNummer ?? '';
  if ('kunde' in task) row.kunde = task.kunde ?? '';
  if ('priorisierung' in task) row.priorisierung = task.priorisierung ?? 2;
  if ('bezeichnung' in task) row.bezeichnung = task.bezeichnung ?? '';
  if ('aufgabe' in task) row.aufgabe = task.aufgabe ?? '';
  if ('createdAt' in task) row.created_at = task.createdAt ?? null;
  if ('eingetragenAm' in task) row.eingetragen_am = task.eingetragenAm ?? null;
  if ('deadline' in task) row.deadline = task.deadline ?? null;
  if ('erledigt' in task) row.erledigt = !!task.erledigt;
  if ('order' in task) row.sort_order = task.order ?? null;
  if ('parentId' in task) row.parent_id = task.parentId ?? null;
  return row;
}

function compareTasks(a: Task, b: Task): number {
  // First sort by manual order if it exists
  if (a.order !== undefined && b.order !== undefined) {
    return a.order - b.order;
  }
  if (a.order !== undefined) return -1;
  if (b.order !== undefined) return 1;

  if (a.priorisierung !== b.priorisierung) {
    return a.priorisierung - b.priorisierung;
  }
  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return timeB - timeA;
}

export function useTasks() {
  const { rows, setRows } = useLiveRows<TaskRow>(TABLE, 'id');
  const tasks = useMemo(() => rows.map(toTask), [rows]);

  const addTask = async (task: Task) => {
    const row = { ...toRow(task), id: task.id } as TaskRow;
    setRows(prev => [...prev.filter(r => r.id !== row.id), { ...emptyRow(row.id), ...row }]);
    const { error } = await supabase.from(TABLE).upsert(row);
    if (error) console.error('Error adding task: ', error.message);
  };

  const updateTask = async (id: string, updatedTask: Partial<Task>) => {
    const patch = toRow(updatedTask);
    delete patch.id;
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from(TABLE).update(patch).eq('id', id);
    if (error) console.error('Error updating task: ', error.message);
  };

  const deleteTask = async (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) console.error('Error deleting task: ', error.message);
  };

  const getTasksByPerson = (person: string) => {
    return tasks.filter(t => t.person === person).sort(compareTasks);
  };

  const getAllTasks = () => {
    return [...tasks].sort((a, b) => {
      if (a.person !== b.person) {
        return a.person.localeCompare(b.person);
      }
      return compareTasks(a, b);
    });
  };

  const renameTasksPerson = async (oldName: string, newName: string) => {
    setRows(prev => prev.map(r => (r.person === oldName ? { ...r, person: newName } : r)));
    const { error } = await supabase.from(TABLE).update({ person: newName }).eq('person', oldName);
    if (error) console.error('Error renaming tasks person: ', error.message);
  };

  const deleteTasksByPerson = async (personName: string) => {
    setRows(prev => prev.filter(r => r.person !== personName));
    const { error } = await supabase.from(TABLE).delete().eq('person', personName);
    if (error) console.error('Error deleting tasks by person: ', error.message);
  };

  const reorderTasks = async (orderedTasks: { id: string; order: number }[]) => {
    const orderById = new Map(orderedTasks.map(t => [t.id, t.order]));
    setRows(prev => prev.map(r => (orderById.has(r.id) ? { ...r, sort_order: orderById.get(r.id)! } : r)));
    const results = await Promise.all(
      orderedTasks.map(t => supabase.from(TABLE).update({ sort_order: t.order }).eq('id', t.id))
    );
    const failed = results.find(r => r.error);
    if (failed?.error) console.error('Error reordering tasks: ', failed.error.message);
  };

  return {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    getTasksByPerson,
    getAllTasks,
    renameTasksPerson,
    deleteTasksByPerson,
    reorderTasks
  };
}

function emptyRow(id: string): TaskRow {
  return {
    id,
    person: '',
    kommissions_nummer: '',
    kunde: '',
    priorisierung: 2,
    bezeichnung: '',
    aufgabe: '',
    created_at: null,
    eingetragen_am: null,
    deadline: null,
    erledigt: false,
    sort_order: null,
    parent_id: null,
  };
}
