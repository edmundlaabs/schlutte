/**
 * Deadline Status Utility
 *
 * Pure function that calculates the status of a deadline relative to today.
 * Inspired by the MVP prototype (gerda6), adapted for production use.
 *
 * Returns a structured object with `kind`, `label`, and `days` for flexible
 * rendering. Keeps the existing Live-App UI/text styling unchanged.
 */

export type DeadlineKind = 'none' | 'done' | 'overdue' | 'today' | 'tomorrow' | 'soon' | 'far';

export interface DeadlineStatus {
  kind: DeadlineKind;
  label: string;
  days: number | null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function pad2(n: number): string {
  return String(Math.abs(n)).padStart(2, '0');
}

/**
 * Calculate the deadline status of a task.
 *
 * @param deadline - ISO date string (YYYY-MM-DD) or undefined
 * @param isDone - Whether the task is completed
 * @param todayStr - Today's date as ISO string (YYYY-MM-DD)
 * @returns DeadlineStatus object with kind, label, and days
 */
export function getDeadlineStatus(
  deadline: string | undefined,
  isDone: boolean,
  todayStr: string
): DeadlineStatus {
  if (!deadline) {
    return { kind: 'none', label: '-', days: null };
  }

  if (isDone) {
    return { kind: 'done', label: 'Erledigt', days: null };
  }

  const today = new Date(todayStr).getTime();
  const deadlineDate = new Date(deadline).getTime();
  const diffDays = Math.round((deadlineDate - today) / MS_PER_DAY);

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return {
      kind: 'overdue',
      label: `+${pad2(absDays)} ${absDays === 1 ? 'Tag' : 'Tage'}`,
      days: diffDays,
    };
  }

  if (diffDays === 0) {
    return { kind: 'today', label: 'Heute', days: 0 };
  }

  if (diffDays === 1) {
    return { kind: 'tomorrow', label: 'Morgen', days: 1 };
  }

  if (diffDays <= 7) {
    return {
      kind: 'soon',
      label: `${pad2(diffDays)} Tage`,
      days: diffDays,
    };
  }

  return {
    kind: 'far',
    label: `${pad2(diffDays)} Tage`,
    days: diffDays,
  };
}
