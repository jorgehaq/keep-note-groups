export interface Note {
  id: string;
  title: string;
  content: string;
  isOpen: boolean;
  createdAt: number;
}

export interface Group {
  id: string;
  title: string;
  notes: Note[];
  color?: string; // Optional aesthetic color for the "window"
}

export type Theme = 'light' | 'dark' | 'system';

export type NoteAction = 
  | { type: 'ADD_NOTE'; groupId: string }
  | { type: 'DELETE_NOTE'; groupId: string; noteId: string }
  | { type: 'UPDATE_NOTE'; groupId: string; noteId: string; payload: { content?: string; title?: string } }
  | { type: 'TOGGLE_NOTE'; groupId: string; noteId: string };
