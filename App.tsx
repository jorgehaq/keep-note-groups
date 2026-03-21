import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Loader2, Check, X, Calendar, ArrowUp, ArrowDown, Type, Trash2, Download, ArrowUpDown, Folder, FileText, StickyNote, Grid, Maximize2, Minimize2, ChevronsDownUp, Bell, Pin, PanelLeft, ChevronLeft, ChevronRight, Wind, PenLine, Archive, RotateCcw, ChevronDown } from 'lucide-react';

import { Note, Group, Theme, NoteFont, Reminder, NoteSortMode, BrainDump, TikTokVideo, TikTokQueueItem } from './types';
import { AccordionItem } from './components/AccordionItem';
import { Sidebar } from './components/Sidebar';
import { SettingsWindow } from './components/SettingsWindow';
import { KanbanApp } from './components/KanbanApp';
import { TimeTrackerApp } from './components/TimeTrackerApp';
import { RemindersApp } from './components/RemindersApp';
import { BrainDumpApp } from './components/BrainDumpApp';
import { TranslatorApp } from './components/TranslatorApp';
import { TikTokApp } from './components/TikTokApp';
import { GroupLauncher } from './components/GroupLauncher';
import { supabase } from './src/lib/supabaseClient';
import { Auth } from './components/Auth';
import { Session } from '@supabase/supabase-js';
import { useUIStore } from './src/lib/store';
import { KanbanSemaphore } from './components/KanbanSemaphore';

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
      case 'created-desc': {
        return (b.order_index || 0) - (a.order_index || 0);
      }
      case 'created-asc': {
        return (a.order_index || 0) - (b.order_index || 0);
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
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const highlightTitle = (text: string) => {
    if (!currentSearchQuery.trim()) return text;
    const parts = text.split(new RegExp(`(${currentSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) => 
        part.toLowerCase() === currentSearchQuery.toLowerCase() 
            ? <span key={i} className="bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 ring-1 ring-amber-500/30 rounded-sm px-0.5">{part}</span> 
            : part
    );
  };
  
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({}); 
  const pendingUpdatesRef = useRef<Record<string, any>>({});
  const [noteSaveStatus, setNoteSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'idle'>>({});

  const { 
    activeGroupId, setActiveGroup, openNotesByGroup, openGroup, dockedGroupIds, 
    noteSortMode, setNoteSortMode, toggleNote, globalView, setGlobalView, 
    setKanbanCounts, globalTasks, setGlobalTasks, isMaximized, setIsMaximized,
    showOverdueMarquee, setShowOverdueMarquee,
    overdueRemindersCount, overdueRemindersList, setOverdueRemindersList, imminentRemindersCount, setOverdueRemindersCount, 
    setImminentRemindersCount,
    groups, setGroups, updateNoteSync, deleteNoteSync, updateGroupSync, deleteGroupSync,
    setTranslations, setBrainDumps,
    setTikTokVideos, setTikTokQueueItems, updateTikTokVideoSync, deleteTikTokVideoSync, updateTikTokQueueItemSync, deleteTikTokQueueItemSync,
    summaryCounts, setSummaryCounts,
    focusedNoteByGroup, lastActiveNoteByGroup, setFocusedNoteId,
    noteTrayOpenByGroup, setIsGlobalNoteTrayOpen,
    isZenModeByApp, toggleZenMode,
    isNotesPizarronOpen, setIsNotesPizarronOpen,
    setActiveNoteId,
    searchQueries, setSearchQuery,
    isArchiveOpenByGroup, setArchiveOpenByGroup,
    setSidebarFocusMode
  } = useUIStore();

  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(
    () => localStorage.getItem('app-show-line-numbers') === 'true'
  );
  const [mountedNoteIds, setMountedNoteIds] = useState<Set<string>>(new Set());

  // Derive per-group values for the active group
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const focusedNoteId = activeGroupId ? (focusedNoteByGroup[activeGroupId] ?? null) : null;
  const activeNoteId = activeGroupId ? (lastActiveNoteByGroup[activeGroupId] ?? null) : null;

  // Preservar estado de las notas una vez montadas
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const { isZenModeByApp, toggleZenMode, globalView } = useUIStore.getState();
        if (isZenModeByApp[globalView]) {
          toggleZenMode(globalView);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (activeNoteId) {
      setMountedNoteIds(prev => new Set([...prev, activeNoteId]));
    }
  }, [activeNoteId]);

  const isGlobalNoteTrayOpen = activeGroupId ? (noteTrayOpenByGroup[activeGroupId] ?? true) : false;
  const currentSearchQuery = 
    globalView === 'braindump' ? (searchQueries['braindump'] || '') : 
    globalView === 'tiktok' ? (searchQueries['tiktok'] || '') :
    (activeGroupId ? (searchQueries[activeGroupId] || '') : '');
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
  const isZenMode = isZenModeByApp[globalView] || false;
  const realShowOverdueMarquee = showOverdueMarquee && !isZenMode;
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [groupTitleSyncStatus, setGroupTitleSyncStatus] = useState<'saved' | 'saving' | ''>('');

  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [allGroupSummaries, setAllGroupSummaries] = useState<any[]>([]);
  const [allPizarronSummaries, setAllPizarronSummaries] = useState<any[]>([]);
  const [allTikTokSummaries, setAllTikTokSummaries] = useState<any[]>([]);
  const [allTikTokSubnotes, setAllTikTokSubnotes] = useState<any[]>([]);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const summaryCountDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasSearchMatchLeft, setHasSearchMatchLeft] = useState(false);
  const [hasSearchMatchRight, setHasSearchMatchRight] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 5);

      // --- Lógica de Iluminación de Flechas por Búsqueda ---
      const query = currentSearchQuery.trim();
      if (!query) {
        setHasSearchMatchLeft(false);
        setHasSearchMatchRight(false);
        return;
      }

      let matchLeft = false;
      let matchRight = false;
      const tabs = scrollContainerRef.current.querySelectorAll('button[data-is-match="true"]');
      
      tabs.forEach(tab => {
        const t = tab as HTMLElement;
        const tabStart = t.offsetLeft;
        const tabEnd = tabStart + t.offsetWidth;
        
        // Un tab está a la izquierda si su inicio entra en la zona de la flecha/gradiente (offset de px-10 es 40)
        if (tabStart < scrollLeft + 35) matchLeft = true;
        // Un tab está a la derecha si su final entra en la zona de la flecha/gradiente
        if (tabEnd > scrollLeft + clientWidth - 35) matchRight = true;
      });

      setHasSearchMatchLeft(matchLeft);
      setHasSearchMatchRight(matchRight);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [groups, activeGroupId, isGlobalNoteTrayOpen, globalView, currentSearchQuery]);

  const getNewOrderIndex = () => {
    if (!activeGroupId) return 1;
    const group = groups.find(g => g.id === activeGroupId);
    if (!group || group.notes.length === 0) return 1;

    // Foco principal: la nota que el usuario está viendo o editando actualmente
    const activeNoteId = lastActiveNoteByGroup[activeGroupId] || focusedNoteByGroup[activeGroupId];
    const activeIndex = group.notes.findIndex(n => n.id === activeNoteId);

    if (activeIndex === -1) {
      // Si no hay nota activa, insertar al final
      const last = group.notes[group.notes.length - 1];
      return (last.order_index || 0) + 1;
    }

    const current = group.notes[activeIndex];
    const next = group.notes[activeIndex + 1];

    if (!next) {
        return (current.order_index || 0) + 1;
    }

    return ((current.order_index || 0) + (next.order_index || 0)) / 2;
  };

  useEffect(() => {
    if (!activeGroupId || !session) {
      setAllGroupSummaries([]);
      return;
    }
    
    const fetchAllSummaries = async () => {
      const g = groups.find(group => group.id === activeGroupId);
      const noteIds = g?.notes.map(n => n.id) || [];
      if (noteIds.length === 0) return;
      const { data } = await supabase.from('summaries').select('*').in('note_id', noteIds);
      setAllGroupSummaries(data || []);
    };
    
    fetchAllSummaries();
  }, [activeGroupId, session, activeGroup?.notes.length]);

  useEffect(() => {
    if (!session || globalView !== 'braindump') {
      setAllPizarronSummaries([]);
      return;
    }
    const fetchAllPizarronSummaries = async () => {
      const { data } = await supabase.from('summaries').select('*').not('brain_dump_id', 'is', null);
      setAllPizarronSummaries(data || []);
    };
    fetchAllPizarronSummaries();
  }, [session, globalView]);

  useEffect(() => {
    if (!session || globalView !== 'tiktok') {
      setAllTikTokSummaries([]);
      setAllTikTokSubnotes([]);
      return;
    }
    const fetchAllTikTokData = async () => {
      const { data: sums } = await supabase.from('summaries').select('*').not('tiktok_video_id', 'is', null);
      setAllTikTokSummaries(sums || []);
      const { data: notes } = await supabase.from('notes').select('*').not('tiktok_video_id', 'is', null);
      setAllTikTokSubnotes(notes || []);
    };
    fetchAllTikTokData();
  }, [session, globalView]);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: direction === 'left' ? -350 : 350, behavior: 'smooth' });
    }
  };

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
    // onAuthStateChange already fires INITIAL_SESSION on mount in Supabase v2
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        setSession(session);
        if (session) {
          fetchData(session);
        } else {
          setLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setGroups([]);
        setBrainDumps([]);
        setTranslations([]);
        useUIStore.getState().resetUIState();
        hasLoadedOnce.current = false;
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 🛡️ ACCIDENTAL REFRESH PROTECTION: Warning if there are pending saves
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        const hasPending = Object.keys(pendingUpdatesRef.current).length > 0;
        if (hasPending) {
            e.preventDefault();
            e.returnValue = ''; // Standard way to show native confirmation dialog
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // 📡 REALTIME SYNC - Listeners para sincronización entre dispositivos
  useEffect(() => {
    if (!session) return;

    const summaryChannel = supabase
      .channel('summaries-global-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'summaries' }, () => {
        if (summaryCountDebounceRef.current) clearTimeout(summaryCountDebounceRef.current);
        summaryCountDebounceRef.current = setTimeout(() => fetchSummaryCounts(), 1000);
      })
      .subscribe();

    const channel = supabase
      .channel('global-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          // Solo agregar si no existe ya en el estado local
          setGroups(prev => prev.map(g => {
            if (g.id !== payload.new.group_id) return g;
            const yaExiste = g.notes.some(n => n.id === payload.new.id);
            if (yaExiste) return g;
            return { ...g, notes: sortNotesArray([...(g.notes || []), payload.new as Note], noteSortMode) };
          }));
        } else if (payload.eventType === 'UPDATE') {
          // 🚀 OPTIMIZATION: Actualización granular para no colapsar notas ni recargar todo
          updateNoteSync(payload.new.id, payload.new as Partial<Note>);
        } else if (payload.eventType === 'DELETE') {
          deleteNoteSync(payload.old.id);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          // 🚀 OPTIMIZATION: Evitar recarga si nosotros ya lo agregamos localmente
          setGroups(prev => {
            if (prev.find(g => g.id === payload.new.id)) return prev;
            const newGroup: Group = {
              id: payload.new.id,
              title: payload.new.name,
              user_id: payload.new.user_id,
              is_pinned: payload.new.is_pinned,
              is_favorite: payload.new.is_favorite,
              last_accessed_at: payload.new.last_accessed_at,
              notes: []
            };
            return [...prev, newGroup];
          });
        } else if (payload.eventType === 'UPDATE') {
          updateGroupSync(payload.new.id, { 
            title: payload.new.name, 
            is_pinned: payload.new.is_pinned,
            is_favorite: payload.new.is_favorite
          });
        } else {
          fetchData(); 
        }
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
        if (payload.eventType === 'INSERT') {
          setBrainDumps(prev => {
            if (prev.find(d => d.id === payload.new.id)) return prev;
            return [payload.new as BrainDump, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          setBrainDumps(prev => prev.map(d => d.id === payload.new.id ? (payload.new as BrainDump) : d));
        } else if (payload.eventType === 'DELETE') {
          setBrainDumps(prev => prev.filter(d => d.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tiktok_videos' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTikTokVideos(prev => {
            if (prev.find(v => v.id === payload.new.id)) return prev;
            return [payload.new as TikTokVideo, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          updateTikTokVideoSync(payload.new.id, payload.new as Partial<TikTokVideo>);
        } else if (payload.eventType === 'DELETE') {
          deleteTikTokVideoSync(payload.old.id);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tiktok_queue' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTikTokQueueItems(prev => {
            if (prev.find(q => q.id === payload.new.id)) return prev;
            return [payload.new as TikTokQueueItem, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          updateTikTokQueueItemSync(payload.new.id, payload.new as Partial<TikTokQueueItem>);
        } else if (payload.eventType === 'DELETE') {
          deleteTikTokQueueItemSync(payload.old.id);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(summaryChannel);
    };
  }, [session]);

  const fetchSummaryCounts = async (overrideSession?: Session | null) => {
    const activeSession = overrideSession || sessionRef.current;
    if (!activeSession) return;
    try {
      const { data, error } = await supabase.from('summaries').select('note_id').eq('user_id', activeSession.user.id);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach(s => { counts[s.note_id] = (counts[s.note_id] || 0) + 1; });
      setSummaryCounts(counts);
    } catch (err) {
      console.error('Error counts:', err);
    }
  };

  const fetchTranslations = async (overrideSession?: Session | null) => {
    const activeSession = overrideSession || sessionRef.current;
    if (!activeSession) return;
    const { data } = await supabase.from('translations').select('*').eq('user_id', activeSession.user.id).order('created_at', { ascending: false });
    if (data) setTranslations(data);
  };

  const fetchBrainDumps = async (overrideSession?: Session | null) => {
    const activeSession = overrideSession || sessionRef.current;
    if (!activeSession) return;
    const { data } = await supabase.from('brain_dumps').select('*').eq('user_id', activeSession.user.id).order('updated_at', { ascending: false });
    if (data) setBrainDumps(data);
  };

  const fetchTikTokVideos = async (overrideSession?: Session | null) => {
    const activeSession = overrideSession || sessionRef.current;
    if (!activeSession) return;
    const { data } = await supabase.from('tiktok_videos').select('*').eq('user_id', activeSession.user.id).order('created_at', { ascending: false });
    if (data) setTikTokVideos(data as TikTokVideo[]);
  };

  const fetchTikTokQueue = async (overrideSession?: Session | null) => {
    const activeSession = overrideSession || sessionRef.current;
    if (!activeSession) return;
    const { data } = await supabase.from('tiktok_queue').select('*').eq('user_id', activeSession.user.id).order('created_at', { ascending: false });
    if (data) setTikTokQueueItems(data as TikTokQueueItem[]);
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
        // Redundant fetchTranslations/fetchBrainDumps were here; fetchData already calls them.
        fetchData();
    };
    window.addEventListener('reload-app-data', handleReload);
    return () => window.removeEventListener('reload-app-data', handleReload);
  }, []); // [] is now safe because handleReload calls fetchData/translations/dumps which use sessionRef (indirectly via their definitions) or current state if reactive.

  const fetchData = async (overrideSession?: Session | null) => {
    const activeSession = overrideSession || sessionRef.current;
    if (!activeSession) return;
    if (!hasLoadedOnce.current) setLoading(true);
    try {
      const { data: groupsData, error: groupsError } = await supabase.from('groups').select('*').order('created_at', { ascending: true });
      if (groupsError) throw groupsError;

      // 📡 Carga inicial de Pizarrones, Traducciones y TikTok
      fetchBrainDumps(activeSession);
      fetchTranslations(activeSession);
      fetchSummaryCounts(activeSession);
      fetchTikTokVideos(activeSession);
      fetchTikTokQueue(activeSession);

      const { data: notesData, error: notesError } = await supabase.from('notes').select('*').order('position', { ascending: true });
      if (notesError) throw notesError;

      const store = useUIStore.getState();
      const currentSortPref = store.noteSortMode;
      const openNotes = store.openNotesByGroup;

      const mergedGroups: Group[] = (groupsData || []).map(g => {
        // Use n.is_open from DB for initial load, then the store's openNotes state
        const storedOpenIds = openNotes[g.id] || [];
        let groupNotes: Note[] = (notesData || []).filter(n => n.group_id === g.id).map(n => ({ 
          ...n, 
          isOpen: !hasLoadedOnce.current ? !!n.is_open : storedOpenIds.includes(n.id) 
        }));
        groupNotes = sortNotesArray(groupNotes, currentSortPref);

        return {
          id: g.id,
          title: g.name,
          user_id: g.user_id,
          is_pinned: g.is_pinned,
          is_favorite: g.is_favorite,
          last_accessed_at: g.last_accessed_at,
          notes: groupNotes
        };
      });

      setGroups(mergedGroups);
      hasLoadedOnce.current = true;

      // FIX: No resetear el activeGroupId agresivamente si hay una carga de Realtime en curso
      // Solo si el grupo REALMENTE ya no existe en la base de datos tras un periodo de gracia
      if (activeGroupId && mergedGroups.length > 0 && !mergedGroups.find(g => g.id === activeGroupId)) {
        // console.log("Active group not found in sync, but skipping force reset to avoid flicker during inserts");
      }
    } catch (error: any) {
      console.error('Error fetching data:', error.message);
      alert('Error cargando datos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel('tiktok_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tiktok_videos', filter: `user_id=eq.${session.user.id}` }, () => {
        fetchTikTokVideos(session);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tiktok_queue', filter: `user_id=eq.${session.user.id}` }, () => {
        fetchTikTokQueue(session);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    // Emitir evento para que componentes internos se enteren del cambio técnico de clase
    window.dispatchEvent(new CustomEvent('app-theme-changed'));
  }, [theme]);

  const applyManualSort = (mode: NoteSortMode) => {
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

      const newNote: Note = { id: noteData.id, title: noteData.title, content: noteData.content || '', isOpen: true, created_at: noteData.created_at, group_id: noteData.group_id, position: noteData.position, order_index: noteData.order_index };
      const newGroup: Group = { id: groupData.id, title: groupData.name, notes: [newNote], user_id: groupData.user_id, is_pinned: false, last_accessed_at: new Date().toISOString() };
      
      // 🚀 ATOMIC STATE UPDATE
      setGroups(prev => [...prev, newGroup]);
      
      useUIStore.setState((state) => ({
        activeGroupId: newGroup.id,
        dockedGroupIds: state.dockedGroupIds.includes(newGroup.id) ? state.dockedGroupIds : [...state.dockedGroupIds, newGroup.id],
        globalView: 'notes',
        openNotesByGroup: {
          ...state.openNotesByGroup,
          [newGroup.id]: [newNote.id]
        },
        focusedNoteByGroup: {
          ...state.focusedNoteByGroup,
          [newGroup.id]: newNote.id
        },
        lastActiveNoteByGroup: {
          ...state.lastActiveNoteByGroup,
          [newGroup.id]: newNote.id
        }
      }));

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

  const toggleGroupFavorite = async (groupId: string, currentFavoriteStatus: boolean) => {
    const newStatus = !currentFavoriteStatus;
    setGroups(groups.map(g => g.id === groupId ? { ...g, is_favorite: newStatus } : g));
    try {
      const { error } = await supabase.from('groups').update({ is_favorite: newStatus }).eq('id', groupId);
      if (error) throw error;
    } catch (error: any) {
      setGroups(groups.map(g => g.id === groupId ? { ...g, is_favorite: currentFavoriteStatus } : g));
      alert('Error al actualizar favorito: ' + error.message);
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
      const status = 'main'; // Notes use 'main' as default for visibility
      const orderIndex = getNewOrderIndex();

      const { data, error } = await supabase.from('notes').insert([{ 
        title: '', 
        content: '', 
        group_id: activeGroupId, 
        user_id: session.user.id, 
        position,
        order_index: orderIndex
      }]).select().single();
      if (error) throw error;

      const newNote: Note = { id: data.id, title: data.title, content: data.content || '', isOpen: true, created_at: data.created_at, group_id: data.group_id, position: data.position, order_index: data.order_index };

      // Identificar si hay alguna nota abierta para insertar debajo
      const openNotes = openNotesByGroup[activeGroupId] || [];
      const firstOpenNoteId = openNotes.length > 0 ? openNotes[0] : null;

      setGroups(groups.map(g => {
        if (g.id === activeGroupId) {
          const newNotes = [...g.notes, newNote];
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

  const createNoteFromAI = async (content: string, title: string, groupId?: string, orderIndex?: number, parentNoteId?: string) => {
    if (!session) return;
    try {
      let targetGroupId = groupId || activeGroupId;
      
      // Si recibimos parentNoteId, intentamos deducir el groupId de esa nota padre
      if (parentNoteId) {
        const parentNote = groups.flatMap(g => g.notes).find(n => n.id === parentNoteId);
        if (parentNote) targetGroupId = parentNote.group_id;
      }
      
      if (!targetGroupId) return;

      const currentGroup = groups.find(g => g.id === targetGroupId);
      const position = currentGroup ? currentGroup.notes.length : 0;
      
      const insertPayload: any = { 
        title, 
        content: content || '', 
        group_id: targetGroupId, 
        user_id: session.user.id, 
        position, 
        parent_note_id: parentNoteId
      };

      if (orderIndex !== undefined) {
        insertPayload.order_index = orderIndex;
      } else {
        insertPayload.order_index = getNewOrderIndex();
      }

      const { data, error } = await supabase.from('notes').insert([insertPayload]).select().single();

      if (error) throw error;

      const newNote: Note = {
        id: data.id,
        title: data.title,
        content: data.content || '',
        isOpen: true,
        created_at: data.created_at,
        group_id: data.group_id,
        position: data.position,
        parent_note_id: data.parent_note_id,
        order_index: data.order_index
      };

      setGroups(currentGroups => currentGroups.map(g => {
        if (g.id === targetGroupId) {
          // Si es un sub-nota, el parent_note_id ya está en newNote.
          // App.tsx el map principal solo muestra !parent_note_id
          return { ...g, notes: [...g.notes, newNote] };
        }
        return g;
      }));

      // Solo enfocar y scrollear si NO es una subnota (para no cerrar la vista actual)
      if (!parentNoteId) {
        setEditingNoteId(newNote.id);
        setFocusedNoteId(newNote.id);

        setTimeout(() => {
          const noteElement = document.getElementById(`note-${newNote.id}`);
          if (noteElement) {
            noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 200);
      }

      return newNote.id;
    } catch (error: any) {
      alert('Error al crear nota desde AI: ' + error.message);
      return null;
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
    if (updates.scratchpad !== undefined) dbUpdates.scratchpad = updates.scratchpad;
    if (updates.is_open !== undefined) dbUpdates.is_open = updates.is_open;
    if (updates.is_pinned !== undefined) dbUpdates.is_pinned = updates.is_pinned;
    if (updates.is_docked !== undefined) dbUpdates.is_docked = updates.is_docked;
    if (updates.is_checklist !== undefined) dbUpdates.is_checklist = updates.is_checklist;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.group_id !== undefined) dbUpdates.group_id = updates.group_id;

    const isTextUpdate = updates.title !== undefined || updates.content !== undefined || updates.scratchpad !== undefined;
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
    
    // Acumular actualizaciones para no perder cambios intermedios (ej: título -> contenido rápido)
    if (!pendingUpdatesRef.current[noteId]) pendingUpdatesRef.current[noteId] = {};
    Object.assign(pendingUpdatesRef.current[noteId], dbUpdates);

    // 🚀 FIX: Los títulos y cambios de estado (archivo, fijar, mover) se guardan inmediatamente.
    const pendingKeys = Object.keys(pendingUpdatesRef.current[noteId]).filter(k => k !== 'updated_at');
    const isStateUpdate = updates.status !== undefined || updates.is_pinned !== undefined || updates.is_docked !== undefined || updates.group_id !== undefined;
    const isTitleOnly = updates.title !== undefined && !('content' in pendingUpdatesRef.current[noteId]) && pendingKeys.length === 1;
    const debounceTime = (isTitleOnly || isStateUpdate) ? 0 : 1000; // Solo debouncing para contenido/scratchpad

    setNoteSaveStatus(prev => ({ ...prev, [noteId]: 'saving' }));

    if (saveTimeoutRef.current[noteId]) {
      clearTimeout(saveTimeoutRef.current[noteId]);
    }

    const executeUpdate = async () => {
      const finalUpdates = { ...pendingUpdatesRef.current[noteId] };
      delete pendingUpdatesRef.current[noteId];
      if (!finalUpdates || Object.keys(finalUpdates).length === 0) return;

      try {
        const { error } = await supabase.from('notes').update(finalUpdates).eq('id', noteId);
        if (error) throw error;
        
        setNoteSaveStatus(prev => ({ ...prev, [noteId]: 'saved' }));
        setTimeout(() => {
            setNoteSaveStatus(prev => {
                const newState = { ...prev };
                if (newState[noteId] === 'saved') delete newState[noteId];
                return newState;
            });
        }, 2000);

        // Sincronización dual hacia Kanban
        if (finalUpdates.title !== undefined) {
            await supabase.from('tasks')
                .update({ title: finalUpdates.title })
                .eq('id', noteId);
            
            window.dispatchEvent(new CustomEvent('kanban-refetch'));
        }
      } catch (error: any) {
        console.error('Error updating note:', error.message);
        setNoteSaveStatus(prev => ({ ...prev, [noteId]: 'idle' }));
      } finally {
        delete saveTimeoutRef.current[noteId];
      }
    };

    if (debounceTime === 0) {
      executeUpdate();
    } else {
      saveTimeoutRef.current[noteId] = setTimeout(executeUpdate, debounceTime);
    }
  };

  const archiveNote = (noteId: string) => {
    updateNote(noteId, { status: 'history' });
    setFocusedNoteId(null);
  };

  const restoreNote = (noteId: string) => {
    updateNote(noteId, { status: 'main' });
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
      .replace(/\[\[(ins|idea|op|duda|wow|pat|yo|ruido):[^\|]+\|([^\]]+)\]\]/g, '$2') // Strip markers
      .replace(/\[\[tr:[^|]*\|([^\]]*)\]\]/g, '$1');     // Strip translation marks, keep original text

  const extractMarkersFromContent = (text: string) => {
    const markers: { type: string; timestamp: string; content: string }[] = [];
    const regex = /\[\[(ins|idea|op|duda|wow|pat|yo|ruido):([^\|]+)\|([^\]]+)\]\]/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      markers.push({ type: match[1], timestamp: match[2], content: match[3] });
    }
    return markers;
  };

  const checkNoteSearchMatch = (note: Note, query: string, allNotes: Note[], summaries: any[]): boolean => {
    if (!query) return false;
    const q = query.toLowerCase();
    
    // 1. Check title & content
    if (note.title?.toLowerCase().includes(q) || note.content?.toLowerCase().includes(q)) return true;
    
    // 2. Check scratchpad
    if (note.scratchpad?.toLowerCase().includes(q)) return true;
    
    // 3. Check summaries
    const noteSummaries = summaries.filter(s => s.note_id === note.id);
    if (noteSummaries.some(s => 
      s.content?.toLowerCase().includes(q) || 
      s.target_objective?.toLowerCase().includes(q) || 
      s.scratchpad?.toLowerCase().includes(q)
    )) return true;
    
    // 4. Check subnotes (children) recursively
    const children = allNotes.filter(n => n.parent_note_id === note.id);
    return children.some(child => checkNoteSearchMatch(child, query, allNotes, summaries));
  };

  const getRecursiveNoteMarkdown = async (noteId: string, depth: number, allNotes: Note[], allSummaries: any[]): Promise<string> => {
    const note = allNotes.find(n => n.id === noteId);
    if (!note) return "";

    const formatNoteDate = (dateString?: string) => {
      if (!dateString) return 'Desconocida';
      return new Date(dateString).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    let md = `${"#".repeat(depth)} ${note.title || 'Sin título'}\n\n`;
    md += `Fecha creación: ${formatNoteDate(note.created_at)}\n`;
    md += `Última edición: ${formatNoteDate(note.updated_at || note.created_at)}\n\n`;
    
    const content = cleanMarkdownForExport(note.content || '');
    if (content) md += `${content}\n\n`;

    // Pizarrón (scratchpad) de esta nota
    if (note.scratchpad && note.scratchpad.trim()) {
      md += `${"#".repeat(depth + 1)} Pizarrón de: ${note.title || 'Sin título'}\n\n`;
      md += `${note.scratchpad}\n\n`;
    }

    // Resúmenes AI vinculados a esta nota
    const summaries = allSummaries.filter(s => s.note_id === noteId);
    for (const s of summaries) {
      md += `${"#".repeat(depth + 1)} Análisis: ${s.target_objective || 'Sin objetivo'}\n\n`;
      md += `${s.content}\n\n`;
      if (s.scratchpad && s.scratchpad.trim()) {
        md += `${"#".repeat(depth + 2)} Pizarrón del Análisis\n\n`;
        md += `${s.scratchpad}\n\n`;
      }
    }

    // Subnotas (recursivo)
    const subnotes = allNotes.filter(n => n.parent_note_id === noteId)
      .sort((a, b) => (a.position || 0) - (b.position || 0));
    
    for (const sub of subnotes) {
      md += "\n---\n\n";
      md += await getRecursiveNoteMarkdown(sub.id, depth + 1, allNotes, allSummaries);
    }

    return md;
  };

  const downloadGroupAsMarkdown = async () => {
    if (!activeGroup) return;
    
    const allGroupNotes = activeGroup.notes;
    const rootNotes = allGroupNotes.filter(n => !n.parent_note_id).sort((a, b) => {
        const titleA = a.title || 'Sin título';
        const titleB = b.title || 'Sin título';
        return titleA.localeCompare(titleB);
    });

    const noteIds = allGroupNotes.map(n => n.id);
    const { data: allSummaries } = await supabase.from('summaries').select('*').in('note_id', noteIds);

    let fullMd = `# Grupo: ${activeGroup.title}\n\n`;
    
    for (const note of rootNotes) {
        fullMd += await getRecursiveNoteMarkdown(note.id, 1, allGroupNotes, allSummaries || []);
        fullMd += "\n\n================================================================================\n\n";
    }

    const blob = new Blob([fullMd], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeGroup.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_completo.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadNoteAsMarkdown = async (note: Note) => {
    if (!activeGroupId) return;
    
    // Obtener todas las notas del grupo para tener el árbol completo
    const currentGroup = groups.find(g => g.id === activeGroupId);
    const allGroupNotes = currentGroup?.notes || [];
    
    // Obtener IDs de todas las notas en el árbol de esta nota (recursivo)
    const getChildrenIds = (id: string): string[] => {
      const children = allGroupNotes.filter(n => n.parent_note_id === id);
      return [id, ...children.flatMap(c => getChildrenIds(c.id))];
    };
    const treeIds = getChildrenIds(note.id);
    
    // Buscar todos los summaries de estas notas
    const { data: allSummaries } = await supabase.from('summaries').select('*').in('note_id', treeIds);

    const mdContent = await getRecursiveNoteMarkdown(note.id, 1, allGroupNotes, allSummaries || []);
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${(note.title || 'nota_completa').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`);
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
      // 🚀 Lógica de Título Secuencial
      const baseTitle = original.title || 'Sin título';
      
      // 1. Limpiar el título base de cualquier sufijo numérico existente (ej: "Nota 2" -> "Nota")
      const titleMatch = baseTitle.match(/^(.*?)(?:\s+(\d+))?$/);
      const pureTitle = titleMatch ? titleMatch[1].trim() : baseTitle;

      // 2. Buscar el número más alto en el grupo que coincida con ese título base
      const existingNumbers = currentGroup.notes
        .map(n => {
          const match = (n.title || '').match(new RegExp(`^${pureTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+(\\d+))?$`));
          if (match) {
            return match[1] ? parseInt(match[1], 10) : 1;
          }
          return null;
        })
        .filter((n): n is number => n !== null);

      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 2;
      const newTitle = `${pureTitle} ${nextNumber}`;

      const position = currentGroup.notes.length;
      const { data, error } = await supabase.from('notes').insert([{
        title: newTitle,
        content: original.content || '',
        group_id: activeGroupId,
        user_id: session.user.id,
        position,
        is_checklist: original.is_checklist || false,
        created_at: original.created_at, // Heredar fecha de creación
        updated_at: original.updated_at,  // Heredar fecha de actualización
        order_index: original.order_index ? original.order_index + 0.0001 : position
      }]).select().single();

      if (error) throw error;
      const newNote: Note = { 
        id: data.id, 
        title: data.title, 
        content: data.content || '', 
        isOpen: true, 
        created_at: data.created_at, 
        updated_at: data.updated_at,
        group_id: data.group_id, 
        position: data.position, 
        is_checklist: data.is_checklist,
        order_index: data.order_index
      };
      
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

      setFocusedNoteId(newNote.id);

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
    <div className="flex h-screen bg-zinc-50 dark:bg-[#13131A] overflow-hidden transition-colors duration-300">
      {!isZenMode && (
        <Sidebar
          groups={groups}
          activeGroupId={activeGroupId}
          onSelectGroup={(id) => { 
            setActiveGroup(id); 
            setGlobalView('notes');
            setSidebarFocusMode('group');
            // Al hacer clic en el grupo, ya NO le quitamos el foco a las notas
            // para que se mantenga el contexto como en el Pizarrón.
          }}
          onAddGroup={() => { addGroup(); setIsGlobalNoteTrayOpen(true); }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onTogglePin={toggleGroupPin}
          onToggleFavorite={toggleGroupFavorite}
          onLogout={handleLogout}
          onSelectDockedNote={(groupId, noteId) => {
            const isAlreadyFocused = focusedNoteByGroup[groupId] === noteId;
            const currentOpen = openNotesByGroup[groupId] || [];
            const isOpen = currentOpen.includes(noteId);

            if (isAlreadyFocused && globalView === 'notes') {
              // ELIMINADO LOGICA DE TOGGLE OFF DESDE EL SIDEBAR
              // Si ya está enfocada y estamos en la vista de notas, no hacemos nada.
              return;
            } else {
              // Toggle ON or Switch
              setActiveGroup(groupId);
              setGlobalView('notes');
              if (!isOpen) toggleNote(groupId, noteId);
              setFocusedNoteId(noteId, groupId);
              setIsGlobalNoteTrayOpen(true, groupId);
              setSidebarFocusMode('note');
            }
          }}
          focusedNoteId={focusedNoteId}
        />
      )}

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
          .note-editor-scroll::-webkit-scrollbar-thumb { background-color: #e4e4e7; border-radius: 99px; border: 2px solid transparent; background-clip: content-box; }
          .note-editor-scroll::-webkit-scrollbar-thumb:hover { background-color: #d4d4d8; }
          .dark .note-editor-scroll::-webkit-scrollbar-thumb { background-color: #3f3f46; }
          .dark .note-editor-scroll::-webkit-scrollbar-thumb:hover { background-color: #52525b; }
          .note-editor-scroll { scrollbar-width: thin; scrollbar-color: #e4e4e7 transparent; }
          .dark .note-editor-scroll { scrollbar-color: #3f3f46 transparent; }
          
          ::selection {
            background-color: rgba(73, 64, 217, 0.75);
            color: #ffffff !important;
          }
          ::-moz-selection {
            background-color: rgba(73, 64, 217, 0.75);
            color: #ffffff !important;
          }

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
          {!isZenMode && realShowOverdueMarquee && overdueRemindersList.length > 0 && (
            <div className="w-full bg-[#FAFAFA] dark:bg-[#13131A] overflow-hidden shrink-0 border-b border-zinc-200 dark:border-zinc-800">
              <div className="py-2.5 flex items-center">
                <div className="flex-1 overflow-hidden relative h-6 flex items-center">
                  <div className="marquee-content text-[11px] font-bold tracking-[0.1em] text-zinc-800 dark:text-[#D5D6D8] uppercase">
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
         globalView === 'braindump' ? <BrainDumpApp 
             showLineNumbers={showLineNumbers}
             onToggleLineNumbers={() => { const next = !showLineNumbers; setShowLineNumbers(next); localStorage.setItem("app-show-line-numbers", String(next)); }}
            session={session!} 
            noteFont={noteFont} 
            noteFontSize={noteFontSize} 
            noteLineHeight={noteLineHeight} 
            searchQuery={currentSearchQuery} 
            setSearchQuery={(q) => {
              if (globalView === 'braindump') setSearchQuery('braindump', q);
              else if (activeGroupId) setSearchQuery(activeGroupId, q);
              setSearchExemptNoteIds(new Set());
            }}
            allSummaries={allPizarronSummaries}
            groups={groups} 
            onOpenNote={(groupId, noteId) => {
              setActiveGroup(groupId);
              setEditingNoteId(noteId);
              setFocusedNoteId(noteId);
              setGlobalView('notes');
            }} 
          /> :
          globalView === 'translator' ? <TranslatorApp session={session!} /> :
          globalView === 'tiktok' ? <TikTokApp 
            session={session!} 
            showLineNumbers={showLineNumbers}
            onToggleLineNumbers={() => { const next = !showLineNumbers; setShowLineNumbers(next); localStorage.setItem("app-show-line-numbers", String(next)); }}
            allSummaries={allTikTokSummaries}
            allSubnotes={allTikTokSubnotes}
            searchQuery={currentSearchQuery}
            onSearchQueryChange={(q) => {
              setSearchQuery('tiktok', q);
              setSearchExemptNoteIds(new Set());
            }}
          /> : (
          <>
            {!isZenMode && (
              <div className="flex flex-col shrink-0">
                <div className={`sticky top-0 z-30 bg-white/80 dark:bg-[#13131A]/90 backdrop-blur-md shrink-0 border-b border-zinc-200 dark:border-zinc-800 shadow-sm transition-all`}>
                  <div className={`min-h-[72px] h-auto flex flex-col items-center justify-center`}>

                    <div className="max-w-6xl mx-auto w-full flex flex-col lg:flex-row lg:items-center justify-between px-0 gap-4">



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
                              className="w-full bg-transparent text-xl md:text-2xl font-bold text-zinc-800 dark:text-[#CCCCCC] outline-none px-2 cursor-text truncate placeholder-zinc-400"
                              placeholder="Nombre del grupo de notas ..."
                              title="Haz clic para editar"
                            />
                          </div>
                      </div>

                          {/* Lado Derecho: Controles de Grupo y Acciones */}
                      <div className="flex flex-wrap items-center gap-3 shrink-0 pb-1 md:pb-0">
                          
                          {/* Buscador (Posicionado como en TikTok) */}
                          <div className="relative flex items-center group">
                            <Search size={15} className={`absolute left-3 pointer-events-none transition-colors ${currentSearchQuery.trim() ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-500'}`} />
                            <input 
                              type="text" 
                              placeholder="Buscar..." 
                              value={currentSearchQuery} 
                              onChange={(e) => {
                                if (activeGroupId) setSearchQuery(activeGroupId, e.target.value);
                                setSearchExemptNoteIds(new Set());
                              }}
                              className={`h-9 pl-9 pr-8 rounded-xl border transition-all outline-none text-xs w-32 md:w-32 lg:w-40 ${currentSearchQuery.trim() ? 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 font-semibold placeholder-amber-700/50 dark:placeholder-amber-400/50' : 'bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-indigo-500/50 dark:focus:border-indigo-500/50'}`}
                            />
                            {currentSearchQuery.trim() && (
                              <button onClick={() => { if (activeGroupId) setSearchQuery(activeGroupId, ''); setSearchExemptNoteIds(new Set()); }} className="absolute right-2 p-1 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-full transition-colors" title="Limpiar búsqueda">
                                <X size={14} />
                              </button>
                            )}
                          </div>

                          {/* Botones de Estado/Vista (Bell, Tray, Maximize) */}

                          {/* 1. Botones de Estado/Vista (Bell, Tray, Maximize, Sort) - Independientes como en Pizarrón */}
                          <button
                            onClick={() => overdueRemindersCount > 0 && setShowOverdueMarquee(!showOverdueMarquee)}
                            disabled={overdueRemindersCount === 0}
                            className={`h-9 px-3 rounded-xl transition-all active:scale-[0.98] shrink-0 flex items-center gap-2 border ${
                              showOverdueMarquee 
                                ? 'bg-[#DC2626] border-red-400 text-white shadow-sm shadow-red-600/20' 
                                : overdueRemindersCount > 0
                                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40'
                                  : 'bg-white dark:bg-[#1A1A24] border-zinc-200 dark:border-[#2D2D42] text-zinc-400 opacity-60 cursor-not-allowed'
                            }`}
                            title={overdueRemindersCount === 0 ? "No hay recordatorios vencidos" : showOverdueMarquee ? "Ocultar Recordatorios" : "Mostrar Recordatorios"}
                          >
                            <Bell size={18} className={overdueRemindersCount > 0 ? `animate-pulse ${showOverdueMarquee ? 'text-white' : 'text-red-500'}` : ''} />
                            {overdueRemindersCount > 0 && (
                              <span className={`text-xs font-bold whitespace-nowrap ${showOverdueMarquee ? 'text-white' : ''}`}>
                                {overdueRemindersCount}
                              </span>
                            )}
                          </button>

                             <button 
                                onClick={() => setIsGlobalNoteTrayOpen(!isGlobalNoteTrayOpen)}
                                className={`h-9 px-3 rounded-xl transition-all active:scale-[0.98] shrink-0 flex items-center gap-2 border ${
                                  isGlobalNoteTrayOpen 
                                    ? 'bg-[#4940D9] border-[#4940D9] text-white shadow-sm shadow-[#4940D9]/20' 
                                    : 'bg-[#4940D9]/10 dark:bg-[#4940D9]/20 border-[#4940D9]/30 text-indigo-500 dark:text-indigo-400 hover:bg-[#4940D9]/20 dark:hover:bg-[#4940D9]/30'
                                }`}
                                title={isGlobalNoteTrayOpen ? "Ocultar bandeja de notas" : "Mostrar bandeja de notas"}
                              >
                                 <ChevronsDownUp size={18} className={`transition-transform duration-300 ${isGlobalNoteTrayOpen ? 'rotate-180' : ''}`} />
                                 <span className="text-xs font-bold">{activeGroup.notes.filter(n => !n.parent_note_id).length}</span>
                              </button>

                              {/* Botón Maximizar/Minimizar */}
                             <button
                               onClick={() => setIsMaximized(!isMaximized)}
                               className="h-9 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-95 shrink-0"
                               title={isMaximized ? "Minimizar" : "Maximizar"}
                             >
                               {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                             </button>
                              <div className="relative" ref={sortMenuRef}>
                               <button 
                                   onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} 
                                   className="h-9 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center gap-2 active:scale-95"
                                   title="Ordenar notas"
                               >
                                   <ArrowUpDown size={16} />
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

                                   <button onClick={() => applyManualSort('created-desc')} className={`flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg transition-colors ${noteSortMode === 'created-desc' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium'}`}>
                                     <Calendar size={14} /> Creación (reciente)
                                     {noteSortMode === 'created-desc' && <Check size={14} className="ml-auto" />}
                                   </button>
                                   <button onClick={() => applyManualSort('created-asc')} className={`flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg transition-colors ${noteSortMode === 'created-asc' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium'}`}>
                                     <Calendar size={14} /> Creación (antigua)
                                     {noteSortMode === 'created-asc' && <Check size={14} className="ml-auto" />}
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

                          {/* Controles de Grupo (En una mini-cápsula gris) */}
                          <div className="flex items-center gap-2 shrink-0 bg-white dark:bg-[#1A1A24] border border-zinc-200 dark:border-[#2D2D42] rounded-xl p-1 shadow-sm">



                              <button 
                                  onClick={downloadGroupAsMarkdown} 
                                  className="p-1.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                  title="Exportar Grupo"
                              >
                                  <Download size={16} />
                              </button>
                              <button 
                                  onClick={() => deleteGroup(activeGroup.id)} 
                                  className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  title="Eliminar Grupo"
                              >
                                  <Trash2 size={16} />
                              </button>
                          </div>

                          {/* Botón Principal (Nueva Nota) */}
                          <button 
                              onClick={addNote} 
                              className="h-9 bg-[#4940D9] hover:bg-[#3D35C0] text-white px-4 py-2 rounded-xl shadow-lg shadow-[#4940D9]/20 transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0"
                          >
                              <Plus size={18} /> 
                              <span className="text-sm font-normal hidden sm:inline pr-1 text-white">Nota
</span>
                          </button>
                      </div>
                    </>
                 ) : (
                    <>
                      <h1 className="text-xl font-bold text-zinc-800 dark:text-[#CCCCCC] flex items-center gap-3">
                        <div className="h-9 p-2 bg-[#4940D9] hover:bg-[#3D35C0] rounded-lg text-white shadow-md hover:shadow-lg hover:shadow-[#4940D9]/30 transition-all cursor-default">
                          <StickyNote size={20} />
                        </div>
                        Grupos de notas
                      </h1>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Botón Toggle Reminder */}
                          <button
                            onClick={() => overdueRemindersCount > 0 && setShowOverdueMarquee(!showOverdueMarquee)}
                            disabled={overdueRemindersCount === 0}
                            className={`h-9 px-3 rounded-xl transition-all active:scale-[0.98] shrink-0 flex items-center gap-2 border ${
                              showOverdueMarquee 
                                ? 'bg-[#DC2626] border-red-400 text-white shadow-sm shadow-red-600/20' 
                                : overdueRemindersCount > 0
                                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40'
                                  : 'bg-white dark:bg-[#1A1A24] border-zinc-200 dark:border-[#2D2D42] text-zinc-400 opacity-60 cursor-not-allowed'
                            }`}
                            title={overdueRemindersCount === 0 ? "No hay recordatorios vencidos" : showOverdueMarquee ? "Ocultar Recordatorios" : "Mostrar Recordatorios"}
                          >
                            <Bell size={18} className={overdueRemindersCount > 0 ? `animate-pulse ${showOverdueMarquee ? 'text-white' : 'text-red-500'}` : ''} />
                            {overdueRemindersCount > 0 && (
                              <span className={`text-xs font-bold whitespace-nowrap ${showOverdueMarquee ? 'text-white' : ''}`}>
                                {overdueRemindersCount}
                              </span>
                            )}
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
                  </div>
                </div>
              </div>
            )}


                {/* 2. FRANJA DE NOTAS (INTEGRADA EN EL ENCABEZADO) */}
                {!isZenMode && isGlobalNoteTrayOpen && activeGroup && (

                  <div className="pt-[2px] bg-[#FAFAFA] dark:bg-[#13131A] relative group/tray">
                      <div className="max-w-6xl mx-auto relative px-0">
                          {/* Flecha Izquierda */}
                          {canScrollLeft && (
                            <div className={`absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#FAFAFA] dark:from-[#13131A] to-transparent z-10 flex items-center justify-start pointer-events-none transition-opacity duration-150 ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`}>
                              <button 
                                onClick={() => scrollTabs('left')} 
                                className={`p-1 rounded-full bg-white dark:bg-zinc-800 shadow-md text-zinc-500 hover:text-indigo-600 transition-all active:scale-95 border ${hasSearchMatchLeft ? 'border-amber-500 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,192,45,0.4)] scale-110' : 'border-zinc-200 dark:border-zinc-700'} ml-1 ${canScrollLeft ? 'pointer-events-auto' : 'pointer-events-none'}`}
                              >
                                <ChevronLeft size={14} />
                              </button>
                            </div>
                          )}
                          
                          {/* Contenedor de Tabs con onScroll */}
                          <div 
                            ref={scrollContainerRef}
                            onScroll={checkScroll}
                            className={`flex flex-nowrap items-center gap-4 overflow-x-auto hidden-scrollbar py-3 px-10 scroll-smooth transition-all ${(!canScrollLeft && !canScrollRight) ? 'justify-center' : 'justify-start'}`}
                          >
                      {sortNotesArray(activeGroup.notes.filter(n => !n.parent_note_id && n.status !== 'history'), noteSortMode)
                        .map(note => {
                          const isOpen = (openNotesByGroup[activeGroup.id] || []).includes(note.id);
                          const isFocused = focusedNoteId === note.id;
                          const isSelected = isFocused || (!focusedNoteId && activeNoteId === note.id);

                           // --- LÓGICA DE BÚSQUEDA ---
                           const query = currentSearchQuery.trim().toLowerCase();
                           const isSearchActive = !!query && checkNoteSearchMatch(note, query, activeGroup.notes, allGroupSummaries);

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
                                case 'backlog': dotColorClass = { bg: 'bg-[#9E9E9E]', hex: '#9E9E9E' }; break;
                                case 'todo': dotColorClass = { bg: 'bg-[#FFD60A]', hex: '#FFD60A' }; break;
                                case 'in_progress': dotColorClass = { bg: 'bg-[#38BDF8]', hex: '#38BDF8' }; break;
                                case 'done': dotColorClass = { bg: 'bg-[#4ADE80]', hex: '#4ADE80' }; break;
                            }
                          }

                          return (
                            <button
                              key={note.id}
                              data-is-match={isSearchActive}
                              onClick={() => {
                                const isNowFocused = focusedNoteId !== note.id;
                                const currentOpen = openNotesByGroup[activeGroup.id] || [];
                                const isOpen = currentOpen.includes(note.id);

                                if (isNowFocused) {
                                  setFocusedNoteId(note.id);
                                  if (!isOpen) toggleNote(activeGroup.id, note.id);
                                } else {
                                  setFocusedNoteId(null);
                                  if (isOpen) toggleNote(activeGroup.id, note.id);
                                }
                              }}
                              className={`relative flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${
                                isSelected
                                  ? `bg-[#4940D9] text-white border-[#4940D9] shadow-sm shadow-[#4940D9]/20 scale-[1.02] ${isSearchActive ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-[#FAFAFA] dark:ring-offset-[#13131A] shadow-[0_0_15px_rgba(251,192,45,0.4)]' : ''}`
                                  : isSearchActive
                                    ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-100 shadow-[0_0_10px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                                    : 'bg-zinc-100 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/40 hover:bg-zinc-200 dark:hover:bg-zinc-800/80 hover:text-indigo-600'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">

                                <div className={`p-1 rounded-md transition-colors ${isSelected ? 'bg-white/10 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'}`}>
                                  <FileText size={13} />
                                </div>
                                <span className="whitespace-nowrap">
                                  {highlightTitle(note.title || 'Sin Título')}
                                  {summaryCounts[note.id] > 0 && ` (${summaryCounts[note.id]})`}
                                </span>
                              </div>

                              {(note.is_docked || note.is_pinned) && (
                                <span className="flex items-center gap-[3px] ml-1">
                                  {note.is_docked && <span className={`inline-block w-[8px] h-[8px] rounded-full ${isFocused ? 'bg-white' : 'bg-[#85858C]'}`} />}
                                  {note.is_pinned && <Pin size={9} className={`fill-current ${isFocused ? 'text-white' : 'text-[#85858C]'}`} />}
                                </span>
                              )}
                              {dotColorClass && (
                                <div 
                                  className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border border-[#9F9FA8]/50 z-10 shadow-sm transition-transform hover:scale-110 ${(dotColorClass as any).bg}`} 
                                  style={{ boxShadow: `0 0 6px ${(dotColorClass as any).hex}88` }}
                                  title={`Estado Kanban`}
                                />
                              )}
                            </button>
                          );
                      })}
                      </div>

                      {/* Flecha Derecha */}
                      {canScrollRight && (
                        <div className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#FAFAFA] dark:from-[#13131A] to-transparent z-10 flex items-center justify-end pointer-events-none transition-opacity duration-150 ${canScrollRight ? 'opacity-100' : 'opacity-0'}`}>
                          <button 
                            onClick={() => scrollTabs('right')} 
                            className={`p-1 rounded-full bg-white dark:bg-zinc-800 shadow-md text-zinc-500 hover:text-indigo-600 transition-all active:scale-95 border ${hasSearchMatchRight ? 'border-amber-500 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,192,45,0.4)] scale-110' : 'border-zinc-200 dark:border-zinc-700'} mr-1 ${canScrollRight ? 'pointer-events-auto' : 'pointer-events-none'}`}
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}




              {/* AREA DE LA NOTA - OCUPA EL RESTO DEL ESPACIO */}
              <main ref={mainRef} className={`flex-1 flex flex-col overflow-hidden px-4 pb-4 ${!isZenMode && isGlobalNoteTrayOpen && activeGroup ? 'pt-0' : 'pt-5'}`}>

                <div className={`flex-1 flex flex-col min-h-0 ${isMaximized ? 'max-w-full' : 'max-w-6xl'} w-full mx-auto`}>
                  {activeGroup ? (
                    <div className="flex-1 flex flex-col min-h-0">
                      {activeGroup.notes.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-60">
                          <StickyNote size={48} className="text-zinc-300 mb-4" />
                          <p className="text-sm font-medium">Este grupo no tiene notas aún.</p>
                        </div>
                      ) : activeNoteId ? (
                        <div className="flex-1 flex flex-col min-h-0">
                          {activeGroup.notes
                            .filter(n => (mountedNoteIds.has(n.id) || n.id === activeNoteId) && !n.parent_note_id && n.status !== 'history')
                            .map(note => {
                              const isVisible = note.id === activeNoteId;
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
                                    allSummaries={allGroupSummaries}
                                    groupNotes={activeGroup.notes}
                                    isHighlightedBySearch={!!(currentSearchQuery.trim() && checkNoteSearchMatch(note, currentSearchQuery.trim(), activeGroup.notes, allGroupSummaries))}
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
                                      const willBeOpen = !wasOpen;

                                      toggleNote(activeGroup.id, note.id);
                                      handleUpdateNoteWrapper(note.id, { is_open: willBeOpen });

                                      if (wasOpen && store.noteSortMode) {
                                        applyManualSort(store.noteSortMode);
                                      }
                                    }}
                                    onUpdate={(id, updates) => handleUpdateNoteWrapper(id, updates)}
                                    onDelete={deleteNote}
                                    onArchive={archiveNote}
                                    onExportNote={downloadNoteAsMarkdown}
                                    onCopyNote={copyNoteToClipboard}
                                    onDuplicate={duplicateNote}
                                    onMove={moveNoteToGroup}
                                    groups={groups}
                                    noteFont={noteFont}
                                    noteFontSize={noteFontSize}
                                    noteLineHeight={noteLineHeight}
                                     onCreateNote={(c, t, p, d) => createNoteFromAI(c, t, activeGroup?.id, d as number, p as string)}
                                    session={session}
                                    syncStatus={noteSaveStatus[note.id] || 'idle'}
                                  />
                                </div>
                              );
                            })
                          }
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col overflow-y-auto hidden-scrollbar scroll-smooth">
                          <div className={`${isMaximized ? 'max-w-full' : 'max-w-6xl'} mx-auto w-full px-4 md:px-10 animate-fadeIn pb-10`}>
                            {/* DASHBOARD (GRID) */}
                            <div className={`grid ${isMaximized ? 'grid-cols-[repeat(auto-fit,340px)] w-full max-w-[2160px]' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl'} gap-6 justify-center mx-auto`}>


                            {activeGroup.notes.filter(n => !n.parent_note_id && n.status !== 'history').map(note => {
                              const isMatch = currentSearchQuery.trim() && checkNoteSearchMatch(note, currentSearchQuery.trim(), activeGroup.notes, allGroupSummaries);
                              return (
                                <div 
                                  key={note.id} 
                                  onClick={() => setActiveNoteId(activeGroupId!, note.id)} 
                                  className={`group bg-white dark:bg-[#1A1A24] border rounded-2xl p-5 hover:shadow-xl transition-all cursor-pointer flex flex-col gap-3 relative animate-fadeIn group/card ${
                                    isMatch 
                                      ? 'border-amber-500 shadow-[0_0_20px_rgba(251,192,45,0.2)]' 
                                      : 'border-zinc-200 dark:border-[#2D2D42] hover:border-[#4940D9]/40'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                     <h3 className="font-bold text-zinc-800 dark:text-[#CCCCCC] truncate flex-1">
                                        {currentSearchQuery.trim() ? highlightTitle(note.title || 'Sin Título') : (note.title || 'Sin Título')}
                                     </h3>
                                     <div className={`${globalTasks?.some(t => t.id === note.id || t.linked_note_id === note.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                        <KanbanSemaphore sourceType="note" sourceId={note.id} sourceTitle={note.title || ''} onInteract={() => setActiveNoteId(activeGroupId!, note.id)} />
                                     </div>
                                  </div>
                                  <div className="text-xs text-zinc-500 line-clamp-3 leading-relaxed min-h-[4.5em] overflow-hidden">
                                     {note.content || <span className="italic opacity-40">Nota vacía...</span>}
                                  </div>
                                  <div className="flex items-center justify-between pt-2 border-t border-zinc-50 dark:border-zinc-800/50 mt-auto">
                                      <span className="text-[10px] font-bold text-zinc-400">{new Date(note.created_at || '').toLocaleDateString()}</span>
                                      <div className="flex items-center gap-2">
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); updateNote(note.id, { is_pinned: !note.is_pinned }); }} 
                                            className={`p-1.5 rounded-lg transition-all active:scale-95 hover:bg-amber-50 dark:hover:bg-amber-900/20 ${note.is_pinned ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400 hover:text-amber-600'}`} 
                                            title={note.is_pinned ? 'Quitar fijado' : 'Fijar nota'}
                                          >
                                            <Pin size={14} className={note.is_pinned ? 'fill-current' : ''} />
                                          </button>


                                          <button 
                                            onClick={(e) => { e.stopPropagation(); archiveNote(note.id); }} 
                                            className="p-1 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" 
                                            title="Archivar"
                                          >
                                            <Archive size={14}/>
                                          </button>
                                         <div className="w-6 h-6 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-400 group-hover:bg-[#4940D9] group-hover:text-white transition-all"><ChevronRight size={14} /></div>
                                      </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* SECCIÓN DE ARCHIVO (ESTILO PIZARRÓN) */}
                          {activeGroup.notes.filter(n => n.status === 'history').length > 0 && (
                            <div className={`mt-12 space-y-4 pt-8 border-t border-zinc-100 dark:border-zinc-800/50 mb-20 animate-fadeIn ${isArchiveOpenByGroup[activeGroupId!] ? 'min-h-[300px]' : ''}`}>

                              <button 
                                onClick={() => setArchiveOpenByGroup(activeGroupId!, !isArchiveOpenByGroup[activeGroupId!])}
                                className="flex items-center gap-3 text-zinc-400 font-bold uppercase tracking-widest text-xs
 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group/archheader"
                              >
                                 <Archive size={16} className="text-zinc-500/50 group-hover/archheader:text-indigo-500/50 transition-colors" /> 
                                 <span>Archivo ({activeGroup.notes.filter(n => n.status === 'history').length})</span>
                                 <ChevronDown size={14} className={`transition-transform duration-300 ${isArchiveOpenByGroup[activeGroupId!] ? '' : '-rotate-90'}`} />
                              </button>
                              
                              {isArchiveOpenByGroup[activeGroupId!] && (
                                <div className={`grid ${isMaximized ? 'grid-cols-[repeat(auto-fit,340px)] w-full max-w-[2160px]' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl'} gap-4 justify-center mx-auto pb-20`}>

                                  {activeGroup.notes.filter(n => n.status === 'history').map(note => (
                                    <div key={note.id} className="p-4 bg-white dark:bg-[#1A1A24]/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-between group hover:border-[#4940D9]/30 hover:shadow-xl transition-all">
                                       <div className="flex items-center gap-3 truncate">
                                         <div className="w-8 h-8 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-400">
                                           <Archive size={16} />
                                         </div>
                                         <div className="flex flex-col truncate">
                                           <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 truncate">{note.title || 'Sin Título'}</span>
                                           <span className="text-[10px] text-zinc-400 font-medium">{new Date(note.created_at || '').toLocaleDateString()}</span>
                                         </div>
                                       </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <button 
                                             onClick={() => restoreNote(note.id)} 
                                             className="p-2 rounded-xl text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all active:scale-90" 
                                             title="Restaurar Nota"
                                          >
                                             <RotateCcw size={16}/>
                                          </button>
                                          <button 
                                             onClick={() => deleteNote(note.id)} 
                                             className="p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-90" 
                                             title="Eliminar Permanente"
                                          >
                                             <Trash2 size={16}/>
                                          </button>
                                       </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                           )}
                         </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center">
                      <p className="font-medium slide-to-unlock text-zinc-400">Crea o selecciona un grupo para comenzar.</p>
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
        onTogglePin={toggleGroupPin}
        onToggleFavorite={toggleGroupFavorite}
      />

    </div>
  );
}

export default App;
