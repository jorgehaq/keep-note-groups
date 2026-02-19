import React, { useState, useEffect } from 'react';
import { Plus, Search, Menu, Loader2, Edit2, Check, X, Calendar, ArrowUp, ArrowDown, Type } from 'lucide-react';
import { Note, Group, Theme } from './types';
import { AccordionItem } from './components/AccordionItem';
import { Sidebar } from './components/Sidebar';
import { SettingsWindow } from './components/SettingsWindow';
// import { generateId } from './utils'; // No longer needed for IDs, Supabase handles it
import { supabase } from './src/lib/supabaseClient';
import { Auth } from './components/Auth';
import { Session } from '@supabase/supabase-js';
import { useUIStore } from './src/lib/store';

function App() {
  // --- STATE ---
  const [session, setSession] = useState<Session | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // ZUSTAND STORE
  const { activeGroupId, setActiveGroup, openNotesByGroup, openGroup, dockedGroupIds, noteSortMode, setNoteSortMode } = useUIStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<Theme>('dark');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // --- EDIT GROUP STATE ---
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [tempGroupName, setTempGroupName] = useState('');

  // Track the note currently being edited to "freeze" it in the list (prevent jumping)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // --- AUTH & INITIAL LOAD ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchData();
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchData();
      else {
        setGroups([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- DATA FETCHING ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: true });

      if (groupsError) throw groupsError;

      // Fetch notes
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .order('position', { ascending: true }); // We'll refine sort client-side for pins

      if (notesError) throw notesError;

      // Transform and merge
      // Map DB 'name' to UI 'title' for groups
      const mergedGroups: Group[] = (groupsData || []).map(g => {
        const groupNotes: Note[] = (notesData || [])
          .filter(n => n.group_id === g.id)
          .map(n => ({
            ...n,
            isOpen: false // Default state for UI
          }));

        // Sort: Pinned first, then by Title (A-Z) - as requested
        // Or Title? Request said: "1. Pinned, 2. Alphabetical".
        // Original fetch was by 'position'. I will respect the request.
        groupNotes.sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return a.title.localeCompare(b.title);
        });

        return {
          id: g.id,
          title: g.name, // Map DB column 'name' to UI property 'title'
          user_id: g.user_id,
          is_pinned: g.is_pinned,
          last_accessed_at: g.last_accessed_at,
          notes: groupNotes
        };
      });

      setGroups(mergedGroups);

      // We rely on store 'activeGroupId' and 'dockedGroupIds' for persistence.
      // If store is empty (first run or cleared), maybe auto-dock pinned groups?
      // For now, respect what's in store. If activeGroupId is set but not in loaded groups, clear it.
      if (activeGroupId && !mergedGroups.find(g => g.id === activeGroupId)) {
        setActiveGroup(null);
      }

      // If docked groups don't exist anymore, we might want to clean them up from store, 
      // but store persists IDs. UI will just filter them out naturally if we code Sidebar right.

    } catch (error: any) {
      console.error('Error fetching data:', error.message);
      alert('Error cargando datos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- EFFECTS ---
  // Handle Theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // --- ACTIONS (SUPABASE) ---

  const addGroup = async () => {
    const title = prompt('Nombre del nuevo grupo (ej. "Trabajo", "Ideas"):');
    if (!title || !session) return;

    try {
      const { data, error } = await supabase
        .from('groups')
        .insert([{
          name: title.slice(0, 15),
          user_id: session.user.id
        }])
        .select()
        .single();

      if (error) throw error;

      const newGroup: Group = {
        id: data.id,
        title: data.name,
        notes: [],
        user_id: data.user_id,
        is_pinned: false,
        last_accessed_at: new Date().toISOString()
      };

      setGroups([...groups, newGroup]);
      openGroup(newGroup.id); // Add to dock and activate

    } catch (error: any) {
      alert('Error al crear grupo: ' + error.message);
    }
  };

  const updateGroupTitle = async (groupId: string, newTitle: string) => {
    try {
      const { error } = await supabase
        .from('groups')
        .update({ name: newTitle })
        .eq('id', groupId);

      if (error) throw error;

      setGroups(groups.map(g => g.id === groupId ? { ...g, title: newTitle } : g));

    } catch (error: any) {
      console.error('Error updating group:', error.message);
    }
  }

  const deleteGroup = async (groupId: string) => {
    if (groups.length <= 1) {
      alert("Debes mantener al menos un grupo.");
      return;
    }
    if (confirm("¿Estás seguro? Todas las notas de este grupo se perderán.")) {
      try {
        const { error } = await supabase
          .from('groups')
          .delete()
          .eq('id', groupId);

        if (error) throw error;

        const remaining = groups.filter(g => g.id !== groupId);
        setGroups(remaining);
        if (activeGroupId === groupId) {
          setActiveGroup(remaining[0]?.id || null);
        }

      } catch (error: any) {
        alert('Error al eliminar grupo: ' + error.message);
      }
    }
  }

  const toggleGroupPin = async (groupId: string, currentPinStatus: boolean) => {
    const newStatus = !currentPinStatus;

    // Optimistic Update
    setGroups(groups.map(g =>
      g.id === groupId ? { ...g, is_pinned: newStatus } : g
    ));

    try {
      const { error } = await supabase
        .from('groups')
        .update({ is_pinned: newStatus })
        .eq('id', groupId);

      if (error) throw error;

    } catch (error: any) {
      console.error('Error updating pin status:', error.message);
      // Revert optimization on error
      setGroups(groups.map(g =>
        g.id === groupId ? { ...g, is_pinned: currentPinStatus } : g
      ));
      alert('Error al actualizar pin: ' + error.message);
    }
  };

  const handleStartEdit = () => {
    if (activeGroup) {
      setTempGroupName(activeGroup.title);
      setIsEditingGroup(true);
    }
  };

  const handleSaveGroup = async () => {
    if (activeGroup && tempGroupName.trim()) {
      await updateGroupTitle(activeGroup.id, tempGroupName);
      setIsEditingGroup(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingGroup(false);
    setTempGroupName('');
  };

  const addNote = async () => {
    if (!activeGroupId || !session) return;

    try {
      // Find current notes count to set position (simple append)
      const currentGroup = groups.find(g => g.id === activeGroupId);
      const position = currentGroup ? currentGroup.notes.length : 0;

      const { data, error } = await supabase
        .from('notes')
        .insert([{
          title: '', // Empty title to trigger auto-edit
          content: '',
          group_id: activeGroupId,
          user_id: session.user.id,
          position: position
        }])
        .select()
        .single();

      if (error) throw error;

      const newNote: Note = {
        id: data.id,
        title: data.title,
        content: data.content || '',
        isOpen: true,
        created_at: data.created_at,
        group_id: data.group_id,
        position: data.position
      };

      setGroups(groups.map(g => {
        if (g.id === activeGroupId) {
          return { ...g, notes: [newNote, ...g.notes] };
        }
        return g;
      }));

      // AUTO-OPEN ACCORDION TO PREVENT "LOST IN LIST"
      toggleNote(activeGroupId, newNote.id);

      // FREEZE: Set as editing so it doesn't jump immediately if sorted by date/alpha
      setEditingNoteId(newNote.id);

    } catch (error: any) {
      alert('Error al crear nota: ' + error.message);
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase.from('notes').delete().eq('id', noteId);
      if (error) throw error;

      setGroups(currentGroups => currentGroups.map(g => ({
        ...g,
        notes: g.notes.filter(n => n.id !== noteId)
      })));
    } catch (error: any) {
      console.error('Error deleting note:', error.message);
    }
  };

  const updateNote = async (noteId: string, updates: Partial<Note>) => {
    // Optimistic update
    setGroups(currentGroups => currentGroups.map(g => ({
      ...g,
      notes: g.notes.map(n => n.id === noteId ? { ...n, ...updates } : n)
        // Re-sort immediately for optimistic UI feedback
        .sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) {
            return a.is_pinned ? -1 : 1;
          }
          return a.title.localeCompare(b.title);
        })
    })));

    // Debounce or immediate? For simplicity, immediate, but catch errors.
    // We only send specific fields to DB
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.is_pinned !== undefined) dbUpdates.is_pinned = updates.is_pinned;

    // Always update updated_at if we are changing content or title
    if (updates.title !== undefined || updates.content !== undefined) {
      dbUpdates.updated_at = new Date().toISOString();
      // Update local state too
      setGroups(currentGroups => currentGroups.map(g => ({
        ...g,
        notes: g.notes.map(n => n.id === noteId ? { ...n, updated_at: dbUpdates.updated_at } : n)
      })));
    }

    if (Object.keys(dbUpdates).length === 0) return;

    try {
      const { error } = await supabase.from('notes').update(dbUpdates).eq('id', noteId);
      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating note:', error.message);
      // Revert? (Too complex for now, assume success)
      alert('Error saving changes: ' + error.message);
    }
  };

  // Store-based toggle
  // const toggleNote = (noteId: string) => ... // Now using store напрямую
  const { toggleNote } = useUIStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setGroups([]);
  }

  // --- RENDER ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-500">
        <Loader2 className="animate-spin mr-2" /> Cargando...
      </div>
    )
  }

  if (!session) {
    return <Auth />;
  }

  const activeGroup = groups.find(g => g.id === activeGroupId);

  const filteredNotes = activeGroup
    ? activeGroup.notes
      .filter(n =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        // FREEZE LOGIC: If a note is being edited (or just created), keep it at the top (below pins) 
        // or just prioritize it? 
        // User said: "exclúyela temporalmente del ordenamiento estricto o fuérzala a estar visible".
        // Let's force it to be second only to pins (or even above pins if we want strict visibility).
        // Let's stick to: Pins -> Edited Note -> Rest (Rest sorted by mode).

        const isAEditing = a.id === editingNoteId;
        const isBEditing = b.id === editingNoteId;

        // Priority 0: Edited Note (Freeze it high up)
        if (isAEditing && !isBEditing) return -1;
        if (!isAEditing && isBEditing) return 1;

        // Priority 1: Pinned
        if (a.is_pinned !== b.is_pinned) {
          return a.is_pinned ? -1 : 1;
        }

        // Priority 2: Sort Mode
        switch (noteSortMode) {
          case 'date-desc':
            // Strict millisecond sort
            return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
          case 'date-asc':
            return new Date(a.updated_at || a.created_at || 0).getTime() - new Date(b.updated_at || b.created_at || 0).getTime();
          case 'alpha-asc':
            return a.title.localeCompare(b.title);
          case 'alpha-desc':
            return b.title.localeCompare(a.title);
          default:
            return 0;
        }
      })
    : [];

  const handleUpdateNoteWrapper = (noteId: string, updates: Partial<Note>) => {
    // If we are saving content (which implies exiting edit mode mostly), we might clear editingNoteId?
    // Actually, user said: "exclúyela... HASTA que el usuario presione el botón verde de "Guardar Contenido"."
    // So checking if 'content' is being updated is a good signal.
    if (updates.content !== undefined) {
      setEditingNoteId(null);
    }
    updateNote(noteId, updates);
  };

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden transition-colors duration-300">

      {/* Sidebar */}
      <Sidebar
        groups={groups}
        activeGroupId={activeGroupId}
        onSelectGroup={setActiveGroup}
        onAddGroup={addGroup}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onTogglePin={toggleGroupPin}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">

        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              {/* Group Title */}
              <div className="flex-1 flex items-center">
                {activeGroup ? (
                  isEditingGroup ? (
                    <div className="flex items-center gap-2 w-full max-w-md animate-fadeIn">
                      <input
                        type="text"
                        value={tempGroupName}
                        onChange={(e) => setTempGroupName(e.target.value)}
                        className="flex-1 text-xl font-bold text-zinc-800 dark:text-white bg-white dark:bg-zinc-800 border-2 border-zinc-500 dark:border-zinc-400 rounded-lg px-3 py-1 focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveGroup();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                      />
                    </div>
                  ) : (
                    <div>
                      <h1 className="text-xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                        {activeGroup.title}
                      </h1>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                        {activeGroup.notes.length || 0} Notas
                      </p>
                    </div>
                  )
                ) : (
                  <h1 className="text-xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                    Selecciona un Grupo
                  </h1>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleLogout}
                className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs mr-2 font-medium"
                title="Cerrar Sessión"
              >
                Salir
              </button>

              {activeGroup && (
                <>
                  {isEditingGroup ? (
                    <div className="flex items-center gap-1 mr-2 animate-fadeIn">
                      <button
                        onClick={handleSaveGroup}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-colors"
                        title="Guardar Nombre"
                      >
                        <Check size={20} />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                        title="Cancelar"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mr-2">
                      <button
                        onClick={handleStartEdit}
                        className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                        title="Renombrar Grupo"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => deleteGroup(activeGroup.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                        title="Eliminar Grupo"
                      >
                        <Loader2 size={18} className="hidden" /> {/* Hidden loader just to use the import if needed, or remove import */}
                        {/* Actually we just use trash icon usually, but code had "Eliminar Grupo" text button before. Let's switch to Icon for cleaner UI next to Edit? 
                              User req: "Agrega un botón de Editar... al lado del botón de eliminar".
                              Original was text button. I will make them both icons or both text? 
                              Plan said: "Replace Edit/Delete buttons with Save/Cancel".
                              Let's keep the Delete button as it was (Text) or make it an Icon for consistency? 
                              The user asked for a "pencil icon". Usually icons go with icons. 
                              Let's make Delete an Icon too for better UI, or keep it text. 
                              Original: <button ...>Eliminar Grupo</button>
                              New Plan: Icon for Edit.
                              Refining: I will make a Trash icon for Delete to match the Pencil.
                              Correction: User said "Agrega un botón... al lado del botón de eliminar". I should respect existing if possible, but Icon is better.
                              I'll use Trash2 (need import detailed). Or just keep text?
                              Let's stick to the prompt: input text and Save/Cancel buttons.
                              Ill use icons for Edit/Delete in view mode for a cleaner header.
                          */}
                        <span className="text-xs font-semibold">Eliminar</span>
                      </button>
                    </div>
                  )}
                </>
              )}
              <button
                onClick={addNote}
                disabled={!activeGroup}
                className="flex items-center gap-2 bg-[#1F3760] hover:bg-[#152643] text-white px-4 py-2 rounded-lg font-medium transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-[#1F3760]/50"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Agregar Nota</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Note Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-4xl mx-auto pb-20">
            {activeGroup ? (
              <>
                {/* Search Bar */}
                <div className="mb-8 relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={18} className="text-zinc-400 group-focus-within:text-zinc-500 dark:group-focus-within:text-zinc-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder={`Buscar en ${activeGroup.title}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl leading-5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 transition-all shadow-sm"
                  />
                </div>

                {/* Sorting Toolbar */}
                <div className="flex items-center justify-end gap-2 mb-4 animate-fadeIn">
                  <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider mr-2">Ordenar por:</span>

                  <button
                    onClick={() => setNoteSortMode(noteSortMode === 'date-desc' ? 'date-asc' : 'date-desc')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${noteSortMode.includes('date')
                      ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                  >
                    <Calendar size={14} />
                    Fecha
                    {noteSortMode === 'date-desc' && <ArrowDown size={12} />}
                    {noteSortMode === 'date-asc' && <ArrowUp size={12} />}
                  </button>

                  <button
                    onClick={() => setNoteSortMode(noteSortMode === 'alpha-asc' ? 'alpha-desc' : 'alpha-asc')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${noteSortMode.includes('alpha')
                      ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                  >
                    <Type size={14} />
                    Nombre
                    {noteSortMode === 'alpha-asc' && <ArrowDown size={12} />}
                    {noteSortMode === 'alpha-desc' && <ArrowUp size={12} />}
                  </button>
                </div>

                {/* Notes */}
                <div className="space-y-4">
                  {filteredNotes.length === 0 ? (
                    <div className="text-center py-20 opacity-60">
                      <div className="inline-block p-4 rounded-full bg-zinc-200 dark:bg-zinc-800 mb-4">
                        <Search size={32} className="text-zinc-500 dark:text-zinc-400" />
                      </div>
                      <p className="text-lg text-zinc-600 dark:text-zinc-400">No se encontraron notas.</p>
                    </div>
                  ) : (
                    filteredNotes.map(note => {
                      const isOpen = (openNotesByGroup[activeGroup.id] || []).includes(note.id);
                      return (
                        <AccordionItem
                          key={note.id}
                          note={{ ...note, isOpen }}
                          onToggle={() => toggleNote(activeGroup.id, note.id)}
                          onUpdate={(id, updates) => handleUpdateNoteWrapper(id, updates)}
                          onDelete={deleteNote}
                        />
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                {groups.length === 0 ? (
                  <div className="text-center">
                    <p className="mb-4">No tienes grupos aún.</p>
                    <button onClick={addGroup} className="text-zinc-600 dark:text-zinc-400 hover:underline hover:text-zinc-900 dark:hover:text-white">Crear el primer grupo</button>
                  </div>
                ) : (
                  <p>Selecciona un grupo desde la barra lateral.</p>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsWindow
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
      />
    </div>
  );
}

export default App;