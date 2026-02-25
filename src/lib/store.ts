import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GlobalAppView, Task } from '../../types';

type LauncherTab = 'alpha' | 'recent' | 'pinned';

interface UIStore {
    activeGroupId: string | null;
    // Map group ID to open note IDs (array)
    openNotesByGroup: Record<string, string[]>;

    // Dock / Launcher State
    dockedGroupIds: string[]; // Groups visible in the sidebar
    lastLauncherTab: LauncherTab;
    noteSortMode: 'date-desc' | 'date-asc' | 'alpha-asc' | 'alpha-desc';
    globalView: GlobalAppView;
    activeTimersCount: number;
    overdueRemindersCount: number;
    imminentRemindersCount: number;
    editingNotes: Record<string, boolean>;
    lastAppView: GlobalAppView | null;
    lastUsedApp: string | null;
    kanbanTodoCount: number;
    kanbanInProgressCount: number;
    kanbanDoneCount: number;
    globalTasks: Task[]; // Assuming Task type is defined

    setActiveGroup: (id: string | null) => void;
    toggleNote: (groupId: string, noteId: string) => void;
    setEditingNote: (noteId: string, isEditing: boolean) => void;
    setKanbanCounts: (todo: number, inProgress: number, done: number) => void;
    setGlobalTasks: (tasks: Task[]) => void;

    // Dock Actions
    openGroup: (id: string) => void; // Adds to dock and sets active
    closeGroup: (id: string) => void; // Removes from dock
    setLauncherTab: (tab: LauncherTab) => void;
    setNoteSortMode: (mode: 'date-desc' | 'date-asc' | 'alpha-asc' | 'alpha-desc') => void;
    setGlobalView: (view: GlobalAppView) => void;
    setActiveTimersCount: (count: number) => void;
    setOverdueRemindersCount: (count: number) => void;
    setImminentRemindersCount: (count: number) => void;
}

export const useUIStore = create<UIStore>()(
    persist(
        (set) => ({
            activeGroupId: null,
            openNotesByGroup: {},
            dockedGroupIds: [],
            lastLauncherTab: 'recent', // Default to recent
            noteSortMode: 'date-desc',
            globalView: 'notes',
            activeTimersCount: 0,
            overdueRemindersCount: 0,
            imminentRemindersCount: 0,
            editingNotes: {},
            lastAppView: null,
            lastUsedApp: null,
            kanbanTodoCount: 0,
            kanbanInProgressCount: 0,
            kanbanDoneCount: 0,
            globalTasks: [],

            setActiveGroup: (id) => set({ activeGroupId: id }),

            toggleNote: (groupId, noteId) =>
                set((state) => {
                    const currentOpen = state.openNotesByGroup[groupId] || [];
                    const isOpen = currentOpen.includes(noteId);

                    // If open, remove it. If closed, add it.
                    const newOpen = isOpen
                        ? currentOpen.filter(id => id !== noteId)
                        : [...currentOpen, noteId];

                    return {
                        openNotesByGroup: {
                            ...state.openNotesByGroup,
                            [groupId]: newOpen
                        }
                    };
                }),

            openGroup: (id) => set((state) => {
                const isDocked = state.dockedGroupIds.includes(id);
                return {
                    dockedGroupIds: isDocked ? state.dockedGroupIds : [...state.dockedGroupIds, id],
                    activeGroupId: id
                };
            }),

            closeGroup: (id) => set((state) => {
                const newDocked = state.dockedGroupIds.filter(gId => gId !== id);
                // If closing active group, switch to another or null
                let newActive = state.activeGroupId;
                if (state.activeGroupId === id) {
                    newActive = newDocked.length > 0 ? newDocked[newDocked.length - 1] : null;
                }
                return {
                    dockedGroupIds: newDocked,
                    activeGroupId: newActive
                };
            }),

            setLauncherTab: (tab) => set({ lastLauncherTab: tab }),
            setNoteSortMode: (mode) => set({ noteSortMode: mode }),
            setGlobalView: (view) => set((state) => {
                // Si estábamos en una app (no en notas) y cambiamos a otra cosa, 
                // esa app se convierte en la "última que perdió el foco".
                const currentView = state.globalView;
                let newLastUsedApp = state.lastUsedApp;

                if (currentView && currentView !== 'notes' && currentView !== view) {
                    newLastUsedApp = currentView;
                }

                let newLastApp = state.lastAppView;
                // Si la vista actual es una App (no es 'notes') y estamos cambiando a otra cosa,
                // guardamos la vista actual como la "última usada"
                if (state.globalView !== 'notes' && state.globalView !== view) {
                    newLastApp = state.globalView;
                }
                return { 
                    globalView: view, 
                    lastAppView: newLastApp,
                    lastUsedApp: newLastUsedApp
                };
            }),
            setKanbanCounts: (todo, inProgress, done) => set({ kanbanTodoCount: todo, kanbanInProgressCount: inProgress, kanbanDoneCount: done }),
            setActiveTimersCount: (count) => set({ activeTimersCount: count }),
            setOverdueRemindersCount: (count) => set({ overdueRemindersCount: count }),
            setImminentRemindersCount: (count) => set({ imminentRemindersCount: count }),
            setEditingNote: (noteId, isEditing) => set((state) => ({ editingNotes: { ...state.editingNotes, [noteId]: isEditing } })),
            setGlobalTasks: (tasks) => set({ globalTasks: tasks }),
        }),
        {
            name: 'keep-note-groups-ui-storage-v4', // Bump version for editingNotes state
            storage: createJSONStorage(() => localStorage),
        }
    )
);
