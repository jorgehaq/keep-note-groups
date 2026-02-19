import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type LauncherTab = 'alpha' | 'recent' | 'pinned';

interface UIStore {
    activeGroupId: string | null;
    // Map group ID to open note IDs (array)
    openNotesByGroup: Record<string, string[]>;

    // Dock / Launcher State
    dockedGroupIds: string[]; // Groups visible in the sidebar
    lastLauncherTab: LauncherTab;

    setActiveGroup: (id: string | null) => void;
    toggleNote: (groupId: string, noteId: string) => void;

    // Dock Actions
    openGroup: (id: string) => void; // Adds to dock and sets active
    closeGroup: (id: string) => void; // Removes from dock
    setLauncherTab: (tab: LauncherTab) => void;
}

export const useUIStore = create<UIStore>()(
    persist(
        (set) => ({
            activeGroupId: null,
            openNotesByGroup: {},
            dockedGroupIds: [],
            lastLauncherTab: 'recent', // Default to recent

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
        }),
        {
            name: 'keep-note-groups-ui-storage-v3', // Bump version for new state shape
            storage: createJSONStorage(() => localStorage),
        }
    )
);
