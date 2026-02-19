import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIStore {
    activeGroupId: string | null;
    // Map group ID to open note ID
    openNotesByGroup: Record<string, string | null>;

    setActiveGroup: (id: string | null) => void;
    setOpenNote: (groupId: string, noteId: string | null) => void;
}

export const useUIStore = create<UIStore>()(
    persist(
        (set) => ({
            activeGroupId: null,
            openNotesByGroup: {},

            setActiveGroup: (id) => set({ activeGroupId: id }),

            setOpenNote: (groupId, noteId) =>
                set((state) => ({
                    openNotesByGroup: {
                        ...state.openNotesByGroup,
                        [groupId]: noteId
                    }
                })),
        }),
        {
            name: 'keep-note-groups-ui-storage', // name of the item in the storage (must be unique)
            storage: createJSONStorage(() => localStorage),
        }
    )
);
