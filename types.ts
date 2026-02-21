export interface Note {
  id: string;
  title: string;
  content: string;
  isOpen: boolean; // UI state, not necessarily in DB (or mapped from is_open if we added it, but schema didn't have it, I'll keep it local or map it)
  // Schema has: id, user_id, group_id, title, content, position, created_at
  // We need to map DB -> UI
  created_at?: string;
  group_id?: string;
  position?: number;
  is_pinned?: boolean;
  is_docked?: boolean;
  updated_at?: string;
  is_checklist?: boolean;
}

export interface Group {
  id: string;
  title: string; // UI uses title, we map DB 'name' -> 'title' in App.tsx
  notes: Note[];
  color?: string; // Optional aesthetic color for the "window"
  user_id?: string;
  is_pinned?: boolean;
  last_accessed_at?: string;
}

export type Theme = 'light' | 'dark' | 'system';

export type NoteAction =
  | { type: 'ADD_NOTE'; groupId: string }
  | { type: 'DELETE_NOTE'; groupId: string; noteId: string }
  | { type: 'UPDATE_NOTE'; groupId: string; noteId: string; payload: { content?: string; title?: string } }
  | { type: 'TOGGLE_NOTE'; groupId: string; noteId: string };

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done' | 'archived';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  position: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export type GlobalAppView = 'notes' | 'kanban' | 'timers' | 'reminders';

export type TimerType = 'stopwatch' | 'countdown';
export type TimerStatus = 'running' | 'paused';

export interface Timer {
  id: string;
  title: string;
  type: TimerType;
  status: TimerStatus;
  accumulated_seconds: number;
  target_seconds: number;
  last_started_at: string | null;
  user_id: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  title: string;
  note?: string;
  due_at: string;
  is_completed: boolean;
  user_id: string;
  created_at: string;
}
