import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
    BrainDump,
    GlobalAppView,
    Group,
    Note,
    NoteSortMode,
    Task,
    Translation,
} from "../../types";

type LauncherTab = "alpha" | "recent" | "pinned";

interface UIStore {
    activeGroupId: string | null;
    // Map group ID to open note IDs (array)
    openNotesByGroup: Record<string, string[]>;

    // Dock / Launcher State
    dockedGroupIds: string[]; // Groups visible in the sidebar
    lastLauncherTab: LauncherTab;
    noteSortMode: NoteSortMode;
    globalView: GlobalAppView;
    activeTimersCount: number;
    overdueRemindersCount: number;
    overdueRemindersList: {
        id: string;
        title: string;
        targetId: string;
        dueAt: string;
    }[];
    imminentRemindersCount: number;
    editingNotes: Record<string, boolean>;
    lastAppView: GlobalAppView | null;
    lastUsedApp: string | null;
    kanbanTodoCount: number;
    kanbanInProgressCount: number;
    kanbanDoneCount: number;
    globalTasks: Task[]; // Assuming Task type is defined
    isMaximized: boolean;
    isBraindumpMaximized: boolean;
    isTranslatorMaximized: boolean;

    // Persisted UI State (per-group for notes)
    focusedNoteByGroup: Record<string, string | null>;
    noteTrayOpenByGroup: Record<string, boolean>;
    focusedDumpId: string | null;
    isDumpTrayOpen: boolean;

    // Realtime Sync Data
    groups: Group[];
    translations: Translation[];
    brainDumps: BrainDump[];

    setGroups: (groups: Group[] | ((prev: Group[]) => Group[])) => void;
    setTranslations: (
        translations: Translation[] | ((prev: Translation[]) => Translation[]),
    ) => void;
    setBrainDumps: (
        dumps: BrainDump[] | ((prev: BrainDump[]) => BrainDump[]),
    ) => void;

    // Helper to update a group in the list
    updateGroupSync: (groupId: string, updates: Partial<Group>) => void;
    // Helper to update a note inside ANY group
    updateNoteSync: (noteId: string, updates: Partial<Note>) => void;
    // Helper to update a translation
    updateTranslationSync: (id: string, updates: Partial<Translation>) => void;
    // Helper to update a brain dump
    updateBrainDumpSync: (id: string, updates: Partial<BrainDump>) => void;

    deleteGroupSync: (groupId: string) => void;
    deleteNoteSync: (noteId: string) => void;
    deleteTranslationSync: (id: string) => void;
    deleteBrainDumpSync: (id: string) => void;

    setActiveGroup: (id: string | null) => void;
    toggleNote: (groupId: string, noteId: string) => void;
    setEditingNote: (noteId: string, isEditing: boolean) => void;
    setKanbanCounts: (todo: number, inProgress: number, done: number) => void;
    setGlobalTasks: (tasks: Task[]) => void;
    setIsMaximized: (maximized: boolean) => void;
    setIsBraindumpMaximized: (maximized: boolean) => void;
    setIsTranslatorMaximized: (maximized: boolean) => void;
    setFocusedNoteId: (id: string | null, groupId?: string) => void;
    setIsGlobalNoteTrayOpen: (open: boolean, groupId?: string) => void;
    setFocusedDumpId: (id: string | null) => void;
    setIsDumpTrayOpen: (open: boolean) => void;

    // Dock Actions
    openGroup: (id: string) => void; // Adds to dock and sets active
    closeGroup: (id: string) => void; // Removes from dock
    setLauncherTab: (tab: LauncherTab) => void;
    setNoteSortMode: (
        mode:
            | "date-desc"
            | "date-asc"
            | "created-desc"
            | "created-asc"
            | "alpha-asc"
            | "alpha-desc",
    ) => void;
    setGlobalView: (view: GlobalAppView) => void;
    setActiveTimersCount: (count: number) => void;
    setOverdueRemindersCount: (count: number) => void;
    setOverdueRemindersList: (
        list:
            | { id: string; title: string; targetId: string; dueAt: string }[]
            | ((prev: {
                id: string;
                title: string;
                targetId: string;
                dueAt: string;
            }[]) => {
                id: string;
                title: string;
                targetId: string;
                dueAt: string;
            }[]),
    ) => void;
    setImminentRemindersCount: (count: number) => void;
    showOverdueMarquee: boolean;
    setShowOverdueMarquee: (show: boolean) => void;
}

export const useUIStore = create<UIStore>()(
    persist(
        (set, get) => ({
            activeGroupId: null,
            openNotesByGroup: {},
            dockedGroupIds: [],
            lastLauncherTab: "recent", // Default to recent
            noteSortMode: "date-desc",
            globalView: "notes",
            activeTimersCount: 0,
            overdueRemindersCount: 0,
            overdueRemindersList: [],
            imminentRemindersCount: 0,
            editingNotes: {},
            lastAppView: null,
            lastUsedApp: null,
            kanbanTodoCount: 0,
            kanbanInProgressCount: 0,
            kanbanDoneCount: 0,
            globalTasks: [],
            isMaximized: false,
            isBraindumpMaximized: false,
            isTranslatorMaximized: false,
            showOverdueMarquee: false,
            focusedNoteByGroup: {},
            noteTrayOpenByGroup: {},
            focusedDumpId: null,
            isDumpTrayOpen: false,

            setActiveGroup: (id) => set({ activeGroupId: id }),

            toggleNote: (groupId, noteId) =>
                set((state) => {
                    const currentOpen = state.openNotesByGroup[groupId] || [];
                    const isOpen = currentOpen.includes(noteId);

                    // If open, remove it. If closed, add it.
                    const newOpen = isOpen
                        ? currentOpen.filter((id) => id !== noteId)
                        : [...currentOpen, noteId];

                    return {
                        openNotesByGroup: {
                            ...state.openNotesByGroup,
                            [groupId]: newOpen,
                        },
                    };
                }),

            openGroup: (id) =>
                set((state) => {
                    const isDocked = state.dockedGroupIds.includes(id);
                    return {
                        dockedGroupIds: isDocked
                            ? state.dockedGroupIds
                            : [...state.dockedGroupIds, id],
                        activeGroupId: id,
                    };
                }),

            closeGroup: (id) =>
                set((state) => {
                    const newDocked = state.dockedGroupIds.filter((gId) =>
                        gId !== id
                    );
                    // If closing active group, switch to another or null
                    let newActive = state.activeGroupId;
                    if (state.activeGroupId === id) {
                        newActive = newDocked.length > 0
                            ? newDocked[newDocked.length - 1]
                            : null;
                    }
                    return {
                        dockedGroupIds: newDocked,
                        activeGroupId: newActive,
                    };
                }),

            setLauncherTab: (tab) => set({ lastLauncherTab: tab }),
            setNoteSortMode: (mode) => set({ noteSortMode: mode }),
            setGlobalView: (view) =>
                set((state) => {
                    // Si estábamos en una app (no en notas) y cambiamos a otra cosa,
                    // esa app se convierte en la "última que perdió el foco".
                    const currentView = state.globalView;
                    let newLastUsedApp = state.lastUsedApp;

                    if (
                        currentView && currentView !== "notes" &&
                        currentView !== view
                    ) {
                        newLastUsedApp = currentView;
                    }

                    let newLastApp = state.lastAppView;
                    // Si la vista actual es una App (no es 'notes') y estamos cambiando a otra cosa,
                    // guardamos la vista actual como la "última usada"
                    if (
                        state.globalView !== "notes" &&
                        state.globalView !== view
                    ) {
                        newLastApp = state.globalView;
                    }
                    return {
                        globalView: view,
                        lastAppView: newLastApp,
                        lastUsedApp: newLastUsedApp,
                    };
                }),
            setKanbanCounts: (todo, inProgress, done) =>
                set({
                    kanbanTodoCount: todo,
                    kanbanInProgressCount: inProgress,
                    kanbanDoneCount: done,
                }),
            setActiveTimersCount: (count) => set({ activeTimersCount: count }),
            setOverdueRemindersCount: (count) =>
                set({ overdueRemindersCount: count }),
            setOverdueRemindersList: (listOrFn) =>
                set((state) => ({
                    overdueRemindersList: typeof listOrFn === "function"
                        ? listOrFn(state.overdueRemindersList)
                        : listOrFn,
                })),
            setImminentRemindersCount: (count) =>
                set({ imminentRemindersCount: count }),
            setEditingNote: (noteId, isEditing) =>
                set((state) => ({
                    editingNotes: {
                        ...state.editingNotes,
                        [noteId]: isEditing,
                    },
                })),
            setGlobalTasks: (tasks) => set({ globalTasks: tasks }),
            setIsMaximized: (maximized) => set({ isMaximized: maximized }),
            setIsBraindumpMaximized: (maximized) =>
                set({ isBraindumpMaximized: maximized }),
            setIsTranslatorMaximized: (maximized) =>
                set({ isTranslatorMaximized: maximized }),
            setFocusedNoteId: (id, groupId) => {
                const gid = groupId ?? get().activeGroupId;
                if (!gid) return;
                set((state) => ({
                    focusedNoteByGroup: {
                        ...state.focusedNoteByGroup,
                        [gid]: id,
                    },
                }));
            },
            setIsGlobalNoteTrayOpen: (open, groupId) => {
                const gid = groupId ?? get().activeGroupId;
                if (!gid) return;
                set((state) => ({
                    noteTrayOpenByGroup: {
                        ...state.noteTrayOpenByGroup,
                        [gid]: open,
                    },
                }));
            },
            setFocusedDumpId: (id) => set({ focusedDumpId: id }),
            setIsDumpTrayOpen: (open) => set({ isDumpTrayOpen: open }),
            setShowOverdueMarquee: (show) => set({ showOverdueMarquee: show }),

            // Realtime Sync Implementation
            groups: [],
            translations: [],
            brainDumps: [],

            setGroups: (groupsOrFn) =>
                set((state) => ({
                    groups: typeof groupsOrFn === "function"
                        ? groupsOrFn(state.groups)
                        : groupsOrFn,
                })),
            setTranslations: (translationsOrFn) =>
                set((state) => ({
                    translations: typeof translationsOrFn === "function"
                        ? translationsOrFn(state.translations)
                        : translationsOrFn,
                })),
            setBrainDumps: (dumpsOrFn) =>
                set((state) => ({
                    brainDumps: typeof dumpsOrFn === "function"
                        ? dumpsOrFn(state.brainDumps)
                        : dumpsOrFn,
                })),

            updateGroupSync: (groupId, updates) =>
                set((state) => ({
                    groups: state.groups.map((g) =>
                        g.id === groupId ? { ...g, ...updates } : g
                    ),
                })),

            updateNoteSync: (noteId, updates) =>
                set((state) => ({
                    groups: state.groups.map((g) => ({
                        ...g,
                        notes: g.notes.map((n) =>
                            n.id === noteId ? { ...n, ...updates } : n
                        ),
                    })),
                })),

            updateTranslationSync: (id, updates) =>
                set((state) => ({
                    translations: state.translations.map((t) =>
                        t.id === id ? { ...t, ...updates } : t
                    ),
                })),

            updateBrainDumpSync: (id, updates) =>
                set((state) => ({
                    brainDumps: state.brainDumps.map((d) =>
                        d.id === id ? { ...d, ...updates } : d
                    ),
                })),

            deleteGroupSync: (groupId) =>
                set((state) => ({
                    groups: state.groups.filter((g) => g.id !== groupId),
                    activeGroupId: state.activeGroupId === groupId
                        ? null
                        : state.activeGroupId,
                })),

            deleteNoteSync: (noteId) =>
                set((state) => ({
                    groups: state.groups.map((g) => ({
                        ...g,
                        notes: g.notes.filter((n) => n.id !== noteId),
                    })),
                })),

            deleteTranslationSync: (id) =>
                set((state) => ({
                    translations: state.translations.filter((t) => t.id !== id),
                })),

            deleteBrainDumpSync: (id) =>
                set((state) => ({
                    brainDumps: state.brainDumps.filter((d) => d.id !== id),
                })),
        }),
        {
            name: "keep-note-groups-ui-storage-v8", // v8: per-group focus & tray
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                dockedGroupIds: state.dockedGroupIds,
                openNotesByGroup: state.openNotesByGroup,
                activeGroupId: state.activeGroupId,
                lastLauncherTab: state.lastLauncherTab,
                noteSortMode: state.noteSortMode,
                globalTasks: state.globalTasks,
                isMaximized: state.isMaximized,
                isBraindumpMaximized: state.isBraindumpMaximized,
                isTranslatorMaximized: state.isTranslatorMaximized,
                focusedNoteByGroup: state.focusedNoteByGroup,
                noteTrayOpenByGroup: state.noteTrayOpenByGroup,
                focusedDumpId: state.focusedDumpId,
                isDumpTrayOpen: state.isDumpTrayOpen,
            }),
        },
    ),
);
