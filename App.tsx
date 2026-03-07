import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Loader2, Check, X, Calendar, ArrowUp, ArrowDown, Type, Trash2, Download, ArrowUpDown, Folder, StickyNote, Grid, Maximize2, Minimize2, ChevronsDownUp, Bell, Pin, PanelLeft } from 'lucide-react';
import { Note, Group, Theme, NoteFont, Reminder } from './types';
import { AccordionItem } from './components/AccordionItem';
import { Sidebar } from './components/Sidebar';
import { SettingsWindow } from './components/SettingsWindow';
import { KanbanApp } from './components/KanbanApp';
import { TimeTrackerApp } from './components/TimeTrackerApp';
import { RemindersApp } from './components/RemindersApp';
import { BrainDumpApp } from './components/BrainDumpApp';
import { TranslatorApp } from './components/TranslatorApp';
import { GroupLauncher } from './components/GroupLauncher';
import { supabase } from './src/lib/supabaseClient';
import { Auth } from './components/Auth';
import { Session } from '@supabase/supabase-js';
import { useUIStore } from './src/lib/store';

const sortNotesArray = (notes: Note[], mode: string) => {
  return [...notes].sort((a, b) => {
    // Normalizar is_pinned para que undefined/null se traten como false
    const pinA = !!a.is_pinned;
    const pinB = !!b.is_pinned;
    if (pinA !== pinB) return pinA ? -1 : 1;

    switch (mode) {
      case 'date-desc': {
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        return dateB - dateA;
      }
      case 'date-asc': {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        return dateA - dateB;
      }
      case 'alpha-asc': return (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
      case 'alpha-desc': return (b.title || '').toLowerCase().localeCompare((a.title || '').toLowerCase());
      default: return 0;
    }
  });
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const hasLoadedOnce = React.useRef(false);
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({}); 

  const { 
    activeGroupId, setActiveGroup, openNotesByGroup, openGroup, dockedGroupIds, 
    noteSortMode, setNoteSortMode, toggleNote, globalView, setGlobalView, 
    setKanbanCounts, globalTasks, setGlobalTasks, isMaximized, setIsMaximized,
    showOverdueMarquee, setShowOverdueMarquee,
    overdueRemindersCount, overdueRemindersList, setOverdueRemindersList, imminentRemindersCount, setOverdueRemindersCount, 
    setImminentRemindersCount,
    groups, setGroups, updateNoteSync, deleteNoteSync, updateGroupSync, deleteGroupSync,
    setTranslations, setBrainDumps,
    focusedNoteByGroup, setFocusedNoteId,
    noteTrayOpenByGroup, setIsGlobalNoteTrayOpen
  } = useUIStore();

  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(
    () => localStorage.getItem('app-show-line-numbers') === 'true'
  );
  const [mountedNoteIds, setMountedNoteIds] = useState<Set<string>>(new Set());

  // Derive per-group values for the active group
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const focusedNoteId = activeGroupId ? (focusedNoteByGroup[activeGroupId] ?? null) : null;

  // Preservar estado de las notas una vez montadas
  useEffect(() => {
    if (focusedNoteId) {
      setMountedNoteIds(prev => new Set([...prev, focusedNoteId]));
    }
  }, [focusedNoteId]);

  const isGlobalNoteTrayOpen = activeGroupId ? (noteTrayOpenByGroup[activeGroupId] ?? true) : false;
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const currentSearchQuery = activeGroupId ? (searchQueries[activeGroupId] || '') : '';
  const [searchExemptNoteIds, setSearchExemptNoteIds] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('app-theme-preference') as Theme) || 'dark');
  const [noteFont, setNoteFont] = useState<NoteFont>(() => (localStorage.getItem('app-note-font') as NoteFont) || 'sans');
  const [noteFontSize, setNoteFontSize] = useState<string>(() => localStorage.getItem('app-note-font-size') || 'medium');
  const [noteLineHeight, setNoteLineHeight] = useState<string>(() => localStorage.getItem('app-note-line-height') || 'standard');
  
  // 🚀 NUEVO: Formatos de Fecha y Hora
  const [dateFormat, setDateFormat] = useState<string>(() => localStorage.getItem('app-date-format') || 'dd/mm/yyyy');
  const [timeFormat, setTimeFormat] = useState<string>(() => localStorage.getItem('app-time-format') || '12h');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);

  const [tempGroupName, setTempGroupName] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [groupTitleSyncStatus, setGroupTitleSyncStatus] = useState<'saved' | 'saving' | ''>('');

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

  // Removed problematic focus-cleanup useEffect that was resetting state during app switch.
  // Explicit cleanup is handled inside deleteNote and moveNote functions.

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

  // 📡 REALTIME SYNC - Listeners para sincronización entre dispositivos
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('global-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          fetchData(); 
        } else if (payload.eventType === 'UPDATE') {
          // 🚀 OPTIMIZATION: Actualización granular para no colapsar notas ni recargar todo
          updateNoteSync(payload.new.id, payload.new as Partial<Note>);
        } else if (payload.eventType === 'DELETE') {
          deleteNoteSync(payload.old.id);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, (payload) => {
        fetchData(); 
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        // Trigger de recarga para Kanban
        window.dispatchEvent(new CustomEvent('kanban-updated'));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, (payload: any) => {
        // Trigger de recarga para Recordatorios
        const id = payload.new?.id || payload.old?.id;
        window.dispatchEvent(new CustomEvent('reminder-attended', { detail: id }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'translations' }, (payload) => {
        // Trigger de recarga para Traducciones
        fetchTranslations();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brain_dumps' }, (payload) => {
        // Trigger de recarga para Pizarras
        fetchBrainDumps();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);


  const fetchTranslations = async () => {
    if (!session) return;
    const { data } = await supabase.from('translations').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    if (data) setTranslations(data);
  };

  const fetchBrainDumps = async () => {
    if (!session) return;
    const { data } = await supabase.from('brain_dumps').select('*').eq('user_id', session.user.id).order('updated_at', { ascending: false });
    if (data) setBrainDumps(data);
  };


  useEffect(() => {
    if (!session) return;
    const checkReminders = async () => {
      const { data } = await supabase.from('reminders').select('id, title, targets').eq('status', 'active');
      if (!data) return;

      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      let overdueTotalCount = 0;
      let imminentTotalCount = 0;
      let overdueList: { id: string; title: string; targetId: string; dueAt: string }[] = [];

      data.forEach(r => {
          const targets = Array.isArray(r.targets) ? r.targets : [];
          
          targets.forEach(t => {
              if (!t.is_completed) {
                  const d = new Date(t.due_at);
                  if (d <= now) {
                      overdueTotalCount++;
                      overdueList.push({ id: r.id, title: t.title || r.title || 'Recordatorio', targetId: t.id, dueAt: t.due_at });
                  } else if (d > now && d <= in24h) {
                      imminentTotalCount++;
                  }
              }
          });
      });

      setOverdueRemindersCount(overdueTotalCount);
      setImminentRemindersCount(imminentTotalCount);
      setOverdueRemindersList(overdueList);
    };

    checkReminders();
    const interval = setInterval(checkReminders, 30000);

    // 🚀 FIX: Optimistic UI Sync. Si nos avisan que un target se atendió, lo borramos de la memoria visual de inmediato
    const handleAttended = (e: Event) => {
        const targetId = (e as CustomEvent).detail;
        setOverdueRemindersList(prev => prev.filter(r => r.targetId !== targetId));
        // Tras 600ms (tiempo suficiente para que autoSave guarde en BD), forzamos recálculo de los grupos rojos en el Sidebar
        setTimeout(checkReminders, 600); 
    };

    window.addEventListener('reminder-attended', handleAttended);

    return () => {
        clearInterval(interval);
        window.removeEventListener('reminder-attended', handleAttended);
    };
  }, [session, setOverdueRemindersCount, setImminentRemindersCount]);

  const { setActiveTimersCount } = useUIStore();
  useEffect(() => {
    if (!session) return;
    const checkTimers = async () => {
      const { count } = await supabase.from('timers').select('id', { count: 'exact', head: true }).not('last_started_at', 'is', null);
      setActiveTimersCount(count ?? 0);
    };

    const handleTimerChanged = () => {
      // Pequeño delay de 500ms para asegurar que la base de datos se haya actualizado tras el autoSave de 500ms
      setTimeout(checkTimers, 600);
    };

    checkTimers();
    const interval = setInterval(checkTimers, 10000); // 10 segundos de polling
    window.addEventListener('timer-changed', handleTimerChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener('timer-changed', handleTimerChanged);
    };
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
    const handleReload = () => {
        fetchData();
        fetchTranslations();
        fetchBrainDumps();
    };
    window.addEventListener('reload-app-data', handleReload);
    return () => window.removeEventListener('reload-app-data', handleReload);
  }, [session]);

  const fetchData = async () => {
    if (!hasLoadedOnce.current) setLoading(true);
    try {
      const { data: groupsData, error: groupsError } = await supabase.from('groups').select('*').order('created_at', { ascending: true });
      if (groupsError) throw groupsError;

      // 📡 Carga inicial de Pizarrones y Traducciones
      fetchBrainDumps();
      fetchTranslations();

      const { data: notesData, error: notesError } = await supabase.from('notes').select('*').order('position', { ascending: true });
      if (notesError) throw notesError;

      const store = useUIStore.getState();
      const currentSortPref = store.noteSortMode;
      const openNotes = store.openNotesByGroup;

      const mergedGroups: Group[] = (groupsData || []).map(g => {
        const currentlyOpenIds = openNotes[g.id] || [];
        let groupNotes: Note[] = (notesData || []).filter(n => n.group_id === g.id).map(n => ({ 
          ...n, 
          isOpen: currentlyOpenIds.includes(n.id) 
        }));
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

    const store = useUIStore.getState();
    const currentActiveId = store.activeGroupId;
    if (!currentActiveId) return;

    // 🚀 FIX REAL: Eliminamos el setTimeout.
    // React encola las actualizaciones funcionales (currentGroups => ...). 
    // Como el onBlur del título se dispara milisegundos antes que el onClick de cerrar,
    // este sort ejecutará inmediatamente DESPUÉS de que el título "Venus" ya esté en memoria.
    setGroups(currentGroups => {
      return currentGroups.map(g => {
        if (g.id === currentActiveId) {
          return { ...g, notes: sortNotesArray(g.notes, mode) };
        }
        return g;
      });
    });
  };

  const addGroup = async () => {
    const title = prompt('Nombre del nuevo grupo (ej. "Trabajo", "Ideas"):');
    if (!title || !session) return;
    try {
      const { data: groupData, error: groupError } = await supabase.from('groups').insert([{ name: title.slice(0, 15), user_id: session.user.id }]).select().single();
      if (groupError) throw groupError;

      const { data: noteData, error: noteError } = await supabase.from('notes').insert([{ title: '', content: '', group_id: groupData.id, user_id: session.user.id, position: 0 }]).select().single();
      if (noteError) throw noteError;

      const newNote: Note = { id: noteData.id, title: noteData.title, content: noteData.content || '', isOpen: true, created_at: noteData.created_at, group_id: noteData.group_id, position: noteData.position };
      const newGroup: Group = { id: groupData.id, title: groupData.name, notes: [newNote], user_id: groupData.user_id, is_pinned: false, last_accessed_at: new Date().toISOString() };
      
      setGroups([...groups, newGroup]);
      openGroup(newGroup.id);
      
      setGlobalView('notes');
      
      // Explicitly set the initial note as open in the store
      useUIStore.setState((state) => ({
        openNotesByGroup: {
          ...state.openNotesByGroup,
          [newGroup.id]: [newNote.id]
        }
      }));

      setFocusedNoteId(newNote.id);
      setEditingNoteId(newNote.id);
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

  const { closeGroup } = useUIStore();
  const deleteGroup = async (groupId: string) => {
    if (confirm("¿Estás seguro? Todas las notas de este grupo se perderán.")) {
      try {
        const { error } = await supabase.from('groups').delete().eq('id', groupId);
        if (error) throw error;
        
        // 1. Eliminar del estado local de grupos
        setGroups(prev => prev.filter(g => g.id !== groupId));
        
        // 2. Sincronizar UI (cerrar del dock y cambiar activeGroupId si aplica)
        closeGroup(groupId);
        
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

  useEffect(() => {
    if (activeGroupId) {
      const activeGroup = groups.find(g => g.id === activeGroupId);
      if (activeGroup) {
        if (tempGroupName !== null && tempGroupName.trim() && tempGroupName !== activeGroup.title) {
          updateGroupTitle(activeGroup.id, tempGroupName.trim());
        }
        setTempGroupName(null);
      }
    }
  }, [activeGroupId]);

  const handleCancelEdit = () => {
    setTempGroupName(null);
  };

  const addNote = async () => {
    if (!activeGroupId || !session) return;
    try {
      const currentGroup = groups.find(g => g.id === activeGroupId);
      const position = currentGroup ? currentGroup.notes.length : 0;
      const { data, error } = await supabase.from('notes').insert([{ title: '', content: '', group_id: activeGroupId, user_id: session.user.id, position }]).select().single();
      if (error) throw error;

      const newNote: Note = { id: data.id, title: data.title, content: data.content || '', isOpen: true, created_at: data.created_at, group_id: data.group_id, position: data.position };

      // Identificar si hay alguna nota abierta para insertar debajo
      const openNotes = openNotesByGroup[activeGroupId] || [];
      const firstOpenNoteId = openNotes.length > 0 ? openNotes[0] : null;

      setGroups(groups.map(g => {
        if (g.id === activeGroupId) {
          // 🚀 FIX: Eliminamos la regla de "anclaje" complicada.
          // Simplemente la ponemos al principio para que sea visible de inmediato,
          // pero sin lógica de "splice" que pueda dejarla amarrada a un índice.
          const newNotes = [newNote, ...g.notes];
          return { ...g, notes: newNotes };
        }
        return g;
      }));

      // Lógica de Foco y Colapso: Cerrar las anteriores y abrir la nueva
      const store = useUIStore.getState();
      useUIStore.setState({
        openNotesByGroup: {
          ...store.openNotesByGroup,
          [activeGroupId]: [newNote.id]
        }
      });

      setEditingNoteId(newNote.id);
      setFocusedNoteId(newNote.id);

      // Scroll suave hacia la nueva nota para asegurar visibilidad
      setTimeout(() => {
        const noteElement = document.getElementById(`note-${newNote.id}`);
        if (noteElement) {
          noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);

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

    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.is_pinned !== undefined) dbUpdates.is_pinned = updates.is_pinned;
    if (updates.is_docked !== undefined) dbUpdates.is_docked = updates.is_docked;
    if (updates.is_checklist !== undefined) dbUpdates.is_checklist = updates.is_checklist;

    const isTextUpdate = updates.title !== undefined || updates.content !== undefined;
    if (isTextUpdate) {
        dbUpdates.updated_at = new Date().toISOString();
    }

    setGroups(currentGroups => currentGroups.map(g => {
      const isRelevantGroup = g.id === (updates.group_id || activeGroupId); // Use group_id if provided (e.g. from duplication)
      if (!isRelevantGroup) return g;

      const updatedNotes = g.notes.map(n => {
        if (n.id === noteId) {
            const newNote = { ...n, ...updates };
            if (isTextUpdate) newNote.updated_at = dbUpdates.updated_at;
            return newNote;
        }
        return n;
      });

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

    if (Object.keys(dbUpdates).length === 0) return;
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


  const filteredNotes = activeGroup 
    ? (focusedNoteId 
        ? activeGroup.notes.filter(n => n.id === focusedNoteId)
        : [])
    : [];

  const handleUpdateNoteWrapper = (noteId: string, updates: Partial<Note>) => {
    // 🚀 FIX: Liberar completamente el estado "amarrado" de la nota
    // tanto si se edita el contenido COMO si se edita el título.
    if (updates.content !== undefined || updates.title !== undefined) {
        setEditingNoteId(null);
    }
    updateNote(noteId, updates);
  };

  const cleanMarkdownForExport = (text: string) =>
    text
      .replace(/\{=|=\}/g, '')                           // Strip highlights
      .replace(/\[\[tr:[^|]*\|([^\]]*)\]\]/g, '$1');     // Strip translation marks, keep original text

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
      return `titulo: ${note.title || 'Sin título'}\nfecha creacion: ${formatNoteDate(note.created_at)}\nfecha ultima edicion: ${formatNoteDate(note.updated_at || note.created_at)}\ncontenido de la nota:\n${cleanMarkdownForExport(note.content || '')}`;
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

  const downloadNoteAsMarkdown = (note: Note) => {
    const formatNoteDate = (dateString?: string) => {
      if (!dateString) return 'Desconocida';
      return new Date(dateString).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };
    const mdContent = `titulo: ${note.title || 'Sin título'}\nfecha creacion: ${formatNoteDate(note.created_at)}\nfecha ultima edicion: ${formatNoteDate(note.updated_at || note.created_at)}\ncontenido de la nota:\n${cleanMarkdownForExport(note.content || '')}`;
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${(note.title || 'nota').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyNoteToClipboard = async (note: Note) => {
    const clean = cleanMarkdownForExport(note.content || '');
    const text = `${note.title || 'Sin título'}\n\n${clean}`;
    await navigator.clipboard.writeText(text);
  };

  const duplicateNote = async (noteId: string) => {
    if (!session || !activeGroupId) return;
    const currentGroup = groups.find(g => g.id === activeGroupId);
    if (!currentGroup) return;
    const originalIndex = currentGroup.notes.findIndex(n => n.id === noteId);
    if (originalIndex === -1) return;
    const original = currentGroup.notes[originalIndex];
    try {
      const position = currentGroup.notes.length;
      const { data, error } = await supabase.from('notes').insert([{
        title: `Copia de ${original.title || 'Sin título'}`,
        content: original.content || '',
        group_id: activeGroupId,
        user_id: session.user.id,
        position,
        is_checklist: original.is_checklist || false,
      }]).select().single();
      if (error) throw error;
      const newNote: Note = { id: data.id, title: data.title, content: data.content || '', isOpen: true, created_at: data.created_at, group_id: data.group_id, position: data.position, is_checklist: data.is_checklist };
      
      setGroups(groups.map(g => {
        if (g.id === activeGroupId) {
          const newNotes = [...g.notes];
          newNotes.splice(originalIndex + 1, 0, newNote);
          return { ...g, notes: newNotes };
        }
        return g;
      }));

      // 🚀 UX: Cerrar las demás y abrir la duplicada
      const store = useUIStore.getState();
      useUIStore.setState({
          openNotesByGroup: {
              ...store.openNotesByGroup,
              [activeGroupId]: [newNote.id]
          }
      });

      if (store.noteSortMode) {
          applyManualSort(store.noteSortMode);
      }
    } catch (error: any) {
      alert('Error al duplicar nota: ' + error.message);
    }
  };

  const moveNoteToGroup = async (noteId: string, targetGroupId: string) => {
    if (!session) return;
    try {
      const { error } = await supabase.from('notes').update({ group_id: targetGroupId }).eq('id', noteId);
      if (error) throw error;

      setGroups(prev => {
        let movedNote: Note | null = null;
        const withRemoved = prev.map(g => {
          if (g.notes.some(n => n.id === noteId)) {
            movedNote = g.notes.find(n => n.id === noteId) || null;
            return { ...g, notes: g.notes.filter(n => n.id !== noteId) };
          }
          return g;
        });

        if (!movedNote) return prev;

        return withRemoved.map(g => {
          if (g.id === targetGroupId) {
            return { ...g, notes: [...g.notes, { ...movedNote!, group_id: targetGroupId }] };
          }
          return g;
        });
      });
    } catch (error: any) {
      alert('Error al mover nota: ' + error.message);
      throw error;
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-[#111113] overflow-hidden transition-colors duration-300">
      <Sidebar
        groups={groups}
        activeGroupId={activeGroupId}
        onSelectGroup={(id) => { 
          const store = useUIStore.getState();
          const isReturningToRoot = store.activeGroupId === id && store.globalView === 'notes';
          setActiveGroup(id); 
          setGlobalView('notes');
          if (isReturningToRoot) {
            setFocusedNoteId(null);
          }
        }}
        onAddGroup={() => { addGroup(); setIsGlobalNoteTrayOpen(true); }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onTogglePin={toggleGroupPin}
        onLogout={handleLogout}
        onSelectDockedNote={(groupId, noteId) => {
          const isAlreadyFocused = focusedNoteByGroup[groupId] === noteId;
          const currentOpen = openNotesByGroup[groupId] || [];
          const isOpen = currentOpen.includes(noteId);

          if (isAlreadyFocused && globalView === 'notes') {
            // Toggle OFF
            setFocusedNoteId(null, groupId);
            if (isOpen) toggleNote(groupId, noteId);
          } else {
            // Toggle ON or Switch
            setActiveGroup(groupId);
            setGlobalView('notes');
            if (!isOpen) toggleNote(groupId, noteId);
            setFocusedNoteId(noteId, groupId);
            setIsGlobalNoteTrayOpen(true, groupId);
          }
        }}
        focusedNoteId={focusedNoteId}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* --- STACK DE BANNERS (NAVEGACIÓN GLOBAL) --- */}
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          
          .marquee-wrapper {
            overflow: hidden;
            width: 100%;
            mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
          }
          
          .marquee-content {
            display: flex;
            width: max-content;
            white-space: nowrap;
            animation: marquee 30s linear infinite;
          }

          .marquee-content:hover {
            animation-play-state: paused;
          }

          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }

          @keyframes slideToUnlock {
            from { background-position: -300px 0; }
            to { background-position: 300px 0; }
          }

          .slide-to-unlock {
            background: linear-gradient(to right, #71717a 0%, #71717a 40%, #e4e4e7 50%, #71717a 60%, #71717a 100%);
            background-size: 600px 100%;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: slideToUnlock 2s linear infinite;
          }

          .note-editor-scroll::-webkit-scrollbar { width: 8px; }
          .note-editor-scroll::-webkit-scrollbar-track { background: transparent; }
          .note-editor-scroll::-webkit-scrollbar-thumb { background-color: #d4d4d8; border-radius: 99px; border: 2px solid transparent; background-clip: content-box; }
          .note-editor-scroll::-webkit-scrollbar-thumb:hover { background-color: #a1a1aa; }
          .dark .note-editor-scroll::-webkit-scrollbar-thumb { background-color: #3f3f46; }
          .dark .note-editor-scroll::-webkit-scrollbar-thumb:hover { background-color: #52525b; }
          .note-editor-scroll { scrollbar-width: thin; scrollbar-color: #3f3f46 transparent; }

          .cm-lineNumbers .cm-gutterElement {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 10px;
            padding-left: 6px;
            font-size: 11px;
            color: #a1a1aa;
            min-width: 32px;
            line-height: inherit;
          }
          .dark .cm-lineNumbers .cm-gutterElement { color: #52525b; }
          .cm-gutter.cm-lineNumbers { border-right: 1px solid #e4e4e7; margin-right: 8px; }
          .dark .cm-gutter.cm-lineNumbers { border-right-color: #27272a; }
          .cm-activeLineGutter { background-color: transparent !important; }

        `}</style>
        <div className="flex flex-col z-50 shrink-0">
          
          {/* 1. BANNER DE RECORDATORIOS VENCIDOS (BARRA PLANA BORDERLESS) */}
          {showOverdueMarquee && overdueRemindersList.length > 0 && (
            <div className="w-full bg-[#0F0F12] overflow-hidden shrink-0 border-b border-zinc-800">
              <div className="py-2.5 flex items-center">
                <div className="flex-1 overflow-hidden relative h-6 flex items-center">
                  <div className="marquee-content text-[11px] font-normal tracking-[0.1em] text-[#5E5E66] uppercase">
                    {/* Set A */}
                    <div className="flex shrink-0 items-center pr-[100vw]">
                      {overdueRemindersList.map((r, idx) => (
                        <span key={`a-${r.targetId}`} className="shrink-0">
                          {r.title} <span className="text-[#D5D6D8]">({r.dueAt ? new Date(r.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''})</span>
                          {idx < overdueRemindersList.length - 1 ? <span className="mx-2">|</span> : ''}
                        </span>
                      ))}
                    </div>
                    {/* Set B (duplicate for seamless loop) */}
                    <div className="flex shrink-0 items-center pr-[100vw]">
                      {overdueRemindersList.map((r, idx) => (
                        <span key={`b-${r.targetId}`} className="shrink-0">
                          {r.title} <span className="text-[#D5D6D8]">({r.dueAt ? new Date(r.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''})</span>
                          {idx < overdueRemindersList.length - 1 ? <span className="mx-2">|</span> : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ELIMINADO DE AQUÍ EL BLOQUE 2. BANNERS DE GRUPOS */}
        </div>

        {globalView === 'kanban' ? (
          <KanbanApp 
            groups={groups} 
            dateFormat={dateFormat}
            timeFormat={timeFormat}
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
         globalView === 'reminders' ? <RemindersApp session={session!} dateFormat={dateFormat} timeFormat={timeFormat} /> :
         globalView === 'braindump' ? <BrainDumpApp session={session!} noteFont={noteFont} noteFontSize={noteFontSize} noteLineHeight={noteLineHeight} /> :
         globalView === 'translator' ? <TranslatorApp session={session!} /> : (
          <>
            <div className={`sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md shrink-0 ${isGlobalNoteTrayOpen ? '' : 'border-b border-zinc-200 dark:border-zinc-800 shadow-sm'}`}>
               <div className={`min-h-[72px] h-auto flex flex-col lg:flex-row lg:items-center justify-between px-4 md:px-6 py-3 gap-3 ${isGlobalNoteTrayOpen ? 'border-b border-zinc-200 dark:border-zinc-800 shadow-sm' : ''}`}>
                 {activeGroup ? (
                    <>
                      {/* Lado Izquierdo: Icono, Título Editable y Contador */}
                      <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                          <button
                          onClick={() => setIsLauncherOpen(true)}
                            className="h-9 p-2 bg-[#4940D9] hover:bg-[#3D35C0] rounded-lg text-white shadow-md hover:shadow-lg hover:shadow-[#4940D9]/30 shrink-0 transition-all"
                            title="Menú de Grupos"
                          >
                              <Grid size={20} />
                          </button>
                          
                          <div className="flex-1 relative flex items-center min-w-0">
                            <div className="absolute inset-0 w-full pointer-events-none text-xl md:text-2xl font-bold px-2 flex items-center overflow-hidden whitespace-nowrap">
                              <span className="truncate opacity-0">.</span> {/* Spacer for alignment if needed, but we'll use same style as AccordionItem */}
                            </div>
                            
                            <input
                              type="text"
                              value={tempGroupName !== null ? tempGroupName : (activeGroup.title || '')}
                              onChange={(e) => setTempGroupName(e.target.value)}
                              onBlur={() => {
                                if (tempGroupName !== null && tempGroupName.trim() && tempGroupName !== activeGroup.title) {
                                  updateGroupTitle(activeGroup.id, tempGroupName.trim());
                                }
                                setTempGroupName(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                } else if (e.key === 'Escape') {
                                  setTempGroupName(null);
                                  e.currentTarget.blur();
                                }
                              }}
                              className="w-full bg-transparent text-xl md:text-2xl font-bold text-zinc-800 dark:text-[#C4C7C5] outline-none px-2 cursor-text truncate placeholder-zinc-400"
                              placeholder="Nombre del grupo de notas ..."
                              title="Haz clic para editar"
                            />
                          </div>
                      </div>

                      {/* Lado Derecho: Controles de Grupo y Acciones */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 pb-1 md:pb-0">
                          
                          {/* Botones de Estado/Vista (Bell, Tray, Maximize) */}
                          <div className="flex items-center gap-1.5 mr-1">
                             {/* Botón Toggle Reminder */}
                             <button
                               onClick={() => setShowOverdueMarquee(!showOverdueMarquee)}
                               className={`h-9 p-2 rounded-xl transition-all active:scale-95 shrink-0 flex items-center gap-2 border ${
                                 showOverdueMarquee 
                                   ? 'bg-[#DC2626] border-red-600 text-white shadow-md shadow-red-600/20' 
                                   : overdueRemindersCount > 0
                                     ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40'
                                     : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600'
                               }`}
                               title={showOverdueMarquee ? "Ocultar Recordatorios" : "Mostrar Recordatorios"}
                             >
                                <Bell size={18} className={overdueRemindersList.length > 0 ? 'animate-pulse' : ''} />
                                <span className="text-xs font-bold">{overdueRemindersList.length}</span>
                             </button>

                             <button 
                                onClick={() => setIsGlobalNoteTrayOpen(!isGlobalNoteTrayOpen)}
                                className={`h-9 p-2 rounded-xl transition-all active:scale-95 shrink-0 flex items-center gap-2 border ${
                                  isGlobalNoteTrayOpen 
                                    ? 'bg-[#4940D9] border-[#4940D9] text-white shadow-md shadow-[#4940D9]/20' 
                                    : 'bg-[#4940D9]/10 dark:bg-[#4940D9]/20 border-[#4940D9]/30 text-[#4940D9] hover:bg-[#4940D9]/20 dark:hover:bg-[#4940D9]/30'
                                }`}
                                title={isGlobalNoteTrayOpen ? "Ocultar bandeja de notas" : "Mostrar bandeja de notas"}
                              >
                                 <ChevronsDownUp size={18} className={`transition-transform duration-300 ${isGlobalNoteTrayOpen ? 'rotate-180' : ''}`} />
                                 <span className="text-xs font-bold">{activeGroup.notes.length}</span>
                              </button>

                              {/* Botón Maximizar/Minimizar */}
                             <button
                               onClick={() => setIsMaximized(!isMaximized)}
                               className="h-9 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-95 shrink-0"
                               title={isMaximized ? "Minimizar" : "Maximizar"}
                             >
                               {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                             </button>
                          </div>

                          {/* Controles de Grupo (En una mini-cápsula gris) */}
                          <div className="h-9 flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 p-1 rounded-xl border border-[#111113] shrink-0">
                              
                              {/* Buscador */}
                              <div className="relative flex items-center transition-all duration-300 mr-2">
                                <Search size={15} className={`absolute left-2 pointer-events-none transition-colors ${currentSearchQuery.trim() ? 'text-amber-600 dark:text-amber-500 font-bold' : 'text-zinc-400'}`} />
                                <input
                                  type="text"
                                  placeholder={`Buscar...`}
                                  value={currentSearchQuery}
                                  onChange={(e) => {
                                    if (activeGroupId) setSearchQueries(prev => ({ ...prev, [activeGroupId]: e.target.value }));
                                    setSearchExemptNoteIds(new Set());
                                  }}
                                  className={`h-[26px] w-32 md:w-32 lg:w-40 pl-7 pr-8 text-xs rounded-lg border transition-all focus:outline-none ${currentSearchQuery.trim() ? 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 font-semibold placeholder-amber-700/50 dark:placeholder-amber-400/50' : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-1 focus:ring-zinc-400/30'}`}
                                />
                                {currentSearchQuery.trim() && (
                                  <button onClick={() => { if (activeGroupId) setSearchQueries(prev => ({ ...prev, [activeGroupId]: '' })); setSearchExemptNoteIds(new Set()); }} className="absolute right-2 p-0.5 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 bg-amber-200/50 dark:bg-amber-800/50 hover:bg-amber-300/50 dark:hover:bg-amber-700/50 rounded-full transition-colors" title="Limpiar búsqueda">
                                    <X size={12} />
                                  </button>
                                )}
                              </div>

                              <div className="relative" ref={sortMenuRef}>
                                <button 
                                    onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} 
                                    className="p-2 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-colors"
                                    title="Ordenar notas"
                                >
                                    <ArrowUpDown size={18} />
                                </button>
                                
                                {isSortMenuOpen && (
                                  <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-zinc-800 shadow-xl rounded-xl border border-zinc-200 dark:border-zinc-700 p-1.5 flex flex-col gap-0.5 min-w-[200px] animate-fadeIn">
                                    <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 border-b border-zinc-100 dark:border-zinc-700">Ordenar por</div>
                                    
                                    <button onClick={() => applyManualSort('date-desc')} className={`flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg transition-colors ${noteSortMode === 'date-desc' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium'}`}>
                                      <Calendar size={14} /> Fecha (Recientes)
                                      {noteSortMode === 'date-desc' && <Check size={14} className="ml-auto" />}
                                    </button>
                                    
                                    <button onClick={() => applyManualSort('date-asc')} className={`flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg transition-colors ${noteSortMode === 'date-asc' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium'}`}>
                                      <Calendar size={14} /> Fecha (Antiguos)
                                      {noteSortMode === 'date-asc' && <Check size={14} className="ml-auto" />}
                                    </button>
                                    
                                    <button onClick={() => applyManualSort('alpha-asc')} className={`flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg transition-colors ${noteSortMode === 'alpha-asc' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium'}`}>
                                      <Type size={14} /> Nombre (A-Z)
                                      {noteSortMode === 'alpha-asc' && <Check size={14} className="ml-auto" />}
                                    </button>
                                    
                                    <button onClick={() => applyManualSort('alpha-desc')} className={`flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg transition-colors ${noteSortMode === 'alpha-desc' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium'}`}>
                                      <Type size={14} /> Nombre (Z-A)
                                      {noteSortMode === 'alpha-desc' && <Check size={14} className="ml-auto" />}
                                    </button>
                                  </div>
                                )}
                              </div>


                              <button 
                                  onClick={downloadGroupAsMarkdown} 
                                  className="p-2 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-colors"
                                  title="Exportar Grupo"
                              >
                                  <Download size={18} />
                              </button>
                              <button 
                                  onClick={() => deleteGroup(activeGroup.id)} 
                                  className="p-2 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  title="Eliminar Grupo"
                              >
                                  <Trash2 size={18} />
                              </button>
                          </div>

                          {/* Botón Principal (Nueva Nota) */}
                          <button 
                              onClick={addNote} 
                              className="h-9 bg-[#4940D9] hover:bg-[#3D35C0] text-white px-4 py-2 rounded-xl shadow-lg shadow-[#4940D9]/20 transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0"
                          >
                              <Plus size={18} /> 
                              <span className="text-sm font-normal hidden sm:inline pr-1 text-white">Nueva Nota</span>
                          </button>
                      </div>
                    </>
                 ) : (
                    <>
                      <h1 className="text-xl font-bold text-zinc-800 dark:text-[#C4C7C5] flex items-center gap-3">
                        <div className="h-9 p-2 bg-[#4940D9] hover:bg-[#3D35C0] rounded-lg text-white shadow-md hover:shadow-lg hover:shadow-[#4940D9]/30 transition-all cursor-default">
                          <StickyNote size={20} />
                        </div>
                        Grupos de notas
                      </h1>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Botón Toggle Reminder */}
                        <button
                          onClick={() => setShowOverdueMarquee(!showOverdueMarquee)}
                          className={`h-9 p-2 rounded-xl transition-all active:scale-95 shrink-0 flex items-center gap-2 border ${
                            showOverdueMarquee 
                              ? 'bg-[#DC2626] border-red-600 text-white shadow-md shadow-red-600/20' 
                              : overdueRemindersCount > 0
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40'
                                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600'
                          }`}
                          title={showOverdueMarquee ? "Ocultar Recordatorios" : "Mostrar Recordatorios"}
                        >
                          <Bell size={18} className={overdueRemindersList.length > 0 ? 'animate-pulse' : ''} />
                          <span className="text-xs font-bold">{overdueRemindersList.length}</span>
                        </button>
                        <button
                          onClick={addGroup}
                          className="h-9 w-9 bg-[#4940D9] hover:bg-[#3D35C0] hover:shadow-lg hover:shadow-[#4940D9]/30 text-white rounded-full transition-all flex items-center justify-center shrink-0 shadow-md active:scale-95"
                          title="Crear Nuevo Grupo"
                        >
                          <Plus size={20} />
                        </button>
                        <button
                          onClick={() => setIsLauncherOpen(true)}
                          className="h-9 w-9 flex items-center justify-center rounded-xl bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 hover:bg-[#4940D9] dark:hover:bg-[#4940D9] hover:text-white dark:hover:text-white shadow-md hover:shadow-lg hover:shadow-[#4940D9]/30 transition-all duration-300 hover:scale-105 active:scale-95 shrink-0"
                          title="Abrir Launcher de Grupos"
                        >
                          <Grid size={20} />
                        </button>
                      </div>
                    </>
                 )}
               </div>

                {/* 2. FRANJA DE NOTAS (INTEGRADA EN EL ENCABEZADO) */}
                {isGlobalNoteTrayOpen && activeGroup && (
                  <div className="pt-4 px-4 pb-4 bg-[#111113] dark:bg-[#111113]">
                    <div className="flex flex-wrap justify-center gap-2.5">
                      {sortNotesArray(activeGroup.notes, noteSortMode)
                        .map(note => {
                        const isOpen = (openNotesByGroup[activeGroup.id] || []).includes(note.id);
                        const isFocused = focusedNoteId === note.id;
                        
                        // --- LÓGICA DE BÚSQUEDA ---
                        const query = currentSearchQuery.trim().toLowerCase();
                        const titleMatch = query && note.title?.toLowerCase().includes(query);
                        const contentMatch = query && !titleMatch && note.content?.toLowerCase().includes(query);
                        const isSearchActive = titleMatch || contentMatch;

                        // Helper para resaltar texto si coincide
                        const highlightTitle = (text: string) => {
                          if (!query || !text.toLowerCase().includes(query)) return text;
                          const parts = text.split(new RegExp(`(${query})`, 'gi'));
                          return parts.map((part, i) => 
                            part.toLowerCase() === query 
                              ? <mark key={i} className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 font-bold rounded-sm px-0.5">{part}</mark> 
                              : part
                          );
                        };

                          const linkedTask = globalTasks?.find(t => t.id === note.id);
                          let dotColorClass = null;
                          if (linkedTask) {
                            switch (linkedTask.status) {
                                case 'backlog': dotColorClass = 'bg-[#9E9E9E]'; break;
                                case 'todo': dotColorClass = 'bg-[#FBC02D]'; break;
                                case 'in_progress': dotColorClass = 'bg-[#1E88E5]'; break;
                                case 'done': dotColorClass = 'bg-[#43A047]'; break;
                            }
                          }

                          return (
                            <button
                              key={note.id}
                              onClick={() => {
                                const isNowFocused = focusedNoteId !== note.id;
                                const currentOpen = openNotesByGroup[activeGroup.id] || [];
                                const isOpen = currentOpen.includes(note.id);

                                if (isNowFocused) {
                                  setFocusedNoteId(note.id);
                                  if (!isOpen) toggleNote(activeGroup.id, note.id);
                                } else {
                                  // Toggle OFF
                                  setFocusedNoteId(null);
                                  if (isOpen) toggleNote(activeGroup.id, note.id);
                                }
                              }}
                              className={`relative flex items-center justify-center gap-2 px-3 py-2 text-[11px] font-medium rounded-xl transition-all shrink-0 border ${
                                isFocused
                                  ? 'bg-[#4940D9] text-white shadow-md shadow-[#4940D9]/20 scale-[1.02]'
                                  : isSearchActive
                                    ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 shadow-sm'
                                    : 'bg-white/10 dark:bg-white/10 text-[#A1A1AA] hover:text-white hover:bg-white/20'
                              } ${
                                isSearchActive
                                  ? 'border-amber-500 ring-1 ring-amber-500/50'
                                  : 'border-transparent'
                              }`}
                            >
                              <span className="whitespace-nowrap">{highlightTitle(note.title || 'Sin Título')}</span>
                              {(note.is_docked || note.is_pinned) && (
                                <span className="flex items-center gap-[3px] ml-1">
                                  {note.is_docked && <span className={`inline-block w-[8px] h-[8px] rounded-full ${isFocused ? 'bg-white' : 'bg-[#85858C]'}`} />}
                                  {note.is_pinned && <Pin size={9} className={`fill-current ${isFocused ? 'text-white' : 'text-[#85858C]'}`} />}
                                </span>
                              )}
                            </button>
                          );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* AREA DE LA NOTA - OCUPA EL RESTO DEL ESPACIO */}
              <main ref={mainRef} className={`flex-1 flex flex-col overflow-hidden px-4 pb-4 ${isGlobalNoteTrayOpen && activeGroup ? 'pt-[3px]' : 'pt-4'}`}>
                <div className={`flex-1 flex flex-col min-h-0 ${isMaximized ? 'max-w-full' : 'max-w-6xl'} w-full mx-auto`}>
                  {activeGroup ? (
                     <div className="flex-1 flex flex-col min-h-0">
                        {activeGroup.notes.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center opacity-60">
                             <StickyNote size={48} className="text-zinc-300 mb-4" />
                             <p className="text-sm font-medium">Este grupo no tiene notas aún.</p>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col min-h-0">
                            {activeGroup.notes
                              .filter(n => mountedNoteIds.has(n.id) || n.id === focusedNoteId)
                              .map(note => {
                                const isVisible = note.id === focusedNoteId;
                                const isOpen = (openNotesByGroup[activeGroup.id] || []).includes(note.id);
                                return (
                                  <div
                                    key={note.id}
                                    id={`note-${note.id}`}
                                    className="flex-1 flex flex-col min-h-0"
                                    style={{ display: isVisible ? 'flex' : 'none' }}
                                  >
                                    <AccordionItem
                                      note={{ ...note, isOpen }}
                                      searchQuery={currentSearchQuery}
                                      isHighlightedBySearch={!!(currentSearchQuery.trim() && (note.title?.toLowerCase().includes(currentSearchQuery.toLowerCase()) || note.content?.toLowerCase().includes(currentSearchQuery.toLowerCase())))}
                                      showLineNumbers={showLineNumbers}
                                      onToggleLineNumbers={() => {
                                        const next = !showLineNumbers;
                                        setShowLineNumbers(next);
                                        localStorage.setItem('app-show-line-numbers', String(next));
                                      }}
                                      onToggle={() => {
                                        const store = useUIStore.getState();
                                        const currentOpen = store.openNotesByGroup[activeGroup.id] || [];
                                        const wasOpen = currentOpen.includes(note.id);
                                        toggleNote(activeGroup.id, note.id);
                                        if (wasOpen && store.noteSortMode) {
                                          applyManualSort(store.noteSortMode);
                                        }
                                      }}
                                      onUpdate={(id, updates) => handleUpdateNoteWrapper(id, updates)}
                                      onDelete={deleteNote}
                                      onExportNote={downloadNoteAsMarkdown}
                                      onCopyNote={copyNoteToClipboard}
                                      onDuplicate={duplicateNote}
                                      onMove={moveNoteToGroup}
                                      groups={groups}
                                      noteFont={noteFont}
                                      noteFontSize={noteFontSize}
                                      noteLineHeight={noteLineHeight}
                                    />
                                  </div>
                                );
                              })
                            }
                          </div>
                        )}
                     </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center">
                      <p className="font-medium slide-to-unlock">Crea o selecciona un grupo para comenzar.</p>
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
        noteLineHeight={noteLineHeight}
        onNoteLineHeightChange={(lh: string) => { setNoteLineHeight(lh); localStorage.setItem('app-note-line-height', lh); }}
        dateFormat={dateFormat}
        onDateFormatChange={(f: string) => { setDateFormat(f); localStorage.setItem('app-date-format', f); }}
        timeFormat={timeFormat}
        onTimeFormatChange={(f: string) => { setTimeFormat(f); localStorage.setItem('app-time-format', f); }}
      />
      <GroupLauncher
        groups={groups}
        isOpen={isLauncherOpen}
        onClose={() => setIsLauncherOpen(false)}
        onTogglePin={(id, status) => {
           setGroups(prev => prev.map(g => g.id === id ? { ...g, is_pinned: !status } : g));
           supabase.from('groups').update({ is_pinned: !status }).eq('id', id).then();
        }}
      />
    </div>
  );
}

export default App;