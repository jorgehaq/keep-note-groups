import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIStore {
    activeGroupId: string | null;
    // Map group ID to open note IDs (array)
    openNotesByGroup: Record<string, string[]>;

    setActiveGroup: (id: string | null) => void;
    toggleNote: (groupId: string, noteId: string) => void;
}

export const useUIStore = create<UIStore>()(
    persist(
        (set) => ({
            activeGroupId: null,
            openNotesByGroup: {},

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
        }),
        {
            name: 'keep-note-groups-ui-storage-v2', // Changed name to force fresh state and avoid migration crashes
            storage: createJSONStorage(() => localStorage),
        }
    )
);
