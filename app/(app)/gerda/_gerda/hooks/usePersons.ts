import { useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useLiveRows } from './useLiveRows';

const TABLE = 'gerda_persons';

export interface Person {
  name: string;
  active: boolean;
  shortName: string;
}

interface PersonRow {
  name: string;
  active: boolean;
  short_name: string;
}

export function usePersons() {
  const { rows, setRows } = useLiveRows<PersonRow>(TABLE, 'name');
  const persons = useMemo<Person[]>(
    () => rows.map(r => ({ name: r.name, active: r.active, shortName: r.short_name })),
    [rows]
  );

  const addPerson = async (name: string, shortName: string) => {
    const trimmedName = name.trim();
    const trimmedShortName = shortName.trim().toUpperCase().slice(0, 3);
    if (!persons.find(p => p.name === trimmedName) && trimmedName !== '') {
      const row: PersonRow = { name: trimmedName, active: true, short_name: trimmedShortName };
      setRows(prev => [...prev, row]);
      const { error } = await supabase.from(TABLE).insert(row);
      if (error) console.error('Error adding person: ', error.message);
    }
  };

  const removePerson = async (name: string) => {
    setRows(prev => prev.filter(r => r.name !== name));
    const { error } = await supabase.from(TABLE).delete().eq('name', name);
    if (error) console.error('Error removing person: ', error.message);
  };

  const renamePerson = async (oldName: string, newName: string, newShortName?: string) => {
    const trimmedNewName = newName.trim();
    if (trimmedNewName === '') return false;
    if (trimmedNewName !== oldName && persons.find(p => p.name === trimmedNewName)) return false;

    const oldPerson = persons.find(p => p.name === oldName);
    if (!oldPerson) return false;

    const patch: Partial<PersonRow> = { name: trimmedNewName };
    if (trimmedNewName === oldName) {
      if (newShortName !== undefined) patch.short_name = newShortName;
    } else {
      patch.short_name = newShortName || oldPerson.shortName;
    }
    setRows(prev => prev.map(r => (r.name === oldName ? { ...r, ...patch } : r)));
    const { error } = await supabase.from(TABLE).update(patch).eq('name', oldName);
    if (error) {
      console.error('Error renaming person: ', error.message);
      return false;
    }
    return true;
  };

  const togglePersonActive = async (name: string) => {
    const person = persons.find(p => p.name === name);
    if (!person) return;
    setRows(prev => prev.map(r => (r.name === name ? { ...r, active: !person.active } : r)));
    const { error } = await supabase.from(TABLE).update({ active: !person.active }).eq('name', name);
    if (error) console.error('Error toggling person active state: ', error.message);
  };

  return { persons, addPerson, removePerson, renamePerson, togglePersonActive };
}
