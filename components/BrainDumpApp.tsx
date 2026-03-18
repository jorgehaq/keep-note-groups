import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus, Trash2, CheckCircle2, Archive as ArchiveIcon, Zap, Play, RotateCcw, PenTool, ChevronDown, ChevronUp, Maximize2, Minimize2, Bell, Grid, ChevronsDownUp, MoreVertical, ListTodo, CheckSquare, Square, GripVertical, Search, X, ChevronLeft, ChevronRight, ArrowUpRight, Download, ArrowUpDown, Calendar, Type, Check, Wind, Sparkles, PenLine, FileText, GitBranch, Loader2, CloudCheck, KanbanSquare } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { KanbanSemaphore } from './KanbanSemaphore';
import { PizarronLinkerModal } from './PizarronLinkerModal';
import { supabase } from '../src/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { BrainDump, Group, NoteFont, Summary } from '../types';
import { SmartNotesEditor, SmartNotesEditorRef } from '../src/components/editor/SmartNotesEditor';
import { ChecklistEditor, ChecklistEditorRef, parseMarkdownToChecklist, serializeChecklistToMarkdown, serializeChecklistToPlainMarkdown } from '../src/components/editor/ChecklistEditor';
import { useUIStore } from '../src/lib/store';
import { useBrainDumpTree } from '../src/lib/useBrainDumpTree';
import { useBrainDumpSummaries } from '../src/lib/useBrainDumpSummaries';
import { BrainDumpAIPanel } from './BrainDumpAIPanel';
import { BrainDumpBreadcrumb } from './BrainDumpBreadcrumb';

// --- UTILS ---
const formatCleanDate = (isoString?: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? ' PM' : ' AM';
    hours = hours % 12 || 12;
    return `${day}/${month}/${year}, ${hours.toString().padStart(2, '0')}:${minutes}${ampm}`;
};

const highlightText = (text: string, highlight?: string): React.ReactNode => {
    if (!highlight || !highlight.trim()) return text;
    const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, index) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={index} className="bg-yellow-200 dark:bg-yellow-500/40 text-yellow-900 dark:text-yellow-100 px-0.5 font-medium">
                {part}
            </mark>
        ) : (
            part
        )
    );
};

// --- SUB-COMPONENTS (Mirroring AccordionItem as requested) ---

const SummaryTabContent: React.FC<{
  summary: Summary;
  noteFont?: string;
  noteFontSize?: string;
  noteLineHeight?: string;
  searchQuery?: string;
  onDelete: (id: string) => void;
  updateScratchpad: (id: string, text: string) => void;
  updateContent: (id: string, text: string) => void;
  showScratch: boolean;
}> = ({ summary, noteFont, noteFontSize, noteLineHeight, searchQuery, onDelete, updateScratchpad, updateContent, showScratch }) => {
  const scratchRef = useRef<SmartNotesEditorRef>(null);
  const [localScratch, setLocalScratch] = useState(summary.scratchpad || '');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleScratchChange = (text: string) => {
    setLocalScratch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateScratchpad(summary.id, text), 1200);
  };

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className={`bg-violet-50 dark:bg-[#1A1A2E] rounded-2xl border ${searchQuery?.trim() && summary.content?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ? 'border-amber-500' : 'border-violet-200 dark:border-violet-500/20'}`}>
        <div className="flex items-center justify-between px-4 py-2.5 bg-violet-100/60 dark:bg-violet-500/5 border-b border-violet-200 dark:border-violet-500/10">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={12} className="text-violet-400 shrink-0" />
            <span className="text-[11px] font-bold text-violet-600 dark:text-violet-300 truncate">{summary.target_objective || 'Análisis AI'}</span>
          </div>
          <button onClick={() => onDelete(summary.id)} className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
        </div>
        <div className="px-4 py-3 min-w-0">
          <SmartNotesEditor
            noteId={`summary_${summary.id}`}
            initialContent={summary.content || ''}
            onChange={(text) => updateContent(summary.id, text)}
            noteFont={noteFont as any}
            noteFontSize={noteFontSize}
            noteLineHeight={noteLineHeight}
            searchQuery={searchQuery}
          />
        </div>
      </div>
      {showScratch && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <PenLine size={11} className="text-zinc-500" />
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Pizarrón</span>
          </div>
          <div className={`bg-zinc-50 dark:bg-[#242432] rounded-xl p-4 cursor-text flex-1 overflow-y-auto border ${searchQuery?.trim() && localScratch?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ? 'border-amber-500' : 'border-zinc-200 dark:border-[#2D2D42]'}`}>
            <SmartNotesEditor
              ref={scratchRef}
              noteId={`scratch_${summary.id}`}
              initialContent={localScratch}
              onChange={handleScratchChange}
              noteFont={noteFont as any}
              noteFontSize={noteFontSize}
              noteLineHeight={noteLineHeight}
              searchQuery={searchQuery}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const SubnoteTitle: React.FC<{
  child: BrainDump;
  isActive: boolean;
  onRename: (id: string, title: string) => void;
}> = ({ child, isActive, onRename }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(child.title || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(child.title || ''); }, [child.title]);

  const save = () => {
    setEditing(false);
    const trimmed = val.trim();
    if (trimmed && trimmed !== child.title) onRename(child.id, trimmed);
    else setVal(child.title || '');
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={val}
        autoFocus
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') { setEditing(false); setVal(child.title || ''); }
          e.stopPropagation();
        }}
        onClick={e => e.stopPropagation()}
        className="w-24 bg-transparent outline-none border-b border-white/50 text-xs font-bold"
        placeholder="Título..."
      />
    );
  }

  return (
    <span
      className="truncate max-w-[100px] cursor-pointer"
      onDoubleClick={e => { e.stopPropagation(); if (isActive) setEditing(true); }}
      title={isActive ? 'Doble clic para renombrar' : child.title || ''}
    >
      {child.title || 'Sin título'}
    </span>
  );
};

const SubnoteTabContent: React.FC<{
  dump: BrainDump;
  showScratch: boolean;
  onUpdate: (id: string, updates: Partial<BrainDump>) => void;
  splitRatio: number;
  onDividerMouseDown: (e: React.MouseEvent) => void;
  splitContainerRef: React.RefObject<HTMLDivElement>;
  noteFont: string;
  noteFontSize: string;
  noteLineHeight: string;
  searchQuery?: string;
}> = ({
  dump,
  showScratch,
  splitRatio,
  onDividerMouseDown,
  splitContainerRef,
  noteFont,
  noteFontSize,
  noteLineHeight,
  searchQuery,
  onUpdate
}) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const editorRef = useRef<SmartNotesEditorRef>(null);
  const scratchRef = useRef<SmartNotesEditorRef>(null);

  return (
    <div
      ref={splitContainerRef}
      className={`flex-1 flex min-h-0 ${isMobile ? 'flex-col' : 'flex-row'} gap-2 animate-fadeIn`}
    >
      <div
        className={`min-h-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-[#2D2D42] bg-zinc-50 dark:bg-[#242432]`}
        style={showScratch
          ? (isMobile
              ? { height: `${splitRatio * 100}%`, flex: 'none' }
              : { width: `${splitRatio * 100}%`, flex: 'none' })
          : { flex: '1' }
        }
      >
        <div
            onClick={() => editorRef.current?.focus()}
            className="p-4 h-full overflow-y-auto cursor-text note-editor-scroll"
        >
            <SmartNotesEditor
                ref={editorRef}
                noteId={dump.id}
                initialContent={dump.content || ''}
                searchQuery={searchQuery}
                onChange={c => onUpdate(dump.id, { content: c })}
                noteFont={noteFont as any}
                noteFontSize={noteFontSize}
                noteLineHeight={noteLineHeight}
            />
        </div>
      </div>

      {showScratch && (
        <div
          onMouseDown={onDividerMouseDown}
          className={`shrink-0 flex items-center justify-center rounded-full cursor-col-resize select-none hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors ${
            isMobile ? 'h-2 w-full cursor-row-resize' : 'w-2 h-full'
          }`}
          title="Arrastrar para redimensionar"
        >
          <div className={`rounded-full bg-zinc-300 dark:bg-zinc-600 ${isMobile ? 'h-1 w-8' : 'w-1 h-8'}`} />
        </div>
      )}

      {showScratch && (
        <div
          className="min-h-0 overflow-hidden flex flex-col rounded-xl border border-zinc-200 dark:border-[#2D2D42] bg-zinc-50 dark:bg-[#1A1A24]"
          style={{ flex: 1 }}
        >
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-zinc-200 dark:border-[#2D2D42] shrink-0">
            <PenLine size={11} className="text-zinc-400" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex-1">Pizarrón</span>
          </div>
          <div
            onClick={() => scratchRef.current?.focus()}
            className="flex-1 p-4 overflow-y-auto cursor-text note-editor-scroll"
          >
            <SmartNotesEditor
              ref={scratchRef}
              noteId={`scratch_dump_${dump.id}`}
              initialContent={dump.scratchpad || ''}
              onChange={c => onUpdate(dump.id, { scratchpad: c })}
              noteFont={noteFont as any}
              noteFontSize={noteFontSize}
              noteLineHeight={noteLineHeight}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---

export const BrainDumpApp: React.FC<{ 
    session: Session; 
    noteFont?: string; 
    noteFontSize?: string; 
    noteLineHeight?: string; 
    searchQuery?: string;
    groups?: Group[];
    onOpenNote?: (groupId: string, noteId: string) => void;
}> = ({ session, noteFont = 'sans', noteFontSize = 'medium', noteLineHeight = 'standard', searchQuery, groups = [], onOpenNote }) => {
    
    // --- STORE & HOOKS ---
    const { 
        isBraindumpMaximized, setIsBraindumpMaximized, 
        brainDumps: dumps, setBrainDumps: setDumps, 
        showOverdueMarquee, setShowOverdueMarquee, 
        overdueRemindersCount, globalTasks, 
        focusedDumpId, setFocusedDumpId, 
        isDumpTrayOpen, setIsDumpTrayOpen, 
        isZenModeByApp, toggleZenMode,
        aiPanelOpenByBrainDump, activeTabByBrainDump,
        setAiPanelOpenByBrainDump, setActiveTabByBrainDump,
        pizarronVisibleByNoteAndTab, setPizarronVisible
    } = useUIStore();

    const { activeDumpId, activeDump, breadcrumbPath, navigate } = useBrainDumpTree(focusedDumpId);
    const isRootLevel = !activeDumpId || activeDumpId === focusedDumpId;
    
    // El dump que estamos visualizando actualmente (la raíz o un sub-pizarrón)
    const displayDump = isRootLevel ? (dumps.find(d => d.id === focusedDumpId)) : activeDump;
    const currentDumpId = displayDump?.id || focusedDumpId;
    const isInKanban = displayDump ? globalTasks?.some(t => t.id === displayDump.id || t.linked_board_id === displayDump.id) : false;

    const showAIPanel = currentDumpId ? (aiPanelOpenByBrainDump[currentDumpId] || false) : false;
    const activeTab = currentDumpId ? (activeTabByBrainDump[currentDumpId] || 'original') : 'original';

    const { 
        summaries: aiSummaries, deleteSummary, updateScratchpad, 
        updateSummaryContent, loading: summariesLoading 
    } = useBrainDumpSummaries(currentDumpId);
    
    const completedSummaries = aiSummaries.filter(s => s.status === 'completed');
    const manualChildren = useMemo(() => {
        return dumps
            .filter(d => d.parent_id === currentDumpId)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }, [dumps, currentDumpId]);

    // --- LOCAL UI STATE ---
    const [isZenMode, setIsZenMode] = useState(isZenModeByApp['braindump']);
    useEffect(() => { setIsZenMode(isZenModeByApp['braindump']); }, [isZenModeByApp]);

    const [sortMode, setSortMode] = useState<'date-desc' | 'date-asc' | 'created-desc' | 'created-asc' | 'alpha-asc' | 'alpha-desc'>(() => {
        return (localStorage.getItem('pizarronSortMode') as any) || 'date-desc';
    });
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());
    const [localSearchQuery, setLocalSearchQuery] = useState('');
    const [splitRatio, setSplitRatio] = useState(0.5);
    const [showAIInput, setShowAIInput] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [linkingPizarron, setLinkingPizarron] = useState<BrainDump | null>(null);

    const menuRef = useRef<HTMLDivElement>(null);
    const sortMenuRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const splitContainerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
    const hasLoadedOnce = useRef(false);

    // Close menu on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
            if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setIsSortMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Tab navigation sync
    const setActiveTab = (tabId: string) => {
        if (currentDumpId) setActiveTabByBrainDump(currentDumpId, tabId);
    };

    // --- HANDLERS ---
    const autoSave = (id: string, updates: Partial<BrainDump>) => {
        setDumps(prev => prev.map(d => d.id === id ? { ...d, ...updates, updated_at: new Date().toISOString() } : d));
        if (saveTimeoutRef.current[id]) clearTimeout(saveTimeoutRef.current[id]);
        saveTimeoutRef.current[id] = setTimeout(async () => {
            await supabase.from('brain_dumps').update(updates).eq('id', id);
        }, 500);
    };

    const createNewDraft = async () => {
        const { data: newMain } = await supabase.from('brain_dumps')
            .insert([{ title: '', content: '', status: 'main', user_id: session.user.id }])
            .select().single();
        if (newMain) setFocusedDumpId(newMain.id);
    };

    const handleCreateSubpizarron = async () => {
        if (!currentDumpId) return;
        const { data, error } = await supabase.from('brain_dumps').insert([{
            title: 'Nuevo Sub-pizarrón',
            content: '',
            status: 'main',
            user_id: session.user.id,
            parent_id: currentDumpId,
            generation_level: (displayDump?.generation_level || 0) + 1
        }]).select().single();
        if (error) {
            console.error('Error creating subpizarron:', error);
            alert(`Error al crear subpizarrón: ${error.message}. ¿Has ejecutado el script SQL de migración?`);
            return;
        }
        if (data) setActiveTab(`sub_${data.id}`);
    };

    const handleAddToKanban = async () => {
        if (!displayDump || isInKanban) return;
        
        const { error } = await supabase.from('tasks').insert([{
            title: displayDump.title || 'Pizarrón sin título',
            content: displayDump.content || '',
            status: 'backlog',
            user_id: session.user.id,
            linked_board_id: displayDump.id
        }]);

        if (error) {
            console.error('Error linking to Kanban:', error);
            alert(`Error al vincular con Kanban: ${error.message}`);
            return;
        }

        window.dispatchEvent(new CustomEvent('kanban-updated'));
    };

    const changeStatus = async (id: string, newStatus: any) => {
        setDumps(dumps.map(d => d.id === id ? { ...d, status: newStatus } : d));
        await supabase.from('brain_dumps').update({ status: newStatus }).eq('id', id);
    };

    const deleteDump = async (id: string) => {
        if (!window.confirm('¿Eliminar permanentemente este pizarrón?')) return;
        setDumps(dumps.filter(d => d.id !== id));
        await supabase.from('brain_dumps').delete().eq('id', id);
        if (focusedDumpId === id) setFocusedDumpId(null);
    };

    const handleDividerMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        const container = splitContainerRef.current;
        if (!container) return;
        const onMove = (ev: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const rect = container.getBoundingClientRect();
            const ratio = (ev.clientX - rect.left) / rect.width;
            setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
        };
        const onUp = () => {
            isDraggingRef.current = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    // --- FILTERING & SORTING RAIDERS ---
    const pizarrones = useMemo(() => {
        let result = dumps.filter(d => d.status !== 'history' && !d.parent_id);
        if (localSearchQuery.trim()) {
            result = dumps.filter(p => p.status !== 'history' && ((p.title || '').toLowerCase().includes(localSearchQuery.toLowerCase()) || p.content.toLowerCase().includes(localSearchQuery.toLowerCase())));
        }
        result.sort((a, b) => {
            switch (sortMode) {
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
                    const dateB = new Date(b.created_at || 0).getTime();
                    const dateA = new Date(a.created_at || 0).getTime();
                    return dateB - dateA;
                }
                case 'created-asc': {
                    const dateA = new Date(a.created_at || 0).getTime();
                    const dateB = new Date(b.created_at || 0).getTime();
                    return dateA - dateB;
                }
                case 'alpha-asc': return (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
                case 'alpha-desc': return (b.title || '').toLowerCase().localeCompare((a.title || '').toLowerCase());
                default: return 0;
            }
        });
        return result;
    }, [dumps, localSearchQuery, sortMode]);

    const archivo = dumps.filter(d => d.status === 'history');

    // --- RENDER ---
    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-[#13131A] overflow-hidden">
            {!isZenMode && (
                <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#1A1A24]/90 backdrop-blur-md shrink-0 border-b border-zinc-200 dark:border-[#2D2D42]">
                    <div className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-4 gap-4">
                        <h1 className="text-xl font-bold text-zinc-800 dark:text-[#CCCCCC] flex items-center gap-3">
                            <div className="h-9 p-2 bg-[#FFD700] rounded-lg text-amber-900 shadow-lg shadow-amber-500/20 shrink-0"><PenTool size={20} /></div>
                            <span className="truncate">Pizarrón</span>
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 md:gap-3">
                            <button onClick={() => overdueRemindersCount > 0 && setShowOverdueMarquee(!showOverdueMarquee)} className={`h-9 px-3 rounded-xl transition-all border ${overdueRemindersCount > 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white dark:bg-[#1A1A24] border-zinc-200/60 dark:border-[#2D2D42] text-zinc-400 opacity-60'}`}><Bell size={18} /></button>
                            
                            <div className="relative" ref={sortMenuRef}>
                                <button onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} className="h-9 px-3 rounded-xl bg-white dark:bg-[#1A1A24] border border-zinc-200/60 dark:border-[#2D2D42] text-zinc-500 hover:text-amber-600 transition-all flex items-center gap-2" title="Ordenar pizarrones">
                                    <ArrowUpDown size={16} />
                                </button>
                                {isSortMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1C1C26] border border-zinc-200 dark:border-[#2D2D42] rounded-xl shadow-xl z-50 py-1 animate-fadeIn">
                                        {[
                                            { id: 'date-desc', label: 'Fecha (Recientes)', icon: <Calendar size={14} /> },
                                            { id: 'date-asc', label: 'Fecha (Antiguos)', icon: <Calendar size={14} /> },
                                            { id: 'created-desc', label: 'Creación (reciente)', icon: <Calendar size={14} /> },
                                            { id: 'created-asc', label: 'Creación (antigua)', icon: <Calendar size={14} /> },
                                            { id: 'alpha-asc', label: 'Nombre (A-Z)', icon: <Type size={14} /> },
                                            { id: 'alpha-desc', label: 'Nombre (Z-A)', icon: <Type size={14} /> },
                                        ].map(opt => (
                                            <button key={opt.id} onClick={() => { setSortMode(opt.id as any); localStorage.setItem('pizarronSortMode', opt.id); setIsSortMenuOpen(false); }} className={`w-full px-4 py-2 text-left text-xs flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${sortMode === opt.id ? 'text-amber-600 font-bold bg-amber-50/50 dark:bg-amber-900/20' : 'text-zinc-600 dark:text-zinc-400 font-medium'}`}>
                                                {opt.icon} {opt.label}
                                                {sortMode === opt.id && <Check size={14} className="ml-auto" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button onClick={() => setIsDumpTrayOpen(!isDumpTrayOpen)} className={`h-9 px-3 rounded-xl transition-all border flex items-center gap-2 ${isDumpTrayOpen ? 'bg-[#FFD700] border-amber-300 text-amber-950 font-bold shadow-sm shadow-amber-500/20' : 'bg-amber-50 dark:bg-amber-900/10 text-amber-500 border-amber-200/60 dark:border-amber-900/30'}`} title={isDumpTrayOpen ? "Ocultar bandeja" : "Mostrar bandeja"}>
                                <ChevronsDownUp size={18} className={`transition-transform duration-300 ${isDumpTrayOpen ? 'rotate-180' : ''}`}/>
                                <span className="text-xs font-bold">{pizarrones.length}</span>
                            </button>
                            <div className="relative flex items-center">
                                <Search size={15} className="absolute left-3 text-zinc-400" />
                                <input type="text" placeholder="Buscar..." value={localSearchQuery} onChange={e => setLocalSearchQuery(e.target.value)} className="h-9 pl-9 pr-2 text-xs rounded-xl border border-zinc-200/60 dark:border-[#2D2D42] bg-white dark:bg-[#1A1A24] focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                            </div>
                            <button onClick={() => setIsBraindumpMaximized(!isBraindumpMaximized)} className="h-9 p-2 bg-white dark:bg-[#1A1A24] border border-zinc-200/60 dark:border-[#2D2D42] rounded-xl text-zinc-500 hover:text-amber-600 transition-all">{isBraindumpMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
                            <button onClick={createNewDraft} className="h-9 bg-[#FFD700] hover:bg-[#E5C100] text-amber-950 px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 active:scale-95 shadow-amber-500/10 border border-amber-400/30"><Plus size={20} /> <span className="text-sm font-bold hidden sm:inline">Nuevo Pizarrón</span></button>
                        </div>
                    </div>
                </div>
            )}

            {isDumpTrayOpen && pizarrones.length > 0 && !isZenMode && (
                <div className="pt-5 px-4 pb-5 bg-[#FAFAFA] dark:bg-[#13131A] relative group/tray">
                    <div ref={scrollContainerRef} className="flex flex-nowrap md:flex-wrap justify-start md:justify-center gap-2.5 overflow-x-auto hidden-scrollbar scroll-smooth pt-2 px-2">
                        {pizarrones.map(p => (
                            <button key={p.id} onClick={() => setFocusedDumpId(focusedDumpId === p.id ? null : p.id)} className={`relative flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold border transition-all my-0.5 ${focusedDumpId === p.id ? 'bg-[#FFD700] text-amber-950 border-amber-300 shadow-sm scale-[1.02]' : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-amber-500/40 hover:text-amber-600'}`}>
                                {globalTasks?.some(t => t.id === p.id || t.linked_board_id === p.id) && (
                                    <div className="absolute -top-1.5 -right-1.5 z-10"><KanbanSemaphore sourceType="board" sourceId={p.id} sourceTitle={p.title || ''} /></div>
                                )}
                                {p.title || 'Sin Título'}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className={`flex-1 ${focusedDumpId ? 'overflow-hidden' : 'overflow-y-auto'} bg-zinc-50 dark:bg-[#13131A] px-4 pb-4 ${!isZenMode && isDumpTrayOpen && pizarrones.length > 0 ? 'pt-0' : 'pt-5'} hidden-scrollbar flex flex-col`}>
                <div className={`${isBraindumpMaximized ? 'max-w-full' : 'max-w-4xl'} mx-auto flex flex-col ${focusedDumpId ? 'gap-0 pb-0 flex-1 w-full min-h-0' : 'gap-12 pb-20'}`}>
                    
                    {focusedDumpId && displayDump && (
                        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#1A1A24] rounded-2xl shadow-lg border border-zinc-200 dark:border-[#2D2D42] overflow-hidden animate-fadeIn">
                            
                            {/* Header del Pizarrón */}
                            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
                                <div className="flex-1 min-w-0 pr-4 flex items-center gap-2">
                                    {!isRootLevel && (
                                        <button 
                                            onClick={() => navigate(displayDump.parent_id || focusedDumpId)} 
                                            className="p-1 px-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-amber-600 transition-all flex items-center gap-1 text-[10px] font-bold"
                                            title="Volver al nivel superior"
                                        >
                                            <ChevronLeft size={14} /> Volver
                                        </button>
                                    )}
                                    <div className="relative flex-1">
                                        <div className="absolute inset-0 pointer-events-none text-lg font-bold flex items-center px-0.5 truncate">{searchQuery ? highlightText(displayDump.title || '', searchQuery) : ""}</div>
                                        <input
                                            type="text"
                                            value={displayDump.title || ''}
                                            onChange={e => autoSave(displayDump.id, { title: e.target.value })}
                                            placeholder="Título del pizarrón..."
                                            className="w-full bg-transparent text-lg font-bold outline-none text-zinc-800 dark:text-[#CCCCCC] placeholder-zinc-400"
                                        />
                                    </div>
                                </div>
                                 <div className="flex items-center gap-1.5 shrink-0">
                                     {isInKanban && (
                                         <div className="mr-1 shadow-sm">
                                             <KanbanSemaphore 
                                                 sourceType="board" 
                                                 sourceId={displayDump.id} 
                                                 sourceTitle={displayDump.title || 'Sin Título'} 
                                             />
                                         </div>
                                     )}
                                     <button 
                                         onClick={() => setPizarronVisible(displayDump!.id, activeTab, !(pizarronVisibleByNoteAndTab[displayDump!.id]?.[activeTab]))} 
                                        className={`p-2 rounded-xl border transition-all ${pizarronVisibleByNoteAndTab[displayDump.id]?.[activeTab] ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-amber-500/30'}`}
                                        title="Pizarrón / Borrador"
                                    >
                                        <PenLine size={13} />
                                    </button>
                                    <button 
                                        onClick={() => toggleZenMode('braindump')} 
                                        className={`p-2 rounded-xl border transition-all ${isZenMode ? 'bg-amber-100 border-amber-300 text-amber-600 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400 font-bold' : 'text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-amber-500/30'}`}
                                        title={isZenMode ? "Salir de Modo Zen" : "Entrar a Modo Zen"}
                                    >
                                        <Wind size={13} />
                                    </button>
                                    
                                    <div className="relative" ref={openMenuId === displayDump.id ? menuRef : undefined}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === displayDump.id ? null : displayDump.id); }}
                                            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                        ><MoreVertical size={16} /></button>
                                        
                                        {openMenuId === displayDump.id && (
                                            <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-[#1A1A24] shadow-xl rounded-lg border border-zinc-200 dark:border-[#2D2D42] p-1 flex flex-col gap-0.5 min-w-[200px] animate-fadeIn">
                                                <button onClick={() => { 
                                                    const willBeChecklist = !displayDump.is_checklist;
                                                    let contentToSave = displayDump.content;
                                                    if (willBeChecklist) {
                                                        contentToSave = serializeChecklistToMarkdown(parseMarkdownToChecklist(displayDump.content));
                                                    } else {
                                                        contentToSave = serializeChecklistToPlainMarkdown(parseMarkdownToChecklist(displayDump.content));
                                                    }
                                                    autoSave(displayDump.id, { is_checklist: willBeChecklist, content: contentToSave }); 
                                                    setOpenMenuId(null); 
                                                }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${displayDump.is_checklist ? 'text-[#1F3760] dark:text-blue-400 bg-blue-50 dark:bg-[#1F3760]/20' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42]'}`}><ListTodo size={14} />{displayDump.is_checklist ? 'Quitar Checklist' : 'Hacer Checklist'}</button>
                                                
                                                {!isInKanban && (
                                                    <button onClick={handleAddToKanban} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42] transition-colors">
                                                        <CheckSquare size={14} /> Añadir a Kanban
                                                    </button>
                                                )}
                                                
                                                <div className="border-t border-zinc-100 dark:border-[#2D2D42] my-0.5" />
                                                
                                                <button 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setLinkingPizarron(displayDump);
                                                        setIsLinkModalOpen(true);
                                                        setOpenMenuId(null);
                                                    }} 
                                                    className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-colors"
                                                >
                                                    <ArrowUpRight size={14} /> Convertir a Nota
                                                </button>
 
                                                <button 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        const element = document.createElement("a");
                                                        const file = new Blob([displayDump.content], { type: 'text/markdown' });
                                                        element.href = URL.createObjectURL(file);
                                                        element.download = `${(displayDump.title || 'pizarron').replace(/\s+/g, '_')}.md`;
                                                        document.body.appendChild(element);
                                                        element.click();
                                                        document.body.removeChild(element);
                                                        setOpenMenuId(null);
                                                    }} 
                                                    className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42] transition-colors"
                                                >
                                                    <Download size={14} /> Descargar .md
                                                </button>
 
                                                <div className="border-t border-zinc-100 dark:border-[#2D2D42] my-0.5" />
                                                <button onClick={() => { changeStatus(displayDump.id, 'history'); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42] transition-colors"><ArchiveIcon size={14} />Archivar</button>
                                                <button onClick={() => { deleteDump(displayDump.id); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 text-sm w-full text-left rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={14} />Eliminar</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                             <div className="px-4 pb-4 pt-2 w-full flex-1 flex flex-col min-h-0 gap-[10px]">

                                {/* TABS UNIFICADAS */}
                                {(manualChildren.length > 0 || completedSummaries.length > 0 || true) && (
                                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 shrink-0 min-w-0 pt-2 px-2">
                                        <button onClick={() => setActiveTab('original')} className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border shrink-0 transition-all ${activeTab === 'original' ? 'bg-[#4940D9] text-white border-[#4940D9]' : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:text-indigo-400'}`}>
                                            <FileText size={11} /> 
                                            {globalTasks?.some(t => t.id === focusedDumpId || t.linked_board_id === focusedDumpId) && (
                                                <div className="absolute -top-1.5 -right-1.5 z-10"><KanbanSemaphore sourceType="board" sourceId={focusedDumpId!} sourceTitle="Pizarrón Original" /></div>
                                            )}
                                            Original
                                        </button>
                                        
                                        {manualChildren.map(child => {
                                            const isActive = activeTab === `sub_${child.id}`;
                                            return (
                                                <div key={child.id} className="relative shrink-0 flex items-center group">
                                                    <button onClick={() => setActiveTab(`sub_${child.id}`)} className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all max-w-[150px] ${isActive ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:text-emerald-400 font-bold'}`}>
                                                        {globalTasks?.some(t => t.id === child.id || t.linked_board_id === child.id) && (
                                                            <div className="absolute -top-1.5 -right-1.5 z-10"><KanbanSemaphore sourceType="board" sourceId={child.id} sourceTitle={child.title || ''} /></div>
                                                        )}
                                                        <span onClick={(e) => { e.stopPropagation(); navigate(child.id); }} className="p-0.5 -ml-1 hover:bg-white/20 rounded-md transition-colors cursor-pointer" title="Entrar a este pizarrón"><GitBranch size={10} /></span>
                                                        <SubnoteTitle child={child} isActive={isActive} onRename={(id, title) => autoSave(id, { title })} />
                                                    </button>
                                                </div>
                                            );
                                        })}

                                        {completedSummaries.map(s => (
                                            <button key={s.id} onClick={() => setActiveTab(s.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border shrink-0 transition-all max-w-[150px] ${activeTab === s.id ? 'bg-violet-600 text-white border-violet-500' : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:text-violet-400'}`}><Sparkles size={10} /> <span className="truncate">{s.target_objective || 'Resumen'}</span></button>
                                        ))}

                                        <button onClick={handleCreateSubpizarron} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border shrink-0 text-emerald-400 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 transition-all"><Plus size={11} /> Sub</button>
                                    </div>
                                )}

                                {/* CONTENIDO DE LA PESTAÑA */}
                                {(() => {
                                    const activeSubId = activeTab.startsWith('sub_') ? activeTab.replace('sub_', '') : null;
                                    const activeSub = activeSubId ? manualChildren.find(c => c.id === activeSubId) : null;
                                    const activeSummary = !activeSubId && activeTab !== 'original' ? completedSummaries.find(s => s.id === activeTab) : null;
                                    const showScratch = pizarronVisibleByNoteAndTab[currentDumpId!]?.[activeTab] ?? false;

                                    if (activeSummary) return <SummaryTabContent key={activeSummary.id} summary={activeSummary} noteFont={noteFont} noteFontSize={noteFontSize} noteLineHeight={noteLineHeight} onDelete={deleteSummary} updateScratchpad={updateScratchpad} updateContent={updateSummaryContent} searchQuery={searchQuery} showScratch={showScratch} />;
                                    
                                    const currentNote = activeSub || displayDump;
                                    return <SubnoteTabContent key={currentNote!.id} dump={currentNote!} showScratch={showScratch} onUpdate={autoSave} splitRatio={splitRatio} onDividerMouseDown={handleDividerMouseDown} splitContainerRef={splitContainerRef} noteFont={noteFont} noteFontSize={noteFontSize} noteLineHeight={noteLineHeight} searchQuery={searchQuery} />;
                                })()}

                                {/* AI INPUT AL FONDO (COLAPSABLE) */}
                                <div className="shrink-0 pt-2 border-t border-zinc-100 dark:border-zinc-800/50 mt-2">
                                    {showAIInput ? (
                                        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-3 animate-fadeIn">
                                            <div className="flex items-center justify-between mb-2"><span className="text-[11px] font-bold text-violet-400 flex items-center gap-1.5"><Sparkles size={11} /> AI — Pregunta al Pizarrón</span><button onClick={() => setShowAIInput(false)} className="text-zinc-400 hover:text-red-500"><X size={14} /></button></div>
                                            <BrainDumpAIPanel dumpId={currentDumpId!} />
                                        </div>
                                    ) : (
                                        <button onClick={() => setShowAIInput(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-violet-500/20 text-violet-400/60 hover:border-violet-500/40 hover:text-violet-400 hover:bg-violet-500/5 transition-all text-xs font-medium"><Sparkles size={12} /> Preguntar a la IA sobre este pizarrón...</button>
                                    )}
                                </div>
                            </div>
                            <div className="px-4 py-3 bg-zinc-50 dark:bg-[#2D2D42]/50 border-t border-zinc-200 dark:border-[#2D2D42] shrink-0 text-[10px] font-bold text-zinc-400 flex items-center gap-2"><span>Creado: {formatCleanDate(displayDump.created_at)}</span>{displayDump.updated_at && <><span className="opacity-50">|</span><span>Editado: {formatCleanDate(displayDump.updated_at)}</span></>}</div>
                        </div>
                    )}

                    {!focusedDumpId && (
                        <>
                            {/* LISTA PRINCIPAL DE PIZARRONES */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {pizarrones.map(p => (
                                    <div key={p.id} onClick={() => setFocusedDumpId(p.id)} className="group bg-white dark:bg-[#1A1A24] border border-zinc-200 dark:border-[#2D2D42] rounded-2xl p-5 hover:shadow-xl hover:border-amber-500/30 transition-all cursor-pointer flex flex-col gap-3 relative">
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className="font-bold text-zinc-800 dark:text-[#CCCCCC] truncate flex-1">{p.title || 'Sin Título'}</h3>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <KanbanSemaphore sourceType="board" sourceId={p.id} sourceTitle={p.title || ''} onInteract={() => setFocusedDumpId(p.id)} />
                                                <button onClick={(e) => { e.stopPropagation(); changeStatus(p.id, 'history'); }} className="p-1.5 text-zinc-400 hover:text-amber-600 transition-colors"><ArchiveIcon size={14}/></button>
                                            </div>
                                        </div>
                                        <div className="text-xs text-zinc-500 line-clamp-3 leading-relaxed min-h-[4.5em]">{p.content || <span className="italic opacity-40">Pizarrón vacío...</span>}</div>
                                        <div className="flex items-center justify-between pt-2 border-t border-zinc-50 dark:border-zinc-800/50 mt-auto">
                                            <span className="text-[10px] font-bold text-zinc-400">{formatCleanDate(p.updated_at || p.created_at)}</span>
                                            <div className="flex items-center gap-1.5">
                                                {p.is_checklist && <ListTodo size={12} className="text-amber-500/60" />}
                                                <div className="w-6 h-6 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-400 group-hover:bg-amber-500 group-hover:text-white transition-all"><ChevronRight size={14} /></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ARCHIVO */}
                            {archivo.length > 0 && (
                                <div className="space-y-4 opacity-70 px-0">
                                    <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase tracking-widest text-xs px-2"><ArchiveIcon size={16} /> Archivo ({archivo.length})</div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {archivo.map(a => (
                                            <div key={a.id} className="p-3 bg-white dark:bg-[#1A1A24]/50 border border-zinc-200 dark:border-[#2D2D42] rounded-xl flex items-center justify-between group">
                                                <div className="flex items-center gap-3 truncate"><ArchiveIcon size={14} className="text-zinc-300" /><span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 truncate">{a.title || 'Sin Título'}</span></div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button onClick={() => changeStatus(a.id, 'main')} className="p-1.5 hover:text-indigo-500" title="Restaurar"><RotateCcw size={14}/></button>
                                                    <button onClick={() => deleteDump(a.id)} className="p-1.5 hover:text-red-500" title="Eliminar"><Trash2 size={14}/></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {isLinkModalOpen && linkingPizarron && (
                <PizarronLinkerModal pizarron={linkingPizarron} groups={groups} onClose={() => setIsLinkModalOpen(false)} onSuccess={(groupId, noteId) => { setIsLinkModalOpen(false); onOpenNote?.(groupId, noteId); }} />
            )}
        </div>
    );
};