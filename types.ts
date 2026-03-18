export interface Note {
  id: string;
  title: string;
  content: string;
  isOpen?: boolean; // UI state (kept for compatibility)
  is_open?: boolean; // DB state
  // Schema has: id, user_id, group_id, title, content, position, created_at
  // We need to map DB -> UI
  created_at?: string;
  group_id?: string;
  position?: number;
  is_pinned?: boolean;
  is_docked?: boolean;
  updated_at?: string;
  is_checklist?: boolean;
  parent_note_id?: string | null;
  generation_level?: number;
  focus_prompt?: string | null;
  ai_generated?: boolean;
  ai_summary_status?:
    | "idle"
    | "queued"
    | "processing"
    | "done"
    | "error";
  generation_status?:
    | "idle"
    | "queued"
    | "processing"
    | "done"
    | "error"
    | "stale";
  scratchpad?: string;
  children?: Note[];
}

export type NoteFont = "sans" | "serif" | "mono";

export interface Group {
  id: string;
  title: string; // UI uses title, we map DB 'name' -> 'title' in App.tsx
  notes: Note[];
  color?: string; // Optional aesthetic color for the "window"
  user_id?: string;
  is_pinned?: boolean;
  is_favorite?: boolean;
  last_accessed_at?: string;
}

export type NoteSortMode =
  | "date-desc"
  | "date-asc"
  | "created-desc"
  | "created-asc"
  | "alpha-asc"
  | "alpha-desc";

export type Theme = "light" | "dark" | "system";

export type NoteAction =
  | { type: "ADD_NOTE"; groupId: string }
  | { type: "DELETE_NOTE"; groupId: string; noteId: string }
  | {
    type: "UPDATE_NOTE";
    groupId: string;
    noteId: string;
    payload: { content?: string; title?: string };
  }
  | { type: "TOGGLE_NOTE"; groupId: string; noteId: string };

export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "done"
  | "archived";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  position: number;
  user_id: string;
  created_at: string;
  updated_at: string;
  content?: string;
  source_id?: string;
  linked_note_id?: string;
  linked_board_id?: string;
}

export type GlobalAppView =
  | "notes"
  | "kanban"
  | "timers"
  | "reminders"
  | "braindump"
  | "translator"
  | "tiktok";

export type TimerType = "stopwatch" | "countdown";
export type TimerStatus = "running" | "paused";

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

export interface Translation {
  id: string;
  source_text: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
  created_at: string;
  user_id: string;
}

export type BrainDumpStatus = "main" | "active" | "history";

export interface BrainDump {
  id: string;
  title?: string;
  content: string;
  is_checklist?: boolean;
  status: BrainDumpStatus;
  user_id: string;
  created_at: string;
  updated_at: string;
  parent_id?: string | null;
  generation_level?: number;
  focus_prompt?: string | null;
  ai_summary_status?:
    | "idle"
    | "queued"
    | "processing"
    | "done"
    | "error";
  generation_status?:
    | "idle"
    | "queued"
    | "processing"
    | "done"
    | "error"
    | "stale";
  scratchpad?: string;
  children?: BrainDump[];
}

export interface Summary {
  id: string;
  note_id?: string | null;
  brain_dump_id?: string | null;
  target_objective: string;
  content: string;
  scratchpad?: string;
  status: "pending" | "processing" | "completed" | "error";
  created_at: string;
  user_id: string;
}

export interface TikTokVideo {
  id: string;
  user_id: string;
  url: string;
  title?: string;
  author?: string;
  duration: number;
  thumbnail?: string;
  view_count: number;
  like_count: number;
  transcript?: string;
  description?: string;
  content: string;
  scratchpad?: string;
  status: TaskStatus;
  ai_summary_status?: "idle" | "queued" | "processing" | "completed" | "failed";
  key_points?: string[];
  summary?: string;
  category?: string;
  created_at: string;
  updated_at: string;
}

export interface TikTokQueueItem {
  id: string;
  user_id: string;
  url: string;
  status: "pending" | "processing" | "completed" | "error";
  error_msg?: string;
  video_id?: string;
  created_at: string;
}
