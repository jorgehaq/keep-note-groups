import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Loader2, Check, X, Calendar, ArrowUp, ArrowDown, Type, Trash2, Download, ArrowUpDown } from 'lucide-react';
import { Note, Group, Theme, NoteFont, Reminder } from './types';
import { AccordionItem } from './components/AccordionItem';
import { Sidebar } from './components/Sidebar';
import { SettingsWindow } from './components/SettingsWindow';
import { KanbanApp } from './components/KanbanApp';
import { TimeTrackerApp } from './components/TimeTrackerApp';
import { RemindersApp } from './components/RemindersApp';
import { BrainDumpApp } from './components/BrainDumpApp';
import { TranslatorApp } from './components/TranslatorApp';
import { supabase } from './src/lib/supabaseClient';
import { Auth } from './components/Auth';
import { Session } from '@supabase/supabase-js';
import { useUIStore } from './src/lib/store';

const sortNotesArray = (notes: Note[], mode: string) => {
  return [...notes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    switch (mode) {
      case 'date-desc': return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
      case 'date-asc': return new Date(a.updated_at || a.created_at || 0).getTime() - new Date(b.updated_at || b.created_at || 0).getTime();
      case 'alpha-asc': return (a.title || '').localeCompare(b.title || '');
      case 'alpha-desc': return (b.title || '').localeCompare(a.title || '');
      default: return 0;
    }
  });
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const hasLoadedOnce = React.useRef(false);
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({}); 

  const { activeGroupId, setActiveGroup, openNotesByGroup, openGroup, dockedGroupIds, noteSortMode, setNoteSortMode, toggleNote, globalView, setGlobalView, setKanbanCounts, setGlobalTasks } = useUIStore();
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const currentSearchQuery = activeGroupId ? (searchQueries[activeGroupId] || '') : '';
  const [searchExemptNoteIds, setSearchExemptNoteIds] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('app-theme-preference') as Theme) || 'dark');
  const [noteFont, setNoteFont] = useState<NoteFont>(() => (localStorage.getItem('app-note-font') as NoteFont) || 'sans');
  const [noteFontSize, setNoteFontSize] = useState<string>(() => localStorage.getItem('app-note-font-size') || 'medium');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [tempGroupName, setTempGroupName] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [overdueRemindersList, setOverdueRemindersList] = useState<{ id: string; title: string }[]>([]);

  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeGroupId && focusedNoteId) {
      const ag = groups.find(g => g.id === activeGroupId);
      if (!ag?.notes.find(n => n.id === focusedNoteId)) {
        setFocusedNoteId(null);
      }
    }
  }, [activeGroupId, focusedNoteId, groups]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchData();
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && !hasLoadedOnce.current) {
        setSession(session);
        fetchData();
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setGroups([]);
        hasLoadedOnce.current = false;
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const { setOverdueRemindersCount, setImminentRemindersCount } = useUIStore();
  useEffect(() => {
    if (!session) return;
    const checkReminders = async () => {
      const { data } = await supabase.from('reminders').select('id, title, due_at').eq('is_completed', false);
      if (!data) return;
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const overdue = data.filter(r => new Date(r.due_at) <= now);
      const imminent = data.filter(r => {
        const d = new Date(r.due_at);
        return d > now && d <= in24h;
      });
      setOverdueRemindersCount(overdue.length);
      setImminentRemindersCount(imminent.length);
      setOverdueRemindersList(overdue.map(r => ({ id: r.id, title: r.title })));
    };
    checkReminders();
    const interval = setInterval(checkReminders, 30000);
    return () => clearInterval(interval);
  }, [session, setOverdueRemindersCount, setImminentRemindersCount]);

  const { setActiveTimersCount } = useUIStore();
  useEffect(() => {
    if (!session) return;
    const checkTimers = async () => {
      const { count } = await supabase.from('timers').select('id', { count: 'exact', head: true }).eq('status', 'running');
      setActiveTimersCount(count ?? 0);
    };
    checkTimers();
    const interval = setInterval(checkTimers, 30000);
    return () => clearInterval(interval);
  }, [session, setActiveTimersCount]);

  useEffect(() => {
    if (!session) return;
    const checkKanbanTasks = async () => {
      const { data } = await supabase.from('tasks').select('status');
      if (data) {
        const todo = data.filter(t => t.status === 'todo').length;
        const inProgress = data.filter(t => t.status === 'in_progress').length;
        const done = data.filter(t => t.status === 'done').length;
        setKanbanCounts(todo, inProgress, done);
      }
    };
    checkKanbanTasks();
    const handleKanbanUpdate = () => checkKanbanTasks();
    window.addEventListener('kanban-updated', handleKanbanUpdate);
    const interval = setInterval(checkKanbanTasks, 30000);
    return () => {
      window.removeEventListener('kanban-updated', handleKanbanUpdate);
      clearInterval(interval);
    };
  }, [session, setKanbanCounts]);

  useEffect(() => {
    if (!session) return;
    const fetchGlobalTasks = async () => {
      const { data } = await supabase.from('tasks').select('*');
      if (data) setGlobalTasks(data);
    };

    fetchGlobalTasks();
    
    window.addEventListener('kanban-updated', fetchGlobalTasks);
    return () => window.removeEventListener('kanban-updated', fetchGlobalTasks);
  }, [session, setGlobalTasks]);

  useEffect(() => {
    const handleReload = () => fetchData();
    window.addEventListener('reload-app-data', handleReload);
    return () => window.removeEventListener('reload-app-data', handleReload);
  }, []);

  const fetchData = async () => {
    if (!hasLoadedOnce.current) setLoading(true);
    try {
      const { data: groupsData, error: groupsError } = await supabase.from('groups').select('*').order('created_at', { ascending: true });
      if (groupsError) throw groupsError;

      const { data: notesData, error: notesError } = await supabase.from('notes').select('*').order('position', { ascending: true });
      if (notesError) throw notesError;

      const currentSortPref = useUIStore.getState().noteSortMode;

      const mergedGroups: Group[] = (groupsData || []).map(g => {
        let groupNotes: Note[] = (notesData || []).filter(n => n.group_id === g.id).map(n => ({ ...n, isOpen: false }));
        groupNotes = sortNotesArray(groupNotes, currentSortPref);

        return {
          id: g.id,
          title: g.name,
          user_id: g.user_id,
          is_pinned: g.is_pinned,
          last_accessed_at: g.last_accessed_at,
          notes: groupNotes
        };
      });

      setGroups(mergedGroups);
      hasLoadedOnce.current = true;

      if (activeGroupId && !mergedGroups.find(g => g.id === activeGroupId)) {
        setActiveGroup(null);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error.message);
      alert('Error cargando datos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

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

  const applyManualSort = (mode: 'date-desc' | 'date-asc' | 'alpha-asc' | 'alpha-desc') => {
    setNoteSortMode(mode);
    setIsSortMenuOpen(false);

    if (!activeGroupId) return;

    // 🚀 FIX: setTimeout de 50ms rompe la condición de carrera.
    // Garantiza que si el usuario da clic al ordenamiento mientras edita un título,
    // el onBlur (guardado) termine de inyectar el título en el estado ANTES de ordenar.
    setTimeout(() => {
        setGroups(prev => prev.map(g => {
            if (g.id === activeGroupId) {
                return { ...g, notes: sortNotesArray(g.notes, mode) };
            }
            return g;
        }));
    }, 50);
  };

  const addGroup = async () => {
    const title = prompt('Nombre del nuevo grupo (ej. "Trabajo", "Ideas"):');
    if (!title || !session) return;
    try {
      const { data, error } = await supabase.from('groups').insert([{ name: title.slice(0, 15), user_id: session.user.id }]).select().single();
      if (error) throw error;
      const newGroup: Group = { id: data.id, title: data.name, notes: [], user_id: data.user_id, is_pinned: false, last_accessed_at: new Date().toISOString() };
      setGroups([...groups, newGroup]);
      openGroup(newGroup.id);
    } catch (error: any) {
      alert('Error al crear grupo: ' + error.message);
    }
  };

  const updateGroupTitle = async (groupId: string, newTitle: string) => {
    try {
      const { error } = await supabase.from('groups').update({ name: newTitle }).eq('id', groupId);
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
        const { error } = await supabase.from('groups').delete().eq('id', groupId);
        if (error) throw error;
        const remaining = groups.filter(g => g.id !== groupId);
        setGroups(remaining);
        if (activeGroupId === groupId) setActiveGroup(remaining[0]?.id || null);
      } catch (error: any) {
        alert('Error al eliminar grupo: ' + error.message);
      }
    }
  }

  const toggleGroupPin = async (groupId: string, currentPinStatus: boolean) => {
    const newStatus = !currentPinStatus;
    setGroups(groups.map(g => g.id === groupId ? { ...g, is_pinned: newStatus } : g));
    try {
      const { error } = await supabase.from('groups').update({ is_pinned: newStatus }).eq('id', groupId);
      if (error) throw error;
    } catch (error: any) {
      setGroups(groups.map(g => g.id === groupId ? { ...g, is_pinned: currentPinStatus } : g));
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
      const currentGroup = groups.find(g => g.id === activeGroupId);
      const position = currentGroup ? currentGroup.notes.length : 0;
      const { data, error } = await supabase.from('notes').insert([{ title: '', content: '', group_id: activeGroupId, user_id: session.user.id, position }]).select().single();
      if (error) throw error;

      const newNote: Note = { id: data.id, title: data.title, content: data.content || '', isOpen: true, created_at: data.created_at, group_id: data.group_id, position: data.position };

      setGroups(groups.map(g => {
        if (g.id === activeGroupId) {
          return { ...g, notes: [newNote, ...g.notes] };
        }
        return g;
      }));

      toggleNote(activeGroupId, newNote.id);
      setEditingNoteId(newNote.id);

      if (currentSearchQuery.trim()) {
        setSearchExemptNoteIds(prev => new Set(prev).add(newNote.id));
      }
    } catch (error: any) {
      alert('Error al crear nota: ' + error.message);
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase.from('notes').delete().eq('id', noteId);
      if (error) throw error;
      setGroups(currentGroups => currentGroups.map(g => ({ ...g, notes: g.notes.filter(n => n.id !== noteId) })));
    } catch (error: any) {
      console.error('Error deleting note:', error.message);
    }
  };

  const updateNote = async (noteId: string, updates: Partial<Note>) => {
    const shouldPreserveScroll = updates.is_pinned !== undefined;
    const savedScrollTop = shouldPreserveScroll ? mainRef.current?.scrollTop : undefined;

    setGroups(currentGroups => currentGroups.map(g => {
      const updatedNotes = g.notes.map(n => n.id === noteId ? { ...n, ...updates } : n);
      if (updates.is_pinned !== undefined) {
        updatedNotes.sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
          return 0; 
        });
      }
      return { ...g, notes: updatedNotes };
    }));

    if (shouldPreserveScroll && savedScrollTop !== undefined) {
      requestAnimationFrame(() => {
        if (mainRef.current) mainRef.current.scrollTop = savedScrollTop;
      });
    }

    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.is_pinned !== undefined) dbUpdates.is_pinned = updates.is_pinned;
    if (updates.is_docked !== undefined) dbUpdates.is_docked = updates.is_docked;
    if (updates.is_checklist !== undefined) dbUpdates.is_checklist = updates.is_checklist;

    if (updates.title !== undefined || updates.content !== undefined) {
      dbUpdates.updated_at = new Date().toISOString();
      setGroups(currentGroups => currentGroups.map(g => ({
        ...g,
        notes: g.notes.map(n => n.id === noteId ? { ...n, updated_at: dbUpdates.updated_at } : n)
      })));
    }

    if (Object.keys(dbUpdates).length === 0) return;

    const isTextUpdate = updates.content !== undefined || updates.title !== undefined;
    const debounceTime = isTextUpdate ? 2000 : 0; 

    if (saveTimeoutRef.current[noteId]) {
      clearTimeout(saveTimeoutRef.current[noteId]);
    }

    saveTimeoutRef.current[noteId] = setTimeout(async () => {
      try {
        const { error } = await supabase.from('notes').update(dbUpdates).eq('id', noteId);
        if (error) throw error;
        
        // Sincronización dual hacia Kanban
        if (dbUpdates.title !== undefined) {
            await supabase.from('tasks')
                .update({ title: dbUpdates.title })
                .eq('id', noteId);
            
            window.dispatchEvent(new CustomEvent('kanban-refetch'));
        }
      } catch (error: any) {
        console.error('Error updating note:', error.message);
      } finally {
        delete saveTimeoutRef.current[noteId];
      }
    }, debounceTime);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setGroups([]);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-500">
        <Loader2 className="animate-spin mr-2" /> Cargando...
      </div>
    )
  }

  if (!session) return <Auth />;

  const activeGroup = groups.find(g => g.id === activeGroupId);

  const filteredNotes = activeGroup
    ? focusedNoteId
      ? activeGroup.notes.filter(n => n.id === focusedNoteId)
      : activeGroup.notes.filter(n => {
          const isNewOrEditing = n.title.trim() === '' || n.id === editingNoteId || searchExemptNoteIds.has(n.id);
          if (isNewOrEditing) return true;
          const matchesSearch = n.title.toLowerCase().includes(currentSearchQuery.toLowerCase()) ||
            n.content.toLowerCase().includes(currentSearchQuery.toLowerCase());
          return matchesSearch;
        })
    : [];

  const handleUpdateNoteWrapper = (noteId: string, updates: Partial<Note>) => {
    // 🚀 FIX: Liberar completamente el estado "amarrado" de la nota
    // tanto si se edita el contenido COMO si se edita el título.
    if (updates.content !== undefined || updates.title !== undefined) {
        setEditingNoteId(null);
    }
    updateNote(noteId, updates);
  };

  const downloadGroupAsMarkdown = () => {
    if (!activeGroup) return;
    const sortedNotes = [...activeGroup.notes].sort((a, b) => {
      const titleA = a.title || 'Sin título';
      const titleB = b.title || 'Sin título';
      return titleA.localeCompare(titleB);
    });

    const formatNoteDate = (dateString?: string) => {
      if (!dateString) return 'Desconocida';
      return new Date(dateString).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const mdContent = sortedNotes.map(note => {
      return `titulo: ${note.title || 'Sin título'}\nfecha creacion: ${formatNoteDate(note.created_at)}\nfecha ultima edicion: ${formatNoteDate(note.updated_at || note.created_at)}\ncontenido de la nota:\n${note.content || ''}`;
    }).join('\n\n---\n\n');

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeGroup.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden transition-colors duration-300">
      <Sidebar
        groups={groups}
        activeGroupId={activeGroupId}
        onSelectGroup={(id) => { setActiveGroup(id); setFocusedNoteId(null); }}
        onAddGroup={addGroup}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onTogglePin={toggleGroupPin}
        onLogout={handleLogout}
        onSelectDockedNote={(groupId, noteId) => {
          setActiveGroup(groupId);
          setGlobalView('notes');
          const currentOpen = openNotesByGroup[groupId] || [];
          if (!currentOpen.includes(noteId)) toggleNote(groupId, noteId);
          setFocusedNoteId(noteId);
        }}
        focusedNoteId={focusedNoteId}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {overdueRemindersList.length > 0 && (
          <div className="relative w-full z-50 shrink-0 shadow-md bg-red-500 text-white">
            <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col gap-2">
              {overdueRemindersList.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                    <span className="text-sm font-medium truncate">⚠️ Recordatorio pendiente: {r.title}</span>
                  </div>
                  <button
                    onClick={async () => {
                      setOverdueRemindersList(prev => prev.filter(x => x.id !== r.id));
                      setOverdueRemindersCount(Math.max(0, overdueRemindersList.length - 1));
                      await supabase.from('reminders').update({ is_completed: true }).eq('id', r.id);
                    }}
                    className="shrink-0 px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Marcar como Listo
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {globalView === 'kanban' ? (
          <KanbanApp 
            groups={groups} 
            onOpenNote={async (groupId, noteId) => {
              // 1. ZUSTAND: Ancla el grupo y cambia a la vista de notas
              openGroup(groupId);
              setGlobalView('notes');
              
              // 2. UX FIX: Forzamos null para evitar el "Focus Mode". 
              // Esto garantiza que el Grupo en el Sidebar se pinte AZUL.
              setFocusedNoteId(null); 
              
              // 3. UX: Abre el acordeón de la nota si estaba cerrado
              const currentOpen = openNotesByGroup[groupId] || [];
              if (!currentOpen.includes(noteId)) {
                toggleNote(groupId, noteId);
              }

              // 4. DOM: Hacemos scroll suave hasta la nota para no perderla de vista
              setTimeout(() => {
                const noteElement = document.getElementById(`note-${noteId}`);
                if (noteElement) {
                  noteElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }, 150); // Pequeño delay para permitir que el DOM renderice el cambio de vista

              // 5. SUPABASE: Actualizamos el timestamp para "Recientes"
              try {
                await supabase
                  .from('groups')
                  .update({ last_accessed_at: new Date().toISOString() })
                  .eq('id', groupId);
              } catch (e) {
                console.error("No se pudo actualizar el last_accessed_at", e);
              }
            }} 
          />
        ) :
         globalView === 'timers' ? <TimeTrackerApp session={session!} /> :
         globalView === 'reminders' ? <RemindersApp session={session!} /> :
         globalView === 'braindump' ? <BrainDumpApp session={session!} noteFont={noteFont} noteFontSize={noteFontSize} /> :
         globalView === 'translator' ? <TranslatorApp session={session!} /> : (
          <>
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
              <div className="max-w-4xl mx-auto px-4 md:px-6 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">

                <div className="flex items-center gap-2 min-w-0 flex-shrink">
                  {activeGroup ? (
                    isEditingGroup ? (
                      <div className="flex items-center gap-1.5 animate-fadeIn">
                        <input
                          type="text"
                          value={tempGroupName}
                          onChange={(e) => setTempGroupName(e.target.value)}
                          className="text-lg font-bold text-zinc-800 dark:text-white bg-white dark:bg-zinc-800 border-2 border-zinc-500 dark:border-zinc-400 rounded-lg px-2 py-0.5 focus:outline-none w-40 md:w-56"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGroup(); if (e.key === 'Escape') handleCancelEdit(); }}
                          onBlur={handleSaveGroup}
                        />
                        <button onClick={handleCancelEdit} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors" title="Cancelar"><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <h1 className="text-lg font-bold text-zinc-800 dark:text-white truncate cursor-pointer hover:underline decoration-zinc-400 decoration-dashed underline-offset-4 transition-colors" onDoubleClick={handleStartEdit} title="Doble clic para editar">
                          {activeGroup.title}
                        </h1>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">{activeGroup.notes.length || 0} Notas</p>
                      </div>
                    )
                  ) : <h1 className="text-lg font-bold text-zinc-800 dark:text-white">Selecciona un Grupo</h1>}
                </div>

                {activeGroup && (
                  <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                    <div className="relative flex items-center transition-all duration-300">
                      <Search size={15} className={`absolute left-2 pointer-events-none transition-colors ${currentSearchQuery.trim() ? 'text-amber-600 dark:text-amber-500 font-bold' : 'text-zinc-400'}`} />
                      <input
                        type="text"
                        placeholder={activeGroup ? `Buscar en ${activeGroup.title}...` : "Buscar..."}
                        value={currentSearchQuery}
                        onChange={(e) => {
                          if (activeGroupId) setSearchQueries(prev => ({ ...prev, [activeGroupId]: e.target.value }));
                          setSearchExemptNoteIds(new Set());
                          if (focusedNoteId) setFocusedNoteId(null);
                        }}
                        className={`w-full sm:w-48 pl-7 pr-8 py-1.5 text-xs rounded-lg border transition-all focus:outline-none ${currentSearchQuery.trim() ? 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 font-semibold placeholder-amber-700/50 dark:placeholder-amber-400/50 sm:w-56' : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-1 focus:ring-zinc-400/30'}`}
                      />
                      {currentSearchQuery.trim() && (
                        <button onClick={() => { if (activeGroupId) setSearchQueries(prev => ({ ...prev, [activeGroupId]: '' })); setSearchExemptNoteIds(new Set()); }} className="absolute right-2 p-0.5 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 bg-amber-200/50 dark:bg-amber-800/50 hover:bg-amber-300/50 dark:hover:bg-amber-700/50 rounded-full transition-colors" title="Limpiar búsqueda">
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div className="hidden sm:block w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-0.5"></div>

                    <div className="relative" ref={sortMenuRef}>
                      <button
                        onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                        className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 ${isSortMenuOpen ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                        title="Ordenar Notas"
                      >
                        <ArrowUpDown size={15} />
                      </button>

                      {isSortMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-zinc-800 shadow-xl rounded-xl border border-zinc-200 dark:border-zinc-700 p-1.5 flex flex-col gap-0.5 min-w-[200px] animate-fadeIn">
                          <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 border-b border-zinc-100 dark:border-zinc-700">Ordenar por</div>
                          
                          <button onClick={() => applyManualSort('date-desc')} className={`flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg transition-colors ${noteSortMode === 'date-desc' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium'}`}>
                            <Calendar size={14} /> Fecha (Recientes)
                            {noteSortMode === 'date-desc' && <Check size={14} className="ml-auto" />}
                          </button>
                          
                          <button onClick={() => applyManualSort('date-asc')} className={`flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg transition-colors ${noteSortMode === 'date-asc' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium'}`}>
                            <Calendar size={14} /> Fecha (Antiguos)
                            {noteSortMode === 'date-asc' && <Check size={14} className="ml-auto" />}
                          </button>
                          
                          <button onClick={() => applyManualSort('alpha-asc')} className={`flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg transition-colors ${noteSortMode === 'alpha-asc' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium'}`}>
                            <Type size={14} /> Nombre (A-Z)
                            {noteSortMode === 'alpha-asc' && <Check size={14} className="ml-auto" />}
                          </button>
                          
                          <button onClick={() => applyManualSort('alpha-desc')} className={`flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg transition-colors ${noteSortMode === 'alpha-desc' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium'}`}>
                            <Type size={14} /> Nombre (Z-A)
                            {noteSortMode === 'alpha-desc' && <Check size={14} className="ml-auto" />}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="hidden sm:block w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-0.5"></div>

                    {!isEditingGroup && (
                      <button onClick={downloadGroupAsMarkdown} className="p-1.5 text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors" title="Exportar notas a Markdown">
                        <Download size={15} />
                      </button>
                    )}
                    {!isEditingGroup && (
                      <button onClick={() => deleteGroup(activeGroup.id)} className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Eliminar Grupo">
                        <Trash2 size={15} />
                      </button>
                    )}
                    <button onClick={addNote} className="w-8 h-8 flex items-center justify-center bg-[#1F3760] hover:bg-[#152643] text-white rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95 focus:ring-2 focus:ring-[#1F3760]/50" title="Agregar Nota">
                      <Plus size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <main ref={mainRef} className="flex-1 overflow-y-auto hidden-scrollbar p-4 md:p-8">
              <div className="max-w-4xl mx-auto pb-20">
                {activeGroup ? (
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
                          <div key={note.id} id={`note-${note.id}`}>
                            <AccordionItem
                              note={{ ...note, isOpen }}
                              onToggle={() => toggleNote(activeGroup.id, note.id)}
                              onUpdate={(id, updates) => handleUpdateNoteWrapper(id, updates)}
                              onDelete={deleteNote}
                              searchQuery={currentSearchQuery}
                              noteFont={noteFont}
                              noteFontSize={noteFontSize}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                    {groups.length === 0 ? (
                      <div className="text-center">
                        <p className="mb-4">No tienes grupos aún.</p>
                        <button onClick={addGroup} className="text-zinc-600 dark:text-zinc-400 hover:underline hover:text-zinc-900 dark:hover:text-white">Crear el primer grupo</button>
                      </div>
                    ) : <p>Selecciona un grupo desde la barra lateral.</p>}
                  </div>
                )}
              </div>
            </main>
          </>
        )}
      </div>

      <SettingsWindow
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={(t: Theme) => { setTheme(t); localStorage.setItem('app-theme-preference', t); }}
        noteFont={noteFont}
        onNoteFontChange={(f: NoteFont) => { setNoteFont(f); localStorage.setItem('app-note-font', f); }}
        noteFontSize={noteFontSize}
        onNoteFontSizeChange={(s: string) => { setNoteFontSize(s); localStorage.setItem('app-note-font-size', s); }}
      />
    </div>
  );
}

export default App;