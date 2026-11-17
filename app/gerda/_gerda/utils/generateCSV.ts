import type { Task } from '../types';

/**
 * Generate a CSV file from a list of tasks and trigger download.
 *
 * Uses semicolon as separator (Excel-friendly for German locale).
 * Includes BOM for UTF-8 detection in Excel.
 */
export function generateCSVReport(tasks: Task[], filename: string): void {
  const headers = [
    'Mitarbeiter',
    'Kunde',
    'Aufgabe',
    'Bezeichnung',
    'Komm.-Nr.',
    'Eingetragen',
    'Deadline',
    'Priorität',
    'Erledigt',
  ];

  const priorityLabel = (p: number | undefined): string => {
    if (p === 1) return 'Hoch';
    if (p === 2) return 'Mittel';
    if (p === 3) return 'Niedrig';
    return '';
  };

  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${d.getFullYear()}`;
  };

  const escapeCsv = (val: string | number | undefined | null): string => {
    const s = String(val ?? '');
    return `"${s.replace(/"/g, '""')}"`;
  };

  const rows = [
    headers.map(escapeCsv).join(';'),
    ...tasks.map(t =>
      [
        t.person,
        t.kunde,
        t.aufgabe,
        t.bezeichnung,
        t.kommissionsNummer,
        formatDate(t.eingetragenAm),
        formatDate(t.deadline),
        priorityLabel(t.priorisierung),
        t.erledigt ? 'ja' : 'nein',
      ]
        .map(escapeCsv)
        .join(';')
    ),
  ];

  const csvContent = '﻿' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename.replace(/[^a-z0-9-_]/gi, '_')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
