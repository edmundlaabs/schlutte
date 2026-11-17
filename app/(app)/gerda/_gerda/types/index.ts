export type Priority = 1 | 2 | 3;
export type Person = string;
export type TaskType = string;

export interface Task {
  id: string;
  person: string;
  kommissionsNummer: string; // Numeric but stored as string for flexibility
  kunde: string;
  priorisierung: Priority;
  bezeichnung: string;
  aufgabe: string;
  createdAt: string;
  eingetragenAm: string;
  deadline?: string;
  erledigt?: boolean;
  order?: number;
  parentId?: string;
}

export interface Feedback {
  id: string;
  text: string;
  createdAt: string;
  reply?: string;
  erledigt?: boolean;
}
