import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus, Trash2, CheckCircle2, Archive as ArchiveIcon, Zap, Play, RotateCcw, PenTool, ChevronDown, ChevronUp, Maximize2, Minimize2, Bell, Grid, ChevronsDownUp, Pin, MoreVertical, ListTodo, CheckSquare, Square, GripVertical, Search, X, ChevronLeft, ChevronRight, ArrowUpRight, Download, ArrowUpDown, Calendar, Type, Check, Wind, Sparkles, PenLine, FileText, GitBranch, Loader2, CloudCheck, KanbanSquare, ListPlus, Hash } from 'lucide-react';

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
  showLineNumbers?: boolean;
}> = ({ summary, noteFont, noteFontSize, noteLineHeight, searchQuery, onDelete, updateScratchpad, updateContent, showScratch, showLineNumbers }) => {
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
          <button onClick={() => { onDelete(summary.id); }} className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
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
        <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-violet-200/50 dark:border-violet-900/30 bg-violet-50/10 dark:bg-violet-900/5 animate-fadeIn overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-violet-200/20 shrink-0">
            <PenLine size={11} className="text-violet-400" />
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest flex-1">Pizarrón</span>
          </div>
          <div className={`flex-1 p-4 overflow-y-auto cursor-text`}>
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
  searchQuery?: string;
  onRename: (id: string, title: string) => void;
}> = ({ child, isActive, searchQuery, onRename }) => {
  // 🚀 NUEVO: Solo empezar editando si fue creada hace muy poco (nueva creación)
  const isJustCreated = (!child.title || child.title === 'Nuevo Sub-pizarrón') && (Date.now() - new Date(child.created_at || 0).getTime() < 3000);
  const [editing, setEditing] = useState(isJustCreated);
  const [val, setVal] = useState(child.title || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(child.title || ''); }, [child.title]);

  // Asegurar foco y selección cuando entra en modo edición
  useEffect(() => {
    if (editing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
    }
  }, [editing]);

  const save = () => {
    setEditing(false);
    const trimmed = val.trim();
    if (trimmed !== (child.title || '')) onRename(child.id, trimmed);
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
                className="bg-zinc-800 text-white border-amber-500 border rounded px-1 outline-none text-[11px] max-w-[120px]"
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
            {highlightText(child.title || 'Sin título', searchQuery)}
        </span>
    );
};

const SummaryTitle: React.FC<{
    summary: Summary;
    isActive: boolean;
    searchQuery?: string;
    onRename: (id: string, newObjective: string) => void;
  }> = ({ summary, isActive, searchQuery, onRename }) => {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(summary.target_objective || '');
    const inputRef = useRef<HTMLInputElement>(null);
  
    useEffect(() => { setVal(summary.target_objective || ''); }, [summary.target_objective]);
  
    const save = () => {
      setEditing(false);
      const trimmed = val.trim();
      if (trimmed && trimmed !== summary.target_objective) onRename(summary.id, trimmed);
      else setVal(summary.target_objective || '');
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
            if (e.key === 'Escape') { setEditing(false); setVal(summary.target_objective || ''); }
            e.stopPropagation();
          }}
          onClick={e => e.stopPropagation()}
          className="bg-zinc-800 text-white border-violet-500 border rounded px-1 outline-none text-[11px] max-w-[120px]"
          placeholder="Resumen..."
        />
      );
    }
  
    return (
      <span
        className="truncate max-w-[120px] cursor-pointer"
        onDoubleClick={e => { e.stopPropagation(); if (isActive) setEditing(true); }}
        title={isActive ? 'Doble clic para renombrar' : summary.target_objective || ''}
      >
        {searchQuery?.trim() ? highlightText(summary.target_objective || 'Resumen', searchQuery.trim()) : (summary.target_objective || 'Resumen')}
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
  showLineNumbers?: boolean;
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
  showLineNumbers,
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
        className={`min-h-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/20`}
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
                showLineNumbers={showLineNumbers}
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
          className="min-h-0 overflow-hidden flex flex-col rounded-xl border border-violet-200/50 dark:border-violet-900/30 bg-violet-50/10 dark:bg-violet-900/5 animate-fadeIn"
          style={{ flex: 1 }}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-violet-200/20 shrink-0">
            <PenLine size={11} className="text-violet-400" />
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest flex-1">Pizarrón</span>
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
              searchQuery={searchQuery}
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
    allSummaries?: Summary[];
    groups?: Group[];
    onOpenNote?: (groupId: string, noteId: string) => void;
    setSearchQuery?: (query: string) => void;
    showLineNumbers?: boolean;
    onToggleLineNumbers?: () => void;
}> = ({ session, noteFont = 'sans', noteFontSize = 'medium', noteLineHeight = 'standard', searchQuery, allSummaries = [], groups = [], onOpenNote, setSearchQuery, showLineNumbers = false, onToggleLineNumbers }) => {
    
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
        isBraindumpPizarronOpen, setIsBraindumpPizarronOpen,
        isArchiveOpenByApp, setArchiveOpenByApp
    } = useUIStore();

    const checkPizarronSearchMatch = useCallback((dump: BrainDump, query: string, allDumps: BrainDump[], summaries: Summary[]): boolean => {
        if (!query) return false;
        const q = query.toLowerCase();
        
        // 1. Check title & content
        if ((dump.title || '').toLowerCase().includes(q) || (dump.content || '').toLowerCase().includes(q)) return true;
        
        // 2. Check scratchpad
        if ((dump.scratchpad || '').toLowerCase().includes(q)) return true;
        
        // 3. Check summaries
        const dumpSummaries = summaries.filter(s => s.brain_dump_id === dump.id);
        if (dumpSummaries.some(s => 
          (s.content || '').toLowerCase().includes(q) || 
          (s.target_objective || '').toLowerCase().includes(q) || 
          (s.scratchpad || '').toLowerCase().includes(q)
        )) return true;
        
        // 4. Check sub-pizarrones (children) recursively
        const children = allDumps.filter(d => d.parent_id === dump.id);
        return children.some(child => checkPizarronSearchMatch(child, query, allDumps, summaries));
    }, []);

    const tabBarRef = useRef<HTMLDivElement>(null);

    const { activeDumpId, activeDump, breadcrumbPath, navigate } = useBrainDumpTree(focusedDumpId);
    const isRootLevel = !activeDumpId || activeDumpId === focusedDumpId;
    
    // El dump que estamos visualizando actualmente (la raíz o un sub-pizarrón)
    const displayDump = isRootLevel ? (dumps.find(d => d.id === focusedDumpId)) : activeDump;
    const currentDumpId = displayDump?.id || focusedDumpId;
    const isInKanban = displayDump ? globalTasks?.some(t => t.id === displayDump.id || t.linked_board_id === displayDump.id) : false;

    const showAIPanel = currentDumpId ? (aiPanelOpenByBrainDump[currentDumpId] || false) : false;
    const activeTab = currentDumpId ? (activeTabByBrainDump[currentDumpId] || 'original') : 'original';

    const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
    const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);
    const [hasSearchMatchTabsLeft, setHasSearchMatchTabsLeft] = useState(false);
    const [hasSearchMatchTabsRight, setHasSearchMatchTabsRight] = useState(false);

    const checkTabsScroll = useCallback(() => {
        if (tabBarRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = tabBarRef.current;
            setCanScrollTabsLeft(scrollLeft > 5);
            setCanScrollTabsRight(scrollLeft + clientWidth < scrollWidth - 5);

            // --- Lógica de Iluminación de Flechas por Búsqueda ---
            const query = searchQuery?.trim();
            if (!query) {
                setHasSearchMatchTabsLeft(false);
                setHasSearchMatchTabsRight(false);
                return;
            }

            let matchLeft = false;
            let matchRight = false;
            const tabs = tabBarRef.current.querySelectorAll('button[data-is-match="true"]');
            
            tabs.forEach(tab => {
                const t = tab as HTMLElement;
                const tabStart = t.offsetLeft;
                const tabEnd = tabStart + t.offsetWidth;
                if (tabStart < scrollLeft + 35) matchLeft = true;
                if (tabEnd > scrollLeft + clientWidth - 35) matchRight = true;
            });

            setHasSearchMatchTabsLeft(matchLeft);
            setHasSearchMatchTabsRight(matchRight);
        }
    }, [tabBarRef, searchQuery]);

    const scrollTabsHorizontally = (direction: 'left' | 'right') => {
        if (tabBarRef.current) {
            tabBarRef.current.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        const container = tabBarRef.current;
        if (container) {
            checkTabsScroll();
            container.addEventListener('scroll', checkTabsScroll);
            window.addEventListener('resize', checkTabsScroll);
            return () => {
                container.removeEventListener('scroll', checkTabsScroll);
                window.removeEventListener('resize', checkTabsScroll);
            };
        }
    }, [checkTabsScroll, tabBarRef]);



    useEffect(() => {
      if (!tabBarRef.current) return;
      const activeBtn = tabBarRef.current.querySelector('[data-active-tab="true"]');
      if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, [activeTab]);

    const { 
        summaries: aiSummaries, deleteSummary, updateScratchpad, 
        updateSummaryContent, updateSummaryMetadata, loading: summariesLoading 
    } = useBrainDumpSummaries(currentDumpId);
    
    const completedSummaries = aiSummaries.filter(s => s.status === 'completed');
    const manualChildren = useMemo(() => {
        return dumps
            .filter(d => d.parent_id === currentDumpId)
            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    }, [dumps, currentDumpId]);

    const unifiedTabs = useMemo(() => {
        const items = [
            ...manualChildren.map(c => ({ id: `sub_${c.id}`, type: 'sub' as const, order_index: c.order_index || 0, data: c })),
            ...aiSummaries.map(s => ({ id: s.id, type: 'summary' as const, order_index: s.order_index || 0, data: s }))
        ];
        return items.sort((a, b) => a.order_index - b.order_index);
    }, [manualChildren, aiSummaries]);

    // Recalcular scroll cuando cambien las pestañas
    useEffect(() => {
        checkTabsScroll();
    }, [unifiedTabs, checkTabsScroll]);

    // DETERMINAR ORDEN RELATIVO (Interpolación REAL estilo Notion/Linear)
    const getNewOrderIndex = useCallback(() => {
      if (activeTab === 'original') {
        const first = unifiedTabs[0];
        if (!first) return 1;
        return first.order_index / 2;
      }

        const activeIndex = unifiedTabs.findIndex(t => t.id === activeTab);
        if (activeIndex === -1) {
            const last = unifiedTabs[unifiedTabs.length - 1];
            return last ? last.order_index + 1 : 1;
        }

        const current = unifiedTabs[activeIndex];
        const next = unifiedTabs[activeIndex + 1];

        if (!next) {
            return current.order_index + 1;
        }

        return (current.order_index + next.order_index) / 2;
    }, [activeTab, unifiedTabs]);

    // --- LOCAL UI STATE ---
    const [isZenMode, setIsZenMode] = useState(isZenModeByApp['braindump']);
    useEffect(() => { setIsZenMode(isZenModeByApp['braindump']); }, [isZenModeByApp]);

    const [sortMode, setSortMode] = useState<'date-desc' | 'date-asc' | 'created-desc' | 'created-asc' | 'alpha-asc' | 'alpha-desc'>(() => {
        return (localStorage.getItem('braindump-sort-mode') as any) || 'created-asc';
    });
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());
    const [splitRatio, setSplitRatio] = useState(0.5);
    const [showAIInput, setShowAIInput] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [linkingPizarron, setLinkingPizarron] = useState<BrainDump | null>(null);
    const [tempTitle, setTempTitle] = useState('');
    useEffect(() => {
        if (displayDump) setTempTitle(displayDump.title || '');
    }, [displayDump?.id]);

    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [hasSearchMatchLeft, setHasSearchMatchLeft] = useState(false);
    const [hasSearchMatchRight, setHasSearchMatchRight] = useState(false);

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

    // --- SCROLL LOGIC ---
    const checkScroll = useCallback(() => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
            setCanScrollLeft(scrollLeft > 5);
            setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 5);

            // --- Lógica de Iluminación de Flechas por Búsqueda (Bandeja Principal) ---
            const query = searchQuery?.trim();
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
                if (tabStart < scrollLeft + 35) matchLeft = true;
                if (tabEnd > scrollLeft + clientWidth - 35) matchRight = true;
            });

            setHasSearchMatchLeft(matchLeft);
            setHasSearchMatchRight(matchRight);
        }
    }, [searchQuery]);

    const scrollTabs = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: direction === 'left' ? -350 : 350, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (container) {
            checkScroll();
            container.addEventListener('scroll', checkScroll);
            window.addEventListener('resize', checkScroll);
            return () => {
                container.removeEventListener('scroll', checkScroll);
                window.removeEventListener('resize', checkScroll);
            };
        }
    }, [dumps, checkScroll, searchQuery]);

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
        if (newMain) {
            setDumps(prev => [newMain, ...prev]);
            setFocusedDumpId(newMain.id);
        }
    };

    const handleCreateSubpizarron = async () => {
        if (!currentDumpId) return;
        const orderIndex = getNewOrderIndex();
        const { data, error } = await supabase.from('brain_dumps').insert([{
            title: '', // Título vacío para disparar el modo edición
            content: '',
            status: 'main',
            user_id: session.user.id,
            parent_id: currentDumpId,
            generation_level: (displayDump?.generation_level || 0) + 1,
            order_index: orderIndex
        }]).select().single();
        if (error) {
            console.error('Error creating subpizarron:', error);
            alert(`Error al crear subpizarrón: ${error.message}. ¿Has ejecutado el script SQL de migración?`);
            return;
        }
        if (data) {
            setDumps(prev => [...prev, data]);
            setActiveTab(`sub_${data.id}`);
        }
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

        setOpenMenuId(null); // 🚀 FIX: Cerrar menú tras añadir
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
        setActiveTab('original');
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
    const rootPizarrones = useMemo(() => {
        let result = dumps.filter(d => d.status !== 'history' && !d.parent_id);
        result.sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
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
    }, [dumps, sortMode]);

    const filteredPizarrones = useMemo(() => {
        if (!searchQuery?.trim()) return rootPizarrones;
        return rootPizarrones.filter(p => checkPizarronSearchMatch(p, searchQuery.trim(), dumps, allSummaries));
    }, [rootPizarrones, searchQuery, dumps, allSummaries]);

    const archivo = dumps.filter(d => d.status === 'history');

    // --- RENDER ---
    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-[#13131A] overflow-hidden">
            {!isZenMode && (
                <div className="sticky top-0 z-30 bg-zinc-50/90 dark:bg-[#13131A]/90 backdrop-blur-md shrink-0 border-b border-zinc-200 dark:border-zinc-800/50">
                    <div className="max-w-6xl mx-auto flex flex-row items-center justify-center md:justify-between px-6 py-4 gap-4">
                        <h1 className="hidden md:flex text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                            <div className="h-9 p-2 bg-[#FFD700] rounded-lg text-amber-950 shadow-lg shadow-amber-500/20 shrink-0">
                                <PenTool size={20} />
                            </div>
                            <span className="truncate">Pizarrón</span>
                        </h1>

                        <div className="flex items-center justify-center gap-2 sm:gap-3 shrink-0">
                            {/* Search Bar - Linked to TikTok style */}
                            <div className="relative flex items-center group">
                                <Search size={15} className={`absolute left-3 transition-colors ${searchQuery?.trim() ? 'text-[#FFD700]' : 'text-zinc-500'}`} />
                                <input 
                                    type="text" 
                                    placeholder="Buscar..." 
                                    value={searchQuery || ''} 
                                    onChange={e => setSearchQuery?.(e.target.value)} 
                                    className={`h-9 pl-9 pr-8 rounded-xl border transition-all outline-none text-xs font-medium w-32 md:w-32 lg:w-40 ${searchQuery?.trim() ? 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 placeholder-amber-700/50 dark:placeholder-amber-400/50 font-semibold' : 'bg-zinc-200/50 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500 hover:border-zinc-400 dark:hover:border-zinc-700 focus:border-[#FFD700]/50'}`}
                                />
                                {searchQuery?.trim() && (
                                    <button onClick={() => setSearchQuery?.('')} className="absolute right-2 p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-zinc-300/80 dark:bg-zinc-800/80 rounded-full transition-colors">
                                        <X size={10} />
                                    </button>
                                )}
                            </div>

                            {/* 1. Bell */}
                            <button
                              onClick={() => overdueRemindersCount > 0 && setShowOverdueMarquee(!showOverdueMarquee)}
                              disabled={overdueRemindersCount === 0}
                              className={`hidden md:flex h-9 px-3 rounded-xl transition-all border items-center gap-2 ${
                                showOverdueMarquee 
                                  ? 'bg-[#DC2626] border-red-400 text-white shadow-sm shadow-red-600/20' 
                                  : overdueRemindersCount > 0
                                    ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20'
                                    : 'bg-zinc-200 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 opacity-60 cursor-not-allowed'
                              }`}
                            >
                              <Bell size={18} className={overdueRemindersCount > 0 ? 'animate-pulse' : ''} />
                              {overdueRemindersCount > 0 && <span className="text-xs font-bold">{overdueRemindersCount}</span>}
                            </button>

                            {/* 2. Tray Toggle */}
                            <button onClick={() => setIsDumpTrayOpen(!isDumpTrayOpen)} className={`h-9 px-3 rounded-xl transition-all border flex items-center gap-2 ${isDumpTrayOpen ? 'bg-[#FFD700] border-amber-300 text-amber-950 font-bold shadow-lg shadow-amber-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20'}`} title={isDumpTrayOpen ? "Ocultar bandeja" : "Mostrar bandeja"}>
                                <ChevronsDownUp size={18} className={`transition-transform duration-300 ${isDumpTrayOpen ? 'rotate-180' : ''}`}/>
                                <span className="text-sm font-bold">{rootPizarrones.length}</span>
                            </button>

                            {/* 3. Maximize */}
                            <button onClick={() => setIsBraindumpMaximized(!isBraindumpMaximized)} className="hidden md:flex h-9 p-2 bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all">
                                {isBraindumpMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>

                            {/* 4. Sort */}
                            <div className="relative" ref={sortMenuRef}>
                                <button onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} className="h-9 p-2 bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all">
                                    <ArrowUpDown size={18} />
                                </button>
                                {isSortMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1A1A24] border border-zinc-200 dark:border-[#2D2D42] rounded-xl shadow-2xl z-50 py-1 overflow-hidden animate-fadeIn">
                                        {[
                                            { id: 'date-desc', label: 'Fecha (Recientes)', icon: <Calendar size={14} /> },
                                            { id: 'date-asc', label: 'Fecha (Antiguos)', icon: <Calendar size={14} /> },
                                            { id: 'created-desc', label: 'Creación (reciente)', icon: <Calendar size={14} /> },
                                            { id: 'created-asc', label: 'Creación (antigua)', icon: <Calendar size={14} /> },
                                            { id: 'alpha-asc', label: 'Nombre (A-Z)', icon: <Type size={14} /> },
                                            { id: 'alpha-desc', label: 'Nombre (Z-A)', icon: <Type size={14} /> },
                                        ].map(opt => (
                                            <button 
                                              key={opt.id} 
                                              onClick={() => { setSortMode(opt.id as any); localStorage.setItem('pizarronSortMode', opt.id); setIsSortMenuOpen(false); }} 
                                              className={`w-full px-4 py-2 text-left text-xs flex items-center gap-2 hover:bg-zinc-800 transition-colors ${sortMode === opt.id ? 'text-amber-500 font-bold bg-amber-500/5' : 'text-zinc-400 font-medium'}`}
                                            >
                                                {opt.icon} {opt.label}
                                                {sortMode === opt.id && <Check size={14} className="ml-auto" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button onClick={createNewDraft} className="h-9 w-9 sm:w-auto bg-[#FFD700] hover:bg-[#E5C100] text-amber-950 rounded-full sm:rounded-xl shadow-lg shadow-amber-500/10 border border-amber-400/30 flex items-center justify-center gap-2 active:scale-95 transition-all">
                                <Plus size={18} /> <span className="text-sm font-bold hidden sm:inline mr-2">Pizarrón</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!isZenMode && isDumpTrayOpen && (
                <div className="bg-zinc-50 dark:bg-[#13131A] shrink-0 animate-slideDown group/tray border-b border-zinc-200 dark:border-transparent">
                    <div className="max-w-6xl mx-auto relative px-0">
                        {/* Flecha Izquierda */}
                        {canScrollLeft && (
                            <div className={`absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-zinc-50 dark:from-[#13131A] to-transparent z-10 flex items-center justify-start pointer-events-none transition-opacity duration-150 ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`}>
                                <button 
                                    onClick={() => scrollTabs('left')} 
                                    className={`p-1 rounded-full bg-zinc-200 dark:bg-zinc-800 shadow-md text-zinc-600 dark:text-zinc-400 hover:text-amber-600 transition-all active:scale-95 border ${hasSearchMatchLeft ? 'border-amber-500 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,192,45,0.4)] scale-110' : 'border-zinc-300 dark:border-zinc-700'} ml-1 ${canScrollLeft ? 'pointer-events-auto' : 'pointer-events-none'}`}
                                >
                                    <ChevronLeft size={14} />
                                </button>
                            </div>
                        )}
                        <div 
                            ref={scrollContainerRef}
                            onScroll={checkScroll}
                            className={`flex flex-nowrap items-center gap-4 overflow-x-auto hidden-scrollbar scroll-smooth py-3 px-10 transition-all ${(!canScrollLeft && !canScrollRight) ? 'justify-center' : 'justify-start'}`}
                        >
                            {rootPizarrones.length === 0 ? (
                                <div className="text-xs text-zinc-600 italic">No hay pizarrones activos</div>
                            ) : (
                                rootPizarrones.map(p => {
                                    const isMatch = searchQuery?.trim() && checkPizarronSearchMatch(p, searchQuery.trim(), dumps, allSummaries);
                                    return (
                                        <button
                                            key={p.id}
                                            data-is-match={isMatch}
                                            onClick={() => {
                                                if (focusedDumpId === p.id) setFocusedDumpId(null);
                                                else setFocusedDumpId(p.id);
                                            }}
                                            className={`relative shrink-0 flex items-center px-4 py-2 rounded-xl border transition-all ${
                                                focusedDumpId === p.id 
                                                    ? `bg-[#FFD700] text-amber-950 border-amber-300 shadow-sm shadow-amber-500/20 ${isMatch ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-[#13131A] shadow-[0_0_15px_rgba(251,192,45,0.4)]' : ''}`
                                                    : isMatch 
                                                        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-500/20 text-zinc-600 dark:text-zinc-400 hover:bg-amber-100 dark:hover:bg-amber-900/20' 
                                                        : 'bg-zinc-100 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800/50'
                                            }`}
                                        >

                                            <div className="flex items-center gap-3">
                                                <div className={`p-1 rounded-md transition-colors ${focusedDumpId === p.id ? 'bg-amber-950/10 text-amber-950' : 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500'}`}>
                                                    <Grid size={13} />
                                                </div>
                                                <div className="max-w-[150px] truncate text-xs font-bold">
                                                    {searchQuery?.trim() ? highlightText(p.title || 'Sin Título', searchQuery.trim()) : (p.title || 'Sin Título')}
                                                </div>
                                            </div>

                                            {p.is_pinned && (
                                                <span className="flex items-center ml-1">
                                                    <Pin size={9} className={`fill-current ${focusedDumpId === p.id ? 'text-amber-950/70' : 'text-[#85858C]'}`} />
                                                </span>
                                            )}

                                            {globalTasks?.some(t => t.id === p.id || t.linked_board_id === p.id) && (
                                                <div className="absolute -top-1.5 -right-1.5"><KanbanSemaphore sourceType="board" sourceId={p.id} sourceTitle={p.title || ''} /></div>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                        {/* Flecha Derecha */}
                        {canScrollRight && (
                            <div className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-zinc-50 dark:from-[#13131A] to-transparent z-10 flex items-center justify-end pointer-events-none transition-opacity duration-150 ${canScrollRight ? 'opacity-100' : 'opacity-0'}`}>
                                <button 
                                    onClick={() => scrollTabs('right')} 
                                    className={`p-1 rounded-full bg-zinc-200 dark:bg-zinc-800 shadow-md text-zinc-600 dark:text-zinc-400 hover:text-amber-600 transition-all active:scale-95 border ${hasSearchMatchRight ? 'border-amber-500 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,192,45,0.4)] scale-110' : 'border-zinc-300 dark:border-zinc-700'} mr-1 ${canScrollRight ? 'pointer-events-auto' : 'pointer-events-none'}`}
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className={`flex-1 ${focusedDumpId ? 'overflow-hidden px-4' : 'overflow-y-auto px-0'} bg-zinc-50 dark:bg-[#13131A] pb-4 ${!isZenMode && isDumpTrayOpen ? 'pt-[2px]' : 'pt-5'} hidden-scrollbar flex flex-col`}>
                <div className={`${isBraindumpMaximized ? 'max-w-full' : 'max-w-full md:max-w-6xl'} mx-auto flex flex-col ${focusedDumpId ? 'gap-0 pb-0 flex-1 w-full min-h-0' : 'gap-12 pb-20 w-full px-4 md:px-10'}`}>
                    
                    {focusedDumpId && displayDump && (() => {
                        const isDisplayDumpMatch = searchQuery?.trim() && checkPizarronSearchMatch(displayDump, searchQuery.trim(), dumps, allSummaries);
                        return (
                            <div className={`flex-1 flex flex-col min-h-0 bg-white dark:bg-[#1A1A24] rounded-2xl border overflow-hidden animate-fadeIn transition-all duration-300 ${
                                isDisplayDumpMatch
                                    ? 'border-amber-500 ring-2 ring-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                                    : 'shadow-lg border-zinc-200 dark:border-[#2D2D42] focus-within:ring-2 focus-within:ring-amber-500/50 focus-within:border-amber-500/50'
                            }`}>
                            <div className="flex items-center justify-between px-4 pt-4 pb-2 transition-colors gap-2 min-w-0 shrink-0">
                                <div className="flex items-center gap-3 flex-1 overflow-hidden pl-1 min-w-0">
                                    <div className="flex flex-col min-w-0 justify-center w-full">
                                        <div className="relative flex w-full">
                                            <input 
                                                type="text"
                                                value={tempTitle}
                                                onChange={(e) => setTempTitle(e.target.value)}
                                                onBlur={() => {
                                                    if (tempTitle !== (displayDump?.title || '')) {
                                                        autoSave(displayDump.id, { title: tempTitle });
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') e.currentTarget.blur();
                                                    if (e.key === 'Escape') {
                                                        setTempTitle(displayDump?.title || '');
                                                        e.currentTarget.blur();
                                                    }
                                                }}
                                                placeholder="Nombre del pizarrón..."
                                                className="w-full bg-transparent border-none outline-none text-lg font-bold text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 p-0 truncate"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">

                                    <button 
                                        onClick={handleCreateSubpizarron} 
                                        className="p-2 rounded-xl border text-emerald-400 border-zinc-800 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all flex items-center"
                                        title="Nueva subnota"
                                    >
                                        <ListPlus size={13} />
                                    </button>

                                    <button 
                                        onClick={() => setShowAIInput(!showAIInput)}
                                        className={`p-2 rounded-xl border transition-all ${showAIInput ? 'bg-amber-500 border-amber-400/80 text-amber-950 font-bold shadow-lg shadow-amber-500/20' : 'text-zinc-500 border-zinc-800 hover:border-amber-500/30'}`}
                                        title="Asistente IA"
                                    >
                                        <Sparkles size={13} />
                                    </button>

                                    <button 
                                         onClick={() => setIsBraindumpPizarronOpen(!isBraindumpPizarronOpen)} 
                                        className={`p-2 rounded-xl border transition-all ${isBraindumpPizarronOpen ? 'bg-amber-500 border-amber-400/80 text-amber-950 font-bold shadow-lg shadow-amber-500/20' : 'text-zinc-500 border-zinc-800 hover:border-amber-500/30'}`}
                                        title="Pizarrón / Borrador"
                                    >
                                        <PenLine size={13} />
                                    </button>

                                    <button 
                                        onClick={() => toggleZenMode('braindump')} 
                                        className={`p-2 rounded-xl border transition-all ${isZenMode ? 'bg-amber-500 border-amber-400/80 text-amber-950 font-bold shadow-lg shadow-amber-500/20' : 'text-zinc-500 border-zinc-800 hover:border-amber-500/30'}`}
                                        title={isZenMode ? "Salir de Modo Zen" : "Entrar a Modo Zen"}
                                    >
                                        <Wind size={13} />
                                    </button>
                                     {showLineNumbers && onToggleLineNumbers && (
                                         <button
                                             onClick={(e) => { e.stopPropagation(); onToggleLineNumbers(); }}
                                             className="p-1.5 rounded-lg transition-colors text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 shrink-0"
                                             title="Ocultar números de línea"
                                         >
                                             <Hash size={14} />
                                         </button>
                                     )}

                                     {displayDump.is_pinned && (
                                         <button
                                             onClick={(e) => { e.stopPropagation(); autoSave(displayDump.id, { is_pinned: false }); }}
                                             className="p-1.5 rounded-lg transition-colors text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 shrink-0"
                                             title="Desfijar Pizarrón"
                                         >
                                             <Pin size={14} className="fill-current" />
                                         </button>
                                     )}

                                    <div className="relative" ref={openMenuId === displayDump.id ? menuRef : undefined}>
                                        <div className="flex items-center gap-1.5">
                                            {isInKanban && (
                                                <div className="mr-0.5 shadow-sm">
                                                    <KanbanSemaphore 
                                                        sourceType="board" 
                                                        sourceId={displayDump.id} 
                                                        sourceTitle={displayDump.title || 'Sin Título'} 
                                                    />
                                                </div>
                                            )}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === displayDump.id ? null : displayDump.id); }}
                                                className={`p-2 rounded-xl border transition-all ${openMenuId === displayDump.id ? 'bg-amber-500 border-amber-400/80 text-amber-950 font-bold shadow-lg shadow-amber-500/20' : 'text-zinc-500 border-zinc-800 hover:border-amber-500/30'}`}
                                                title="Más opciones"
                                            >
                                                <MoreVertical size={13} />
                                            </button>
                                        </div>
                                        
                                        {openMenuId === displayDump.id && (
                                            <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-[#1A1A24] shadow-xl rounded-lg border border-zinc-200 dark:border-[#2D2D42] p-1 flex flex-col gap-0.5 min-w-[200px] animate-fadeIn">
                                                {onToggleLineNumbers && (
                                                    <>
                                                        <button onClick={(e) => { e.stopPropagation(); onToggleLineNumbers(); setOpenMenuId(null); }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${showLineNumbers ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42]"}`}>
                                                            <Hash size={14} /> {showLineNumbers ? "Ocultar números" : "Mostrar números"}
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); autoSave(displayDump.id, { is_pinned: !displayDump.is_pinned }); setOpenMenuId(null); }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${displayDump.is_pinned ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42]'}`}>
                                                            <Pin size={14} className={displayDump.is_pinned ? "fill-current" : ""} /> {displayDump.is_pinned ? 'Desfijar Pizarrón' : 'Fijar Pizarrón'}
                                                        </button>
                                                        <div className="border-t border-zinc-100 dark:border-[#2D2D42] my-0.5" />
                                                    </>
                                                )}

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
                                                    className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-colors font-bold"
                                                >
                                                    <ArrowUpRight size={14} /> Convertir a Nota
                                                </button>
 
                                                <button 
                                                    onClick={async (e) => { 
                                                        e.stopPropagation(); 
                                                        
                                                        const getAllTreeIds = (id: string): string[] => {
                                                            const kids = dumps.filter(d => d.parent_id === id);
                                                            return [id, ...kids.flatMap(k => getAllTreeIds(k.id))];
                                                        };
                                                        if (!displayDump) return;
                                                        const treeIds = getAllTreeIds(displayDump.id);

                                                        const { data: allSummaries } = await supabase
                                                            .from('summaries')
                                                            .select('*')
                                                            .in('brain_dump_id', treeIds);

                                                        const getRecursiveContent = (dumpId: string, depth: number): string => {
                                                            const target = dumps.find(d => d.id === dumpId);
                                                            if (!target) return "";

                                                            let md = `${"#".repeat(depth)} ${target.title || 'Sin Título'}\n\n`;
                                                            if (target.content) md += `${target.content}\n\n`;
                                                            
                                                            // Pizarrón (scratchpad) de este nivel
                                                            const hasScratch = target.scratchpad && target.scratchpad.trim().length > 0;
                                                            if (hasScratch) {
                                                                md += `${"#".repeat(depth + 1)} Pizarrón de: ${target.title || 'Sin Título'}\n\n`;
                                                                md += `${target.scratchpad}\n\n`;
                                                            }

                                                            // Resúmenes AI vinculados a este pizarrón
                                                            const dumpSummaries = (allSummaries || []).filter(s => s.brain_dump_id === dumpId);
                                                            if (dumpSummaries.length > 0) {
                                                                md += `${"#".repeat(depth + 1)} Análisis de Inteligencia Artificial (${dumpSummaries.length})\n\n`;
                                                                for (const s of dumpSummaries) {
                                                                    md += `${"#".repeat(depth + 2)} Análisis: ${s.target_objective || 'Sin objetivo'}\n\n`;
                                                                    md += `${s.content}\n\n`;
                                                                    if (s.scratchpad && s.scratchpad.trim()) {
                                                                        md += `**Pizarrón del Análisis:**\n\n${s.scratchpad}\n\n`;
                                                                    }
                                                                }
                                                            }

                                                            // Sub-pizarrones
                                                            const subNodes = dumps.filter(d => d.parent_id === dumpId)
                                                                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                                                            
                                                            for (const sub of subNodes) {
                                                                md += "\n---\n\n";
                                                                md += getRecursiveContent(sub.id, depth + 1);
                                                            }

                                                            return md;
                                                        };

                                                        const fullMarkdown = getRecursiveContent(displayDump.id, 1);
                                                        const element = document.createElement("a");
                                                        const file = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8;' });
                                                        element.href = URL.createObjectURL(file);
                                                        element.download = `${(displayDump.title || 'pizarron_completo').replace(/\s+/g, '_')}.md`;
                                                        document.body.appendChild(element);
                                                        element.click();
                                                        document.body.removeChild(element);
                                                        setOpenMenuId(null);
                                                    }} 
                                                    className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42] transition-colors font-bold"
                                                >
                                                    <Download size={14} /> Exportar (.md)
                                                </button>

 
                                                <div className="border-t border-zinc-100 dark:border-[#2D2D42] my-0.5" />
                                                <button 
                                                    onClick={() => { changeStatus(displayDump.id, 'history'); setOpenMenuId(null); }} 
                                                    className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors font-bold"
                                                >
                                                    <ArchiveIcon size={14} /> Archivar Pizarrón
                                                </button>
                                                
                                                <button 
                                                    onClick={() => { deleteDump(displayDump.id); setOpenMenuId(null); }} 
                                                    className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-bold"
                                                >
                                                    <Trash2 size={14} /> Eliminar Permanentemente
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* METADATA BAR (like TikTok) */}
                            <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/30 border-y border-zinc-100 dark:border-zinc-800/50 flex items-center gap-4 text-[10px] uppercase tracking-widest font-bold text-zinc-400">
                                <span className="flex items-center gap-1.5"><Calendar size={10} /> {formatCleanDate(displayDump.created_at)}</span>
                                {displayDump.updated_at && <span className="flex items-center gap-1.5"><Calendar size={10} /> {formatCleanDate(displayDump.updated_at)}</span>}
                            </div>

                             <div className="px-4 pb-4 pt-2 w-full flex-1 flex flex-col min-h-0 gap-[10px]">
                                <BrainDumpBreadcrumb 
                                    path={breadcrumbPath} 
                                    activeDumpId={displayDump.id} 
                                    onNavigate={navigate} 
                                />

                                {/* AI Assistant Panel (TOP) — Moved above tabs for parity */}
                                {showAIInput && (
                                    <div className="animate-slideDown shrink-0 mb-2">
                                        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 dark:bg-[#1A1A2E]/60 p-3">
                                            <div className="flex items-center justify-between mb-2 px-1">
                                                <span className="text-[11px] font-bold text-violet-400 flex items-center gap-1.5 uppercase tracking-widest">
                                                    <Sparkles size={11} className="text-violet-500" /> Consultar con IA
                                                </span>
                                                <button onClick={() => setShowAIInput(false)} className="text-zinc-400 hover:text-zinc-300 p-0.5">
                                                    <X size={13} />
                                                </button>
                                            </div>
                                            <BrainDumpAIPanel dumpId={displayDump.id} onGenerate={() => setShowAIInput(false)} getNewOrderIndex={getNewOrderIndex} />
                                        </div>
                                    </div>
                                )}

                                {/* TABS UNIFICADAS */}
                                {(manualChildren.length > 0 || completedSummaries.length > 0 || true) && (
                                    <div className="relative group/tabbar shrink-0">
                                        {/* Flecha Izquierda */}
                                        <div className={`absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white dark:from-[#1A1A24] to-transparent z-10 flex items-center justify-start pointer-events-none transition-opacity duration-150 ${canScrollTabsLeft ? 'opacity-100' : 'opacity-0'}`}>
                                            <button 
                                                onClick={() => scrollTabsHorizontally('left')} 
                                                className={`p-1 rounded-full bg-zinc-800 shadow-md text-zinc-400 hover:text-amber-500 transition-all active:scale-95 border ${hasSearchMatchTabsLeft ? 'border-amber-500 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,192,45,0.4)] scale-110' : 'border-zinc-700'} ml-1 ${canScrollTabsLeft ? 'pointer-events-auto' : 'pointer-events-none'}`}
                                            >
                                                <ChevronLeft size={14} />
                                            </button>
                                        </div>

                                        <div ref={tabBarRef} className={`flex items-center gap-1.5 overflow-x-auto pt-2 pb-1 shrink-0 min-w-0 hidden-scrollbar px-10 transition-all ${(!canScrollTabsLeft && !canScrollTabsRight) ? 'justify-center' : 'justify-start'}`}>
                                        {(() => {
                                            const originalIsMatch = Boolean(searchQuery?.trim() && (displayDump.content?.toLowerCase().includes(searchQuery.trim().toLowerCase()) || displayDump.scratchpad?.toLowerCase().includes(searchQuery.trim().toLowerCase())));
                                            return (
                                                <button 
                                                    onClick={() => setActiveTab('original')} 
                                                    data-active-tab={activeTab === 'original' || undefined}
                                                    data-is-match={originalIsMatch}
                                                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border shrink-0 transition-all ${
                                                        activeTab === 'original' 
                                                            ? `bg-amber-500 text-amber-950 border-amber-400 shadow-sm ${originalIsMatch ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-[#1A1A24] shadow-[0_0_15px_rgba(251,192,45,0.4)]' : ''}` 
                                                            : originalIsMatch
                                                                ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-100 shadow-[0_0_8px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                                                                : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:text-amber-400'
                                                    }`}
                                                >
                                                    <FileText size={11} /> 
                                                    {globalTasks?.some(t => t.id === focusedDumpId || t.linked_board_id === focusedDumpId) && (
                                                        <div className="absolute -top-1.5 -right-1.5 z-10"><KanbanSemaphore sourceType="board" sourceId={focusedDumpId!} sourceTitle="Pizarrón Original" /></div>
                                                    )}
                                                    Original
                                                </button>
                                            );
                                        })()}
                                        
                                        {(() => {
                                            // Unified tabs sorted by created_at (like TikTok)
                                            const allTabs = [
                                                ...manualChildren.map(c => ({ id: `sub_${c.id}`, type: 'sub' as const, order_index: c.order_index || 0, data: c })),
                                                ...completedSummaries.map(s => ({ id: s.id, type: 'summary' as const, order_index: s.order_index || 0, data: s }))
                                            ].sort((a, b) => a.order_index - b.order_index);

                                            return allTabs.map(tab => {
                                                if (tab.type === 'sub') {
                                                    const child = tab.data as BrainDump;
                                                    const isActive = activeTab === `sub_${child.id}`;
                                                    const isMatch = searchQuery?.trim() && checkPizarronSearchMatch(child, searchQuery.trim(), dumps, allSummaries);
                                                    return (
                                                        <div key={child.id} className="relative shrink-0 flex items-center group">
                                                            <button 
                                                                onClick={() => setActiveTab(`sub_${child.id}`)} 
                                                                data-active-tab={isActive || undefined}
                                                                data-is-match={isMatch}
                                                                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all max-w-[150px] ${
                                                                    isActive 
                                                                        ? `bg-emerald-600 text-white border-emerald-500 shadow-sm ${isMatch ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-[#1A1A24] shadow-[0_0_15px_rgba(251,192,45,0.4)]' : ''}` 
                                                                        : isMatch
                                                                            ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-100 shadow-[0_0_8px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                                                                            : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:text-emerald-400 font-bold'
                                                                }`}
                                                            >
                                                                {globalTasks?.some(t => t.id === child.id || t.linked_board_id === child.id) && (
                                                                    <div className="absolute -top-1.5 -right-1.5 z-10"><KanbanSemaphore sourceType="board" sourceId={child.id} sourceTitle={child.title || ''} /></div>
                                                                )}
                                                                <span onClick={(e) => { e.stopPropagation(); navigate(child.id); }} className="p-0.5 -ml-1 hover:bg-white/20 rounded-md transition-colors cursor-pointer" title="Entrar a este pizarrón"><GitBranch size={10} /></span>
                                                                <SubnoteTitle child={child} isActive={isActive} searchQuery={searchQuery} onRename={(id, title) => autoSave(id, { title })} />
                                                                {isActive && (
                                                                    <span 
                                                                        onClick={(e) => { e.stopPropagation(); deleteDump(child.id); }} 
                                                                        className="ml-1 p-0.5 hover:bg-black/20 rounded transition-colors text-white/70 hover:text-white" 
                                                                        title="Borrar sub-pizarrón"
                                                                    >
                                                                        <Trash2 size={10} />
                                                                    </span>
                                                                )}
                                                            </button>
                                                        </div>
                                                    );
                                                } else {
                                                    const s = tab.data as Summary;
                                                    const isMatch = searchQuery?.trim() && (
                                                        (s.content || '').toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                                                        (s.target_objective || '').toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                                                        (s.scratchpad || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
                                                    );
                                                    return (
                                                        <button 
                                                            key={s.id} 
                                                            onClick={() => setActiveTab(s.id)} 
                                                            data-active-tab={activeTab === s.id || undefined}
                                                            data-is-match={isMatch}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border shrink-0 transition-all max-w-[150px] ${
                                                            activeTab === s.id 
                                                                ? `bg-violet-600 text-white border-violet-500 shadow-sm ${isMatch ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-[#1A1A24] shadow-[0_0_15px_rgba(251,192,45,0.4)]' : ''}` 
                                                                : isMatch
                                                                    ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-100 shadow-[0_0_8px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                                                                    : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:text-violet-400'
                                                        }`}>
                                                            <Sparkles size={10} /> 
                                                            <SummaryTitle
                                                                summary={s}
                                                                isActive={activeTab === s.id}
                                                                searchQuery={searchQuery}
                                                                onRename={(id, newObj) => updateSummaryMetadata(id, { target_objective: newObj })}
                                                            />
                                                        </button>
                                                    );
                                                }
                                            });
                                        })()}
                                        </div>

                                        {/* Flecha Derecha */}
                                        <div className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white dark:from-[#1A1A24] to-transparent z-10 flex items-center justify-end pointer-events-none transition-opacity duration-150 ${canScrollTabsRight ? 'opacity-100' : 'opacity-0'}`}>
                                            <button 
                                                onClick={() => scrollTabsHorizontally('right')} 
                                                className={`p-1 rounded-full bg-white dark:bg-zinc-800 shadow-md text-zinc-400 hover:text-amber-500 transition-all active:scale-95 border ${hasSearchMatchTabsRight ? 'border-amber-500 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,192,45,0.4)] scale-110' : 'border-zinc-200 dark:border-zinc-700'} mr-1 ${canScrollTabsRight ? 'pointer-events-auto' : 'pointer-events-none'}`}
                                            >
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}



                                {/* CONTENIDO DE LA PESTAÑA */}
                                {(() => {
                                    const activeSubId = activeTab.startsWith('sub_') ? activeTab.replace('sub_', '') : null;
                                    const activeSub = activeSubId ? manualChildren.find(c => c.id === activeSubId) : null;
                                    const activeSummary = !activeSubId && activeTab !== 'original' ? completedSummaries.find(s => s.id === activeTab) : null;
                                    const showScratch = isBraindumpPizarronOpen;

                                    if (activeSummary) {
                                        return (
                                            <div className="flex-1 flex flex-col min-h-0 animate-fadeIn">
                                                <SummaryTabContent key={activeSummary!.id} summary={activeSummary!} noteFont={noteFont} noteFontSize={noteFontSize} noteLineHeight={noteLineHeight} onDelete={(id) => { deleteSummary(id); setActiveTab('original'); }} updateScratchpad={updateScratchpad} updateContent={updateSummaryContent} searchQuery={searchQuery} showScratch={showScratch} showLineNumbers={showLineNumbers} />
                                            </div>
                                        );
                                    }
                                    
                                    const currentNote = activeSub || displayDump;
                                    return (
                                        <div className="flex-1 flex flex-col min-h-0 animate-fadeIn">
                                            <SubnoteTabContent key={currentNote!.id} dump={currentNote!} showScratch={showScratch} onUpdate={autoSave} splitRatio={splitRatio} onDividerMouseDown={handleDividerMouseDown} splitContainerRef={splitContainerRef} noteFont={noteFont} noteFontSize={noteFontSize} noteLineHeight={noteLineHeight} searchQuery={searchQuery} showLineNumbers={showLineNumbers} />
                                        </div>
                                    );
                                })()}
                                </div>
                        </div>
                        );
                    })()}

                    {!focusedDumpId && (
                        <div className={`${isBraindumpMaximized ? 'max-w-full' : 'max-w-full md:max-w-6xl'} mx-auto w-full px-4 md:px-10 animate-fadeIn pb-10`}>
                            {/* LISTA PRINCIPAL DE PIZARRONES */}
                            <div className={`grid ${isBraindumpMaximized ? 'grid-cols-[repeat(auto-fit,340px)] w-full max-w-[2160px]' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl'} gap-6 justify-center mx-auto`}>


                                {rootPizarrones.map(p => {
                                    const isMatch = searchQuery?.trim() && checkPizarronSearchMatch(p, searchQuery.trim(), dumps, allSummaries);
                                    return (
                                        <div 
                                            key={p.id} 
                                            onClick={() => setFocusedDumpId(p.id)} 
                                            className={`group bg-white dark:bg-[#1A1A24] border rounded-2xl p-5 hover:shadow-xl transition-all cursor-pointer flex flex-col gap-3 relative animate-fadeIn ${
                                                isMatch 
                                                    ? 'border-amber-500 shadow-[0_0_20px_rgba(251,192,45,0.2)]' 
                                                    : 'border-zinc-200 dark:border-[#2D2D42] hover:border-amber-500/30'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <h3 className="font-bold text-zinc-800 dark:text-[#CCCCCC] truncate flex-1">
                                                    {searchQuery?.trim() ? highlightText(p.title || 'Sin Título', searchQuery.trim()) : (p.title || 'Sin Título')}
                                                </h3>

                                                <div className={`${globalTasks?.some(t => t.id === p.id || t.linked_board_id === p.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                                    <KanbanSemaphore sourceType="board" sourceId={p.id} sourceTitle={p.title || ''} onInteract={() => setFocusedDumpId(p.id)} />
                                                </div>
                                            </div>
                                            <div className="text-xs text-zinc-500 line-clamp-3 leading-relaxed min-h-[4.5em] overflow-hidden">
                                                {searchQuery?.trim() ? highlightText(p.content || '', searchQuery.trim()) : (p.content || <span className="italic opacity-40">Pizarrón vacío...</span>)}
                                            </div>
                                            <div className="flex items-center justify-between pt-2 border-t border-zinc-50 dark:border-zinc-800/50 mt-auto">
                                                <span className="text-[10px] font-bold text-zinc-400">{formatCleanDate(p.updated_at || p.created_at)}</span>
                                                <div className="flex items-center gap-2">
                                                    {p.is_checklist && <ListTodo size={12} className="text-amber-500/60" />}
                                                    <button 
                                                      onClick={(e) => { e.stopPropagation(); autoSave(p.id, { is_pinned: !p.is_pinned }); }} 
                                                      className={`p-1.5 rounded-lg transition-all active:scale-95 hover:bg-amber-50 dark:hover:bg-amber-900/20 ${p.is_pinned ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400 hover:text-amber-600'}`} 
                                                      title={p.is_pinned ? 'Quitar fijado' : 'Fijar pizarrón'}
                                                    >
                                                      <Pin size={14} className={p.is_pinned ? 'fill-current' : ''} />
                                                    </button>
                                                    <button 
                                                      onClick={(e) => { e.stopPropagation(); changeStatus(p.id, 'history'); }} 
                                                      className="p-1 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" 
                                                      title="Archivar"
                                                    >
                                                      <ArchiveIcon size={14} />
                                                    </button>

                                                    <div className="w-6 h-6 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-400 group-hover:bg-[#4940D9] group-hover:text-white transition-all"><ChevronRight size={14} /></div>

                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* ARCHIVO */}
                            {archivo.length > 0 && (
                                <div className={`mt-12 space-y-4 pt-8 border-t border-zinc-100 dark:border-[#2D2D42]/40 animate-fadeIn ${isArchiveOpenByApp['braindump'] ? 'pb-20' : 'pb-10'}`}>
                                    <button 
                                        onClick={() => setArchiveOpenByApp('braindump', !isArchiveOpenByApp['braindump'])}
                                        className="flex items-center gap-3 text-zinc-400 font-bold uppercase tracking-widest text-xs
 px-2 hover:text-amber-600 transition-colors group/archheader"
                                    >
                                        <ArchiveIcon size={16} className="text-zinc-500/50 group-hover/archheader:text-amber-500/50 transition-colors" /> 
                                        <span>Archivo ({archivo.length})</span>
                                        <ChevronDown size={14} className={`transition-transform duration-300 ${isArchiveOpenByApp['braindump'] ? '' : '-rotate-90'}`} />
                                    </button>
                                    
                                    {isArchiveOpenByApp['braindump'] && (
                                        <div className={`grid ${isBraindumpMaximized ? 'grid-cols-[repeat(auto-fit,340px)] w-full max-w-[2160px]' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl'} gap-4 justify-center mx-auto`}>



                                            {archivo.map(a => (
                                                <div key={a.id} className="p-4 bg-white dark:bg-[#1A1A24]/50 border border-zinc-200 dark:border-[#2D2D42] rounded-2xl flex items-center justify-between group hover:border-amber-500/30 transition-all">
                                                    <div className="flex items-center gap-3 truncate"><div className="w-8 h-8 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-400">
                                                         <ArchiveIcon size={16} />
                                                       </div>
                                                       <div className="flex flex-col truncate">
                                                         <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 truncate">{a.title || 'Sin Título'}</span>
                                                         <span className="text-[10px] text-zinc-400 font-medium">{formatCleanDate(a.updated_at || a.created_at)}</span>
                                                       </div>
</div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button onClick={() => changeStatus(a.id, 'main')} className="p-1.5 hover:text-indigo-500" title="Restaurar"><RotateCcw size={14}/></button>
                                                        <button onClick={() => deleteDump(a.id)} className="p-1.5 hover:text-red-500" title="Eliminar"><Trash2 size={14}/></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {isLinkModalOpen && linkingPizarron && (
                <PizarronLinkerModal pizarron={linkingPizarron} groups={groups} onClose={() => setIsLinkModalOpen(false)} onSuccess={(groupId, noteId) => { setIsLinkModalOpen(false); onOpenNote?.(groupId, noteId); }} />
            )}
        </div>
    );
};