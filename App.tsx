import React, { useState, useEffect } from 'react';
import { Plus, Search, Menu, Loader2, Edit2, Check, X } from 'lucide-react';
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
  const { activeGroupId, setActiveGroup, openNotesByGroup, setOpenNote } = useUIStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<Theme>('dark');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // --- EDIT GROUP STATE ---
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [tempGroupName, setTempGroupName] = useState('');

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
        .order('position', { ascending: true });

      if (notesError) throw notesError;

      // Transform and merge
      // Map DB 'name' to UI 'title' for groups
      const mergedGroups: Group[] = (groupsData || []).map(g => ({
        id: g.id,
        title: g.name, // Map DB column 'name' to UI property 'title'
        user_id: g.user_id,
        notes: (notesData || [])
          .filter(n => n.group_id === g.id)
          .map(n => ({
            ...n,
            isOpen: false // Default state for UI
          }))
      }));

      setGroups(mergedGroups);

      // Restore active group if possible, else select first
      if (mergedGroups.length > 0) {
        if (!activeGroupId) {
          // Nothing selected, select first
          setActiveGroup(mergedGroups[0].id);
        } else {
          // Verify if the selected group still exists
          if (!mergedGroups.find(g => g.id === activeGroupId)) {
            setActiveGroup(mergedGroups[0].id);
          }
          // If it exists, do nothing (keep persistence)
        }
      }

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
        user_id: data.user_id
      };

      setGroups([...groups, newGroup]);
      setActiveGroup(newGroup.id);

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
          title: 'Nueva Nota',
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
          return { ...g, notes: [newNote, ...g.notes] }; // Prepend locally for visibility, or append based on sort?
          // The fetch sorts by position ascending. If we append locally, we match "creation order".
          // Logic in original app was prepend: [newNote, ...g.notes]. 
          // Let's stick to prepend for UI feedback, but position might need handling if we want strict order.
          // For now, simple insert is fine.
        }
        return g;
      }));

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
    })));

    // Debounce or immediate? For simplicity, immediate, but catch errors.
    // We only send specific fields to DB
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    // isOpen is local-only usually, unless we add is_open column.
    // User schema usually didn't have is_open in the simplified version provided in chat?
    // Chat schema: id, user_id, group_id, title, content, position, created_at.
    // NO is_open in DB. So we do NOT persist isOpen.

    if (Object.keys(dbUpdates).length === 0) return;

    try {
      const { error } = await supabase.from('notes').update(dbUpdates).eq('id', noteId);
      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating note:', error.message);
      // Revert? (Too complex for now, assume success)
    }
  };

  // Store-based toggle
  const toggleNote = (noteId: string) => {
    if (!activeGroupId) return;

    // Check if currently open
    const currentOpenNoteId = openNotesByGroup[activeGroupId];
    const newOpenNoteId = currentOpenNoteId === noteId ? null : noteId;

    setOpenNote(activeGroupId, newOpenNoteId);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setGroups([]);
  }

  // --- RENDER ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950 text-slate-500">
        <Loader2 className="animate-spin mr-2" /> Cargando...
      </div>
    )
  }

  if (!session) {
    return <Auth />;
  }

  const activeGroup = groups.find(g => g.id === activeGroupId);

  const filteredNotes = activeGroup
    ? activeGroup.notes.filter(n =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : [];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">

      {/* Sidebar */}
      <Sidebar
        groups={groups}
        activeGroupId={activeGroupId}
        onSelectGroup={setActiveGroup}
        onAddGroup={addGroup}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">

        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
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
                        className="flex-1 text-xl font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-800 border-2 border-indigo-500 rounded-lg px-3 py-1 focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveGroup();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                      />
                    </div>
                  ) : (
                    <div>
                      <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        {activeGroup.title}
                      </h1>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {activeGroup.notes.length || 0} Notas
                      </p>
                    </div>
                  )
                ) : (
                  <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    Selecciona un Grupo
                  </h1>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-indigo-500 text-xs mr-2 font-medium"
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
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                        title="Cancelar"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mr-2">
                      <button
                        onClick={handleStartEdit}
                        className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full transition-colors"
                        title="Renombrar Grupo"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => deleteGroup(activeGroup.id)}
                        className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
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
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <Search size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder={`Buscar en ${activeGroup.title}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-4">
                  {filteredNotes.length === 0 ? (
                    <div className="text-center py-20 opacity-60">
                      <div className="inline-block p-4 rounded-full bg-slate-200 dark:bg-slate-800 mb-4">
                        <Search size={32} className="text-slate-500 dark:text-slate-400" />
                      </div>
                      <p className="text-lg text-slate-600 dark:text-slate-400">No se encontraron notas.</p>
                    </div>
                  ) : (
                    filteredNotes.map(note => {
                      const isOpen = openNotesByGroup[activeGroup.id] === note.id;
                      return (
                        <AccordionItem
                          key={note.id}
                          note={{ ...note, isOpen }}
                          onToggle={() => toggleNote(note.id)}
                          onUpdate={(id, updates) => updateNote(id, updates)}
                          onDelete={deleteNote}
                        />
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                {groups.length === 0 ? (
                  <div className="text-center">
                    <p className="mb-4">No tienes grupos aún.</p>
                    <button onClick={addGroup} className="text-indigo-500 hover:underline">Crear el primer grupo</button>
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