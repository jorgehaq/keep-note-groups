import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Loader2, Check, X, Calendar, ArrowUp, ArrowDown, Type, Trash2, Download, ArrowUpDown, Folder, StickyNote, Grid, Maximize2, Minimize2 } from 'lucide-react';
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

  const { activeGroupId, setActiveGroup, openNotesByGroup, openGroup, dockedGroupIds, noteSortMode, setNoteSortMode, toggleNote, globalView, setGlobalView, setKanbanCounts, setGlobalTasks, isMaximized, setIsMaximized } = useUIStore();
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const currentSearchQuery = activeGroupId ? (searchQueries[activeGroupId] || '') : '';
  const [searchExemptNoteIds, setSearchExemptNoteIds] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('app-theme-preference') as Theme) || 'dark');
  const [noteFont, setNoteFont] = useState<NoteFont>(() => (localStorage.getItem('app-note-font') as NoteFont) || 'sans');
  const [noteFontSize, setNoteFontSize] = useState<string>(() => localStorage.getItem('app-note-font-size') || 'medium');
  
  // 🚀 NUEVO: Formatos de Fecha y Hora
  const [dateFormat, setDateFormat] = useState<string>(() => localStorage.getItem('app-date-format') || 'dd/mm/yyyy');
  const [timeFormat, setTimeFormat] = useState<string>(() => localStorage.getItem('app-time-format') || '12h');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);

  const [tempGroupName, setTempGroupName] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [groupTitleSyncStatus, setGroupTitleSyncStatus] = useState<'saved' | 'saving' | ''>('');
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [overdueRemindersList, setOverdueRemindersList] = useState<{ id: string; title: string; targetId?: string }[]>([]);

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
      const { data } = await supabase.from('reminders').select('id, title, targets').eq('status', 'active');
      if (!data) return;

      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      let overdueGroupCount = 0;
      let imminentGroupCount = 0;
      let overdueList: { id: string; title: string; targetId: string }[] = [];

      data.forEach(r => {
          const targets = Array.isArray(r.targets) ? r.targets : [];
          let groupHasOverdue = false;
          let groupHasImminent = false;
          
          targets.forEach(t => {
              if (!t.is_completed) {
                  const d = new Date(t.due_at);
                  if (d <= now) {
                      groupHasOverdue = true;
                      // Mantenemos la lista individual por si el usuario quiere saber qué sub-tarea falló en el banner superior
                      overdueList.push({ id: r.id, title: t.title || r.title || 'Recordatorio', targetId: t.id });
                  } else if (d > now && d <= in24h) {
                      groupHasImminent = true;
                  }
              }
          });

          // 🚀 MAGIA: Solo sumamos 1 por cada grupo problemático, no importa si tiene 10 sub-tareas vencidas
          if (groupHasOverdue) overdueGroupCount++;
          else if (groupHasImminent) imminentGroupCount++;
      });

      setOverdueRemindersCount(overdueGroupCount);
      setImminentRemindersCount(imminentGroupCount);
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
      const { data: groupData, error: groupError } = await supabase.from('groups').insert([{ name: title.slice(0, 15), user_id: session.user.id }]).select().single();
      if (groupError) throw groupError;

      const { data: noteData, error: noteError } = await supabase.from('notes').insert([{ title: '', content: '', group_id: groupData.id, user_id: session.user.id, position: 0 }]).select().single();
      if (noteError) throw noteError;

      const newNote: Note = { id: noteData.id, title: noteData.title, content: noteData.content || '', isOpen: true, created_at: noteData.created_at, group_id: noteData.group_id, position: noteData.position };
      const newGroup: Group = { id: groupData.id, title: groupData.name, notes: [newNote], user_id: groupData.user_id, is_pinned: false, last_accessed_at: new Date().toISOString() };
      
      setGroups([...groups, newGroup]);
      openGroup(newGroup.id);
      
      setGlobalView('notes');
      setFocusedNoteId(null);
      toggleNote(newGroup.id, newNote.id);
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
    const original = currentGroup.notes.find(n => n.id === noteId);
    if (!original) return;
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
      const newNote: Note = { id: data.id, title: data.title, content: data.content || '', isOpen: false, created_at: data.created_at, group_id: data.group_id, position: data.position, is_checklist: data.is_checklist };
      setGroups(groups.map(g => g.id === activeGroupId ? { ...g, notes: [newNote, ...g.notes] } : g));
    } catch (error: any) {
      alert('Error al duplicar nota: ' + error.message);
    }
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
        {/* --- BANNER DE RECORDATORIOS VENCIDOS --- */}
        {overdueRemindersList.length > 0 && (
          <>
            {/* 🚀 Animación de Faro de Luz (Shimmer) de Izquierda a Derecha */}
            <style>{`
              @keyframes shimmer-sweep {
                /* Invertimos de 200% a -200% para forzar el flujo Izquierda -> Derecha */
                0% { background-position: 200% center; }
                100% { background-position: -200% center; }
              }
              .animate-shimmer-text {
                background: linear-gradient(90deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.4) 100%);
                background-size: 200% auto;
                color: transparent;
                -webkit-background-clip: text;
                background-clip: text;
                animation: shimmer-sweep 2.5s linear infinite;
              }
            `}</style>
            
            <div className="relative w-full z-50 shrink-0 shadow-md bg-[#ff2800] text-white border-b border-red-900/50">
              <div className="px-4 md:px-6 py-3 flex flex-col gap-2">
                {overdueRemindersList.map(r => (
                  <div key={`${r.id}-${r.targetId}`} className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black tracking-wide truncate animate-shimmer-text drop-shadow-sm">
                      Recordatorio vencido: {r.title}
                    </span>
                    <button
                      onClick={() => setGlobalView('reminders')}
                      className="shrink-0 px-5 py-1.5 bg-white text-[#ff2800] hover:bg-zinc-100 text-xs font-black uppercase tracking-widest rounded-lg transition-transform active:scale-95 shadow-lg"
                    >
                      Atender
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

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
         globalView === 'braindump' ? <BrainDumpApp session={session!} noteFont={noteFont} noteFontSize={noteFontSize} /> :
         globalView === 'translator' ? <TranslatorApp session={session!} /> : (
          <>
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
               <div className="flex flex-col xl:flex-row xl:items-center justify-between px-4 md:px-6 py-3 gap-3">
                 {activeGroup ? (
                    <>
                      {/* Lado Izquierdo: Icono, Título Editable y Contador */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                          <button
                            onClick={() => setIsLauncherOpen(true)}
                            className="p-2 bg-[#6366F1] hover:bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-500/20 shrink-0 transition-colors"
                            title="Menú de Grupos"
                          >
                              <Grid size={20} />
                          </button>
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
                            className="flex-1 bg-transparent text-xl md:text-2xl font-bold text-zinc-800 dark:text-zinc-100 outline-none px-2 w-full min-w-[150px] cursor-text truncate placeholder-zinc-400"
                            placeholder="Nombre del grupo de notas ..."
                            title="Haz clic para editar"
                          />
                          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full shrink-0">
                              {activeGroup.notes.length} notas
                          </span>

                          {/* Botón Maximizar/Minimizar */}
                          <button
                            onClick={() => setIsMaximized(!isMaximized)}
                            className="p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-95 shrink-0"
                            title={isMaximized ? "Minimizar" : "Maximizar"}
                          >
                            {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                          </button>
                      </div>

                      {/* Lado Derecho: Opciones de Grupo y Botón Nueva Nota */}
                      <div className="flex items-center gap-2 shrink-0 pb-1 md:pb-0">
                          
                          {/* Controles de Grupo (En una mini-cápsula gris) */}
                          <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 shrink-0">
                              
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
                                    if (focusedNoteId) setFocusedNoteId(null);
                                  }}
                                  className={`w-32 md:w-32 lg:w-48 pl-7 pr-8 py-1.5 text-xs rounded-lg border transition-all focus:outline-none ${currentSearchQuery.trim() ? 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 font-semibold placeholder-amber-700/50 dark:placeholder-amber-400/50' : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-1 focus:ring-zinc-400/30'}`}
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
                              className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 md:px-5 md:py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0"
                          >
                              <Plus size={18} /> 
                              <span className="text-sm font-bold hidden sm:inline pr-1">Nueva Nota</span>
                          </button>
                      </div>
                    </>
                 ) : (
                    <>
                      <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-3">
                        <div className="p-2 bg-indigo-500 rounded-lg text-white shadow-lg shadow-indigo-500/20">
                          <StickyNote size={20} />
                        </div>
                        Grupos de notas
                      </h1>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={addGroup}
                          className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 p-2 md:px-4 md:py-2 rounded-xl transition-all flex items-center gap-2 shrink-0 border border-zinc-200 dark:border-zinc-700 shadow-sm"
                          title="Crear Nuevo Grupo"
                        >
                          <Plus size={18} />
                          <span className="text-sm font-bold hidden sm:inline pr-1">Nuevo Grupo</span>
                        </button>
                        <button
                          onClick={() => setIsLauncherOpen(true)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 md:px-4 md:py-2 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0"
                          title="Abrir Menú de Grupos"
                        >
                          <Grid size={18} />
                          <span className="text-sm font-bold hidden sm:inline pr-1">Abrir Menú</span>
                        </button>
                      </div>
                    </>
                 )}
               </div>
            </div>

            <main ref={mainRef} className={`flex-1 overflow-y-auto hidden-scrollbar ${isMaximized ? 'p-8' : 'p-4 md:p-8'}`}>
              <div className={`${isMaximized ? 'max-w-full' : 'max-w-4xl'} mx-auto pb-20`}>
                {activeGroup ? (
                  <>

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
                              onExportNote={downloadNoteAsMarkdown}
                              onCopyNote={copyNoteToClipboard}
                              onDuplicate={duplicateNote}
                              searchQuery={currentSearchQuery}
                              noteFont={noteFont}
                              noteFontSize={noteFontSize}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                        <p className="mb-4 text-center">Selecciona un grupo desde la barra lateral.</p>
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