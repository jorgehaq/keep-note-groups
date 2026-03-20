import React, { useState, useRef, useEffect } from 'react';
import { Archive, ChevronUp, Trash2, Check, Pin, PanelLeft, Loader2, CloudCheck, X, MoreVertical, Clock, ListTodo, CheckSquare, Square, GripVertical, Download, Clipboard, CopyPlus, FolderInput, Hash, Sparkles, FileText, PenLine, ArrowUpRight, GitBranch, Plus, Wind, ListPlus, History } from 'lucide-react';
import { Note, NoteFont } from '../types';
import { SmartNotesEditor, SmartNotesEditorRef } from '../src/components/editor/SmartNotesEditor';
import { ChecklistEditor, ChecklistEditorRef, parseMarkdownToChecklist, serializeChecklistToMarkdown, serializeChecklistToPlainMarkdown } from '../src/components/editor/ChecklistEditor';
import { KanbanSemaphore } from './KanbanSemaphore';
import { MoveToGroupModal } from './MoveToGroupModal';
import { Group } from '../types';
import { Session } from '@supabase/supabase-js';
import { NoteAIPanel } from './NoteAIPanel';
import { NoteBreadcrumb } from './NoteBreadcrumb';
import { useNoteTree } from '../src/lib/useNoteTree';
import { useSummaries, Summary } from '../src/lib/useSummaries';
import { useUIStore } from '../src/lib/store';
import { supabase } from '../src/lib/supabaseClient';

interface AccordionItemProps {
  note: Note;
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onExportNote?: (note: Note) => void;
  onCopyNote?: (note: Note) => void;
  onDuplicate?: (noteId: string) => void;
  onMove?: (noteId: string, targetGroupId: string) => Promise<void>;
  onCreateNote?: (content: string, title: string, groupId?: string) => Promise<void>;
  groups?: Group[];
  searchQuery?: string;
  noteFont?: NoteFont;
  noteFontSize?: string;
  noteLineHeight?: string;
  isHighlightedBySearch?: boolean;
  showLineNumbers?: boolean;
  onToggleLineNumbers?: () => void;
  session?: Session | null;
  syncStatus?: 'idle' | 'saving' | 'saved';
  groupNotes?: Note[];
  allSummaries?: any[];
}

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

// Badge con conteo de summaries para el botón AI del header
const AIBadge: React.FC<{ count: number; hasPending: boolean; active: boolean; onClick: () => void }> = ({ count, hasPending, active, onClick }) => {

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={active ? 'Ocultar panel AI' : 'Abrir panel AI'}
      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
        active
          ? 'bg-violet-600 text-white border-violet-500 shadow-sm shadow-violet-500/20'
          : 'text-violet-400 border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10'
      }`}
    >
      {hasPending
        ? <Loader2 size={13} className="animate-spin" />
        : <Sparkles size={13} />}
      {count > 0 && (
        <span className={`text-[10px] font-black ${active ? 'text-white/80' : 'text-violet-300'}`}>
          {count}
        </span>
      )}
    </button>
  );
};

const SummaryTabContent: React.FC<{
  summary: Summary;
  noteFont?: NoteFont;
  noteFontSize?: string;
  noteLineHeight?: string;
  showLineNumbers?: boolean;
  searchQuery?: string;
  onPromote?: (content: string, title: string) => void;
  updateScratchpad: (id: string, text: string) => void;
  updateContent: (id: string, text: string) => void;
  showScratch: boolean;
  setShowScratch: (val: boolean | ((v: boolean) => boolean)) => void;
  onDelete: (id: string) => void;
}> = ({ summary, noteFont, noteFontSize, noteLineHeight, showLineNumbers, searchQuery, onDelete, onPromote, updateScratchpad, updateContent, showScratch, setShowScratch }) => {
  const scratchRef = useRef<SmartNotesEditorRef>(null);
  const [localScratch, setLocalScratch] = useState(summary.scratchpad || '');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

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
            <span className="text-[11px] font-bold text-violet-600 dark:text-violet-300 truncate">
              {summary.target_objective || 'Análisis AI'}
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-600 shrink-0">
              {new Date(summary.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Botón Pizarrón (Móvil) */}
            <button
              className="md:hidden p-1.5 rounded-lg text-zinc-500 hover:text-violet-300 hover:bg-violet-500/10 transition-colors flex items-center gap-1.5"
              onClick={(e) => { e.stopPropagation(); setShowScratch(!showScratch); }}
              title={showScratch ? "Ver Resumen" : "Ver Pizarrón"}
            >
              {showScratch ? <Sparkles size={14} /> : <PenLine size={14} />}
            </button>
            <div className="relative" ref={menuRef}>
               <button 
                 onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                 className={`p-1.5 rounded-lg transition-colors ${
                     isMenuOpen ? 'bg-violet-500/20 text-violet-300' : 'text-zinc-500 hover:text-violet-300 hover:bg-violet-500/10'
                 }`}
                 title="Opciones del Análisis"
               >
                 <MoreVertical size={14} />
               </button>
                 
               {isMenuOpen && (
                 <div className="absolute right-0 top-full mt-1 min-w-[180px] bg-white dark:bg-[#1A1A24] rounded-lg shadow-xl border border-zinc-200 dark:border-[#2D2D42] p-1 z-50 overflow-hidden animate-fadeIn">
                   {onPromote && (
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         onPromote(summary.content || '', summary.target_objective ? `✨ ${summary.target_objective.slice(0,50)}` : '✨ Nota AI');
                         setIsMenuOpen(false);
                       }}
                       className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-zinc-700 dark:text-zinc-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
                     >
                       <ArrowUpRight size={14} /> Convertir a Nota
                     </button>
                   )}
                   {onPromote && <div className="h-px bg-zinc-200 dark:bg-[#2D2D42] my-1" />}
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       onDelete(summary.id);
                       setIsMenuOpen(false);
                     }}
                     className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                   >
                     <Trash2 size={14} /> Eliminar Análisis
                   </button>
                 </div>
               )}
            </div>
          </div>
        </div>
        <div className={`px-4 py-3 min-w-0 ${showScratch ? 'hidden md:block' : 'block'}`}>
          <SmartNotesEditor
            noteId={`summary_${summary.id}`}
            initialContent={summary.content || ''}
            onChange={(text) => updateContent(summary.id, text)}
            noteFont={noteFont}
            noteFontSize={noteFontSize}
            noteLineHeight={noteLineHeight}
            showLineNumbers={showLineNumbers}
            searchQuery={searchQuery}
          />
        </div>
      </div>

      <div className={`flex flex-col flex-1 min-h-0 rounded-xl border border-violet-200/50 dark:border-violet-900/30 bg-violet-50/10 dark:bg-violet-900/5 animate-fadeIn overflow-hidden ${!showScratch ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-violet-200/20 shrink-0">
          <PenLine size={11} className="text-violet-400" />
          <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest flex-1">Pizarrón</span>
        </div>
        <div onClick={(e) => {
          if ((e.target as HTMLElement).closest('.cm-panel, .cm-search, .cm-search-marker-container')) return;
          scratchRef.current?.focus();
        }}
          className="note-editor-scroll flex-1 p-4 cursor-text overflow-y-scroll min-h-[120px]">
          <SmartNotesEditor
            ref={scratchRef}
            noteId={`scratch_${summary.id}`}
            initialContent={localScratch}
            onChange={handleScratchChange}
            noteFont={noteFont}
            noteFontSize={noteFontSize}
            noteLineHeight={noteLineHeight}
            showLineNumbers={showLineNumbers}
            searchQuery={searchQuery}
          />
        </div>
      </div>
    </div>
  );
};

const SubnoteTitle: React.FC<{
  child: Note;
  isActive: boolean;
  onRename: (id: string, title: string) => void;
  searchQuery?: string;
}> = ({ child, isActive, onRename, searchQuery }) => {
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
        onMouseDown={e => e.stopPropagation()}
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
      {searchQuery?.trim() ? highlightText(child.title || 'Sin título', searchQuery) : (child.title || 'Sin título')}
    </span>
  );
};

const SubnoteTabContent: React.FC<{
  note: Note;
  showScratch: boolean;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  splitRatio: number;
  onDividerMouseDown: (e: React.MouseEvent) => void;
  splitContainerRef: React.RefObject<HTMLDivElement>;
  noteFont: NoteFont;
  noteFontSize: string;
  noteLineHeight: string;
  showLineNumbers: boolean;
  searchQuery?: string;
  onUpdateScratch: (text: string) => void;
  onUpdateContent: (text: string) => void;
  editorRef: React.RefObject<SmartNotesEditorRef>;
  scratchRef: React.RefObject<SmartNotesEditorRef>;
  checklistRef: React.RefObject<ChecklistEditorRef>;
}> = ({
  note,
  showScratch,
  splitRatio,
  onDividerMouseDown,
  splitContainerRef,
  noteFont,
  noteFontSize,
  noteLineHeight,
  showLineNumbers,
  searchQuery,
  onUpdateScratch,
  onUpdateContent,
  editorRef,
  scratchRef,
  checklistRef
}) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const borderColor = note.parent_note_id ? 'border-emerald-500/30' : 'border-zinc-200 dark:border-[#2D2D42]';

  return (
    <div
      ref={splitContainerRef}
      className={`flex-1 flex min-h-0 ${isMobile ? 'flex-col' : 'flex-row'} gap-2 animate-fadeIn`}
    >
      <div
        className={`min-h-0 overflow-hidden rounded-xl border ${borderColor} bg-zinc-50 dark:bg-zinc-900/20`}
        style={showScratch
          ? (isMobile
              ? { height: `${splitRatio * 100}%`, flex: 'none' }
              : { width: `${splitRatio * 100}%`, flex: 'none' })
          : { flex: '1' }
        }
      >
        {note.is_checklist ? (
          <div className="p-4 h-full overflow-y-auto note-editor-scroll">
            <ChecklistEditor ref={checklistRef} idPrefix={note.id} initialContent={note.content || ''} onUpdate={onUpdateContent} />
          </div>
        ) : (
          <div
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('.cm-panel, .cm-search')) return;
              editorRef.current?.focus();
            }}
            className="p-4 h-full overflow-y-auto cursor-text note-editor-scroll"
          >
            <SmartNotesEditor
              key={note.id}
              ref={editorRef}
              noteId={note.id}
              initialContent={note.content || ''}
              searchQuery={searchQuery}
              onChange={onUpdateContent}
              noteFont={noteFont}
              noteFontSize={noteFontSize}
              noteLineHeight={noteLineHeight}
              showLineNumbers={showLineNumbers}
            />
          </div>
        )}
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
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('.cm-panel, .cm-search')) return;
              scratchRef.current?.focus();
            }}
            className="flex-1 p-4 overflow-y-auto cursor-text note-editor-scroll"
          >
            <SmartNotesEditor
              key={`scratch_${note.id}`}
              ref={scratchRef}
              noteId={`scratch_note_${note.id}`}
              initialContent={note.scratchpad || ''}
              onChange={onUpdateScratch}
              noteFont={noteFont}
              noteFontSize={noteFontSize}
              noteLineHeight={noteLineHeight}
              showLineNumbers={showLineNumbers}
              searchQuery={searchQuery}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const AccordionItem: React.FC<AccordionItemProps> = ({
  note,
  onToggle,
  onUpdate,
  onDelete,
  onArchive,
  onExportNote,
  onCopyNote,
  onDuplicate,
  onMove,
  onCreateNote,
  groups = [],
  searchQuery,
  noteFont = 'sans',
  noteFontSize = 'medium',
  noteLineHeight = 'standard',
  isHighlightedBySearch = false,
  showLineNumbers = false,
  onToggleLineNumbers,
  session,
  syncStatus: propSyncStatus = 'idle',
  allSummaries = [],
  groupNotes = []
}) => {

  const checkNoteMatch = (n: Note, q: string, all: Note[], sums: any[]): boolean => {
    if (!q) return false;
    const lowerQ = q.toLowerCase();
    if (n.title?.toLowerCase().includes(lowerQ) || n.content?.toLowerCase().includes(lowerQ) || n.scratchpad?.toLowerCase().includes(lowerQ)) return true;
    
    const nSums = sums.filter(s => s.note_id === n.id);
    if (nSums.some(s => s.content?.toLowerCase().includes(lowerQ) || s.target_objective?.toLowerCase().includes(lowerQ) || s.scratchpad?.toLowerCase().includes(lowerQ))) return true;
    
    const kids = all.filter(c => c.parent_note_id === n.id);
    return kids.some(k => checkNoteMatch(k, q, all, sums));
  };

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(!note.title);
  const [tempTitle, setTempTitle] = useState(note.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<SmartNotesEditorRef>(null);
  const checklistRef = useRef<ChecklistEditorRef>(null);
  const fontClass = noteFont === 'serif' ? 'font-serif' : noteFont === 'mono' ? 'font-mono text-xs' : 'font-sans';

 
   const { 
     aiPanelOpenByNote, 
     activeTabByNote, 
     isNotesPizarronOpen,
     setAiPanelOpen, 
     setActiveTab: setStoreActiveTab,
     setIsNotesPizarronOpen,
     globalTasks
   } = useUIStore();
   const { activeNoteId, activeNote, breadcrumbPath, navigate } = useNoteTree(note.id);
   const isRootLevel = !activeNoteId || activeNoteId === note.id;
   const displayContent = isRootLevel ? note.content : (activeNote?.content ?? '');
   const displayNoteId = isRootLevel ? note.id : activeNoteId;
 
   const showAIPanel = aiPanelOpenByNote[displayNoteId] || false;
   const setShowAIPanel = (val: boolean | ((v: boolean) => boolean)) => {
     const next = typeof val === 'function' ? val(showAIPanel) : val;
     setAiPanelOpen(displayNoteId, next);
   };
 
   const activeTab = activeTabByNote[displayNoteId] || 'original';
   const setActiveTab = (tabId: string) => setStoreActiveTab(displayNoteId, tabId);
   const { summaries: aiSummaries, deleteSummary, updateScratchpad, updateSummaryContent, loading: summariesLoading, hasFetched } = useSummaries(displayNoteId);
   const completedSummaries = aiSummaries.filter(s => s.status === 'completed');
 
   const manualChildren = groupNotes.filter(n => n.parent_note_id === displayNoteId && !n.ai_generated);
   const childrenLoaded = true; // Since we rely on global state
 
   // Fallback to 'original' if the active tab summary/subnote is missing
   useEffect(() => {
     if (summariesLoading || !hasFetched) return;
     if (activeTab === 'original') return;
 
     const isSubnote = activeTab.startsWith('sub_');
     if (isSubnote) {
       const subId = activeTab.replace('sub_', '');
       if (!manualChildren.find(c => c.id === subId)) {
         console.log(`Fallback to original: subnote ${subId} not found`);
         setActiveTab('original');
       }
     } else {
       // It's a summary
       if (!completedSummaries.find(s => s.id === activeTab)) {
         console.log(`Fallback to original: summary ${activeTab} not found`);
         setActiveTab('original');
       }
     }
   }, [completedSummaries.length, manualChildren.length, summariesLoading, hasFetched, activeTab, displayNoteId]);
 
   // Auto-switch to newest summary ONLY when a NEW one arrives in the CURRENT session
   const prevCountRef = useRef<number | null>(null);
   useEffect(() => {
     if (summariesLoading) {
       prevCountRef.current = null; // Reset on note change/load
       return;
     }
     
     // First time loading completes for this note instance
     if (prevCountRef.current === null) {
       prevCountRef.current = completedSummaries.length;
       return;
     }
 
     // Only auto-switch if count increased (new arrival) and panel is visible
     if (completedSummaries.length > prevCountRef.current && showAIPanel) {
       if (completedSummaries.length > 0) {
         setActiveTab(completedSummaries[0].id);
       }
     }
     prevCountRef.current = completedSummaries.length;
   }, [completedSummaries.length, showAIPanel, summariesLoading, displayNoteId]);
 
   const isInKanban = globalTasks?.some(t => t.id === note.id || t.linked_note_id === note.id) || false;

  // ── PIZARRON DE LA NOTA ORIGINAL (PERSISTENTE) ──────────────────────────────
  // ── PIZARRON DE LA NOTA ORIGINAL (PERSISTENTE GLOBAL - COMO TIKTOK) ────────
  const showNoteScratch = isNotesPizarronOpen;
  const setShowNoteScratch = (val: boolean | ((v: boolean) => boolean)) => {
    const next = typeof val === 'function' ? val(showNoteScratch) : val;
    setIsNotesPizarronOpen(next);
  };
  const [localNoteScratch, setLocalNoteScratch] = useState(note.scratchpad || '');
  const noteScratchRef = useRef<SmartNotesEditorRef>(null);
  const scratchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // ── AI INPUT COLAPSABLE ────────────────────────────────────────────────────
  const [showAIInput, setShowAIInput] = useState(false);

  // ── SPLIT RATIO (pizarron) ─────────────────────────────────────────────────
  const [splitRatio, setSplitRatio] = useState(0.5); // 50/50 por defecto
  const isDraggingRef = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Sync scratchpad local con nota cuando cambia note.id
  useEffect(() => {
    setLocalNoteScratch(note.scratchpad || '');
  }, [note.id]);

  const handleDeleteSummary = (id: string) => {
    deleteSummary(id);
    if (activeTab === id) setActiveTab('original');
  };

  useEffect(() => {
    const isActuallyFocused = document.activeElement === titleInputRef.current;
    if (!isEditingTitle && !isActuallyFocused && note.title !== undefined && note.title !== tempTitle) {
      setTempTitle(note.title);
    }
  }, [note.title, isEditingTitle, tempTitle]);

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showStickyTitle, setShowStickyTitle] = useState(false);

  useEffect(() => {
    const headerEl = headerRef.current;
    const contentEl = contentRef.current;
    if (!headerEl || !contentEl) return;
    let isHeaderVisible = true;
    let isContentVisible = true;
    const checkVisibility = () => {
      setShowStickyTitle(!isHeaderVisible && isContentVisible);
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.target === headerEl) isHeaderVisible = entry.isIntersecting;
        if (entry.target === contentEl) isContentVisible = entry.isIntersecting;
      });
      checkVisibility();
    }, { root: null, threshold: 0, rootMargin: '-60px 0px 0px 0px' });
    observer.observe(headerEl);
    observer.observe(contentEl);
    return () => observer.disconnect();
  }, []);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) titleInputRef.current.focus();
  }, [isEditingTitle]);

  const handleNoteScratchChange = (text: string) => {
    setLocalNoteScratch(text);
    if (scratchDebounceRef.current) clearTimeout(scratchDebounceRef.current);
    scratchDebounceRef.current = setTimeout(() => {
      onUpdate(note.id, { scratchpad: text });
    }, 1200);
  };

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const container = splitContainerRef.current;
    if (!container) return;

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const rect = container.getBoundingClientRect();
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        // En móvil: drag vertical
        const ratio = (ev.clientY - rect.top) / rect.height;
        setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
      } else {
        // En desktop: drag horizontal
        const ratio = (ev.clientX - rect.left) / rect.width;
        setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
      }
    };
    const onUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleCreateSubnote = async () => {
    if (!session?.user) return;
    const title = `Nueva Nota`;
    const { data, error } = await supabase.from('notes').insert([{
      title,
      content: '',
      scratchpad: '',
      group_id: note.group_id,
      user_id: session.user.id,
      parent_note_id: displayNoteId,
      generation_level: (note.generation_level || 0) + 1,
      ai_generated: false,
      position: manualChildren.length,
    }]).select().single();
    if (!error && data) {
      setActiveTab(`sub_${data.id}`);
      // Actualizamos UIStore de forma optimista para que App.tsx vea la nueva nota de inmediato
      const store = useUIStore.getState();
      const currentGroups = store.groups;
      const updatedGroups = currentGroups.map(g => {
        if (g.id === note.group_id) {
            return { ...g, notes: [...g.notes, { ...data, isOpen: false }] };
        }
        return g;
      });
      store.setGroups(updatedGroups);
    }
  };

  const handleSaveChildTitle = async (childId: string, title: string) => {
    onUpdate(childId, { title });
  };


  const handleUpdateContent = (newMarkdown: string) => {
    onUpdate(displayNoteId, { content: newMarkdown });
  };

  const handleCancelTitle = () => {
    setTempTitle(note.title);
    setIsEditingTitle(false);
  };

  const handleSaveTitle = (shouldFocusEditor = false) => {
    setIsEditingTitle(false);
    onUpdate(note.id, { title: tempTitle.trim() });
  };

  const handlePromoteToNote = async (content: string, title: string) => {
    if (!onCreateNote) return;
    await onCreateNote(content, title, note.group_id);
  };

  return (
    <div className={`m-1 transition-all duration-300 flex-1 flex flex-col min-h-0 bg-white dark:bg-[#1A1A24] rounded-2xl shadow-lg border select-text ${
      isHighlightedBySearch
        ? 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-50/30 dark:bg-amber-900/10 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
        : 'border-zinc-200 dark:border-[#2D2D42] hover:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/50'
    }`}>

      {/* HEADER */}
      <div
        ref={headerRef}
        className="flex items-center justify-between px-4 pt-4 pb-2 transition-colors gap-2 min-w-0"
      >
        <div className="flex items-center gap-3 flex-1 overflow-hidden pl-1 min-w-0">
          <div className="flex flex-col min-w-0 justify-center w-full">
            <div className="relative flex w-full">
              <div className="absolute inset-0 w-full pointer-events-none text-lg font-bold px-0.5 min-h-[1.5em] flex items-center overflow-hidden whitespace-nowrap">
                <span className="truncate">
                  {searchQuery ? highlightText(tempTitle, searchQuery) : ""}
                </span>
              </div>
              <input
                ref={titleInputRef}
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onFocus={() => setIsEditingTitle(true)}
                onBlur={() => handleSaveTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle(true);
                  if (e.key === 'Escape') { e.stopPropagation(); handleCancelTitle(); }
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const editorContainer = contentRef.current;
                    if (editorContainer) {
                      const focusable = editorContainer.querySelector('input, .cm-content') as HTMLElement;
                      if (focusable) focusable.focus();
                    }
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="Título de la nota..."
                className={`w-full min-w-0 bg-transparent text-lg font-bold outline-none placeholder-zinc-400 transition-colors cursor-text pr-2 ${
                  searchQuery && tempTitle.toLowerCase().includes(searchQuery.toLowerCase())
                    ? "text-transparent caret-zinc-800 dark:caret-[#CCCCCC]"
                    : "text-zinc-800 dark:text-[#CCCCCC]"
                }`}
                title="Haz clic para editar"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Botón Nueva subnota */}
          {session?.user && (
            <button
              onClick={(e) => { e.stopPropagation(); handleCreateSubnote(); }}
              title="Nueva subnota"
              className="p-2 rounded-xl border text-emerald-400 border-zinc-200 dark:border-zinc-700 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all flex items-center"
            >
              <ListPlus size={13} />
            </button>
          )}

          {/* Botón AI */}
          {session?.user && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAIInput(v => !v); }}
              title={showAIInput ? 'Ocultar panel AI' : 'Abrir panel AI'}
              className={`p-2 rounded-xl border transition-all ${
                showAIInput 
                  ? 'bg-[#4940D9] border-[#4940D9]/80 text-white font-bold shadow-lg shadow-[#4940D9]/20' 
                  : 'text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-[#4940D9]/30'
              }`}
            >
              <Sparkles size={13} />
            </button>
          )}

          {/* Botón pizarrón en header */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowNoteScratch(v => !v); }}
            title={showNoteScratch ? 'Ocultar pizarrón' : 'Abrir pizarrón'}
            className={`p-2 rounded-xl border transition-all ${
              showNoteScratch
                ? 'bg-[#4940D9] border-[#4940D9]/80 text-white font-bold shadow-lg shadow-[#4940D9]/20' 
                : 'text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-[#4940D9]/30'
            }`}
          >
            <PenLine size={13} />
          </button>

          {/* Botón Zen */}
          <button
            onClick={(e) => { e.stopPropagation(); useUIStore.getState().toggleZenMode('notes'); }}
            className={`p-2 rounded-xl border transition-all ${
              useUIStore.getState().isZenModeByApp['notes']
                ? 'bg-[#4940D9] border-[#4940D9]/80 text-white font-bold shadow-lg shadow-[#4940D9]/20' 
                : 'text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-[#4940D9]/30'
            }`}
            title={useUIStore.getState().isZenModeByApp['notes'] ? "Salir de Modo Zen" : "Entrar a Modo Zen"}
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

          {note.is_docked && (
            <button
              onClick={(e) => { e.stopPropagation(); onUpdate(note.id, { is_docked: false }); }}
              className="p-1.5 rounded-lg transition-colors text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 shrink-0"
              title="Quitar del Sidebar"
            >
              <PanelLeft size={14} />
            </button>
          )}

          {note.is_pinned && (
            <button
              onClick={(e) => { e.stopPropagation(); onUpdate(note.id, { is_pinned: false }); }}
              className="p-1.5 rounded-lg transition-colors text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 shrink-0"
              title="Desfijar Nota"
            >
              <Pin size={14} className="fill-current" />
            </button>
          )}

          {isInKanban && (
            <div className="flex items-center gap-2">
              <KanbanSemaphore sourceType="note" sourceId={note.id} sourceTitle={note.title || 'Sin título'} onInteract={() => {}} />
            </div>
          )}

          <div className="relative shrink-0 flex items-center" ref={mobileMenuRef}>
            <button onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(!isMobileMenuOpen); }} className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"><MoreVertical size={16} /></button>
            {isMobileMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-[#1A1A24] shadow-xl rounded-lg border border-zinc-200 dark:border-[#2D2D42] p-1 flex flex-col gap-0.5 min-w-[180px] animate-fadeIn">
                {/* GRUPO 1: Estados de la nota */}
                {onToggleLineNumbers && (
                  <button onClick={(e) => { e.stopPropagation(); onToggleLineNumbers(); setIsMobileMenuOpen(false); }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${showLineNumbers ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}>
                    <Hash size={14} /> {showLineNumbers ? 'Ocultar números' : 'Mostrar números'}
                  </button>
                )}
                
                <button onClick={(e) => { e.stopPropagation(); e.currentTarget.blur(); onUpdate(note.id, { is_docked: !note.is_docked }); setIsMobileMenuOpen(false); }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${note.is_docked ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}>
                  <PanelLeft size={14} />{note.is_docked ? 'Quitar del Sidebar' : 'Anclar al Sidebar'}
                </button>
                
                <button onClick={(e) => { e.stopPropagation(); e.currentTarget.blur(); onUpdate(note.id, { is_pinned: !note.is_pinned }); setIsMobileMenuOpen(false); }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${note.is_pinned ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}>
                  <Pin size={14} className={note.is_pinned ? "fill-current" : ""} />{note.is_pinned ? 'Desfijar Nota' : 'Fijar Nota'}
                </button>
                
                {!isInKanban && (
                  <button onClick={async (e) => { 
                    e.stopPropagation(); 
                    await supabase.from('tasks').upsert({ id: note.id, title: note.title || 'Sin título', status: 'backlog' });
                    window.dispatchEvent(new CustomEvent('kanban-updated'));
                    setIsMobileMenuOpen(false);
                  }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                    <CheckSquare size={14} /> Añadir a Kanban
                  </button>
                )}
                
                {/* SEPARADOR 1 */}
                <div className="border-t border-zinc-100 dark:border-zinc-700 my-0.5" />
                
                {/* GRUPO 2: Checklist */}
                <button onClick={(e) => {
                  e.stopPropagation();
                  const willBeChecklist = !note.is_checklist;
                  let newContent = displayContent;
                  if (willBeChecklist) {
                    newContent = serializeChecklistToMarkdown(parseMarkdownToChecklist(displayContent));
                  } else {
                    // Si ya existe el ref, usar los items actuales para no depender de props desincronizadas
                    const currentItems = checklistRef.current?.getItems();
                    if (currentItems) {
                      newContent = serializeChecklistToPlainMarkdown(currentItems);
                    } else {
                      newContent = serializeChecklistToPlainMarkdown(parseMarkdownToChecklist(displayContent));
                    }
                  }
                  onUpdate(displayNoteId, { is_checklist: willBeChecklist, content: newContent });
                  setIsMobileMenuOpen(false);
                }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${note.is_checklist ? 'text-[#1F3760] dark:text-blue-400 bg-blue-50 dark:bg-[#1F3760]/20' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}>
                  <ListTodo size={14} />{note.is_checklist ? 'Quitar Checklist' : 'Hacer Checklist'}
                </button>

                {/* SEPARADOR 2 */}
                <div className="border-t border-zinc-100 dark:border-zinc-700 my-0.5" />
                
                {/* GRUPO 3: Utilidades */}
                {onCopyNote && <button onClick={(e) => { e.stopPropagation(); onCopyNote(note); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><Clipboard size={14} />Copiar Nota</button>}
                {onDuplicate && <button onClick={(e) => { e.stopPropagation(); onDuplicate(note.id); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><CopyPlus size={14} />Duplicar Nota</button>}
                {onMove && <button onClick={(e) => { e.stopPropagation(); setIsMoveModalOpen(true); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42] transition-colors"><FolderInput size={14} />Mover de Grupo</button>}
                {onExportNote && <button onClick={(e) => { e.stopPropagation(); onExportNote(note); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><Download size={14} />Exportar (.md)</button>}
                
                {/* SEPARADOR 3 */}
                <div className="border-t border-zinc-100 dark:border-zinc-700 my-0.5" />
                
                {/* GRUPO 4: Gestión */}
                {onArchive && (
                  <button onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(false); onArchive(note.id); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 font-bold transition-colors">
                    <Archive size={14} /> Archivar Nota
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(false); if (confirm('¿Estás seguro de eliminar esta nota?')) onDelete(note.id); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={14} />Eliminar Permanente</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div
        ref={contentRef}
        className="flex-1 flex flex-col min-h-0 bg-transparent relative select-text"
      >
        {showStickyTitle && (
          <div className="sticky top-4 left-0 right-0 z-[40] flex justify-center pointer-events-none animate-fadeIn px-4">
            <div onClick={(e) => { e.stopPropagation(); headerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="bg-white/95 dark:bg-zinc-100/95 backdrop-blur-md text-zinc-900 dark:text-zinc-900 px-5 py-1.5 rounded-full shadow-lg shadow-black/10 text-[13px] font-bold flex items-center gap-2 pointer-events-auto cursor-pointer active:scale-95 transition-all border border-zinc-200/50 dark:border-zinc-300 w-auto max-w-[90%] sm:max-w-[400px] hover:shadow-xl"><span className="truncate">{note.title || 'Sin título'}</span><ChevronUp size={14} className="opacity-70 shrink-0" /></div>
          </div>
        )}

        <div className="px-4 pb-4 pt-2 w-full flex-1 flex flex-col min-h-0 gap-[10px]">
          <NoteBreadcrumb
            path={breadcrumbPath}
            activeNoteId={activeNoteId || note.id}
            onNavigate={navigate}
          />

          {/* PANEL AI — generador, colapsable */}
          {showAIPanel && session?.user && (
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 dark:bg-[#1A1A2E]/60 p-4 animate-fadeIn shrink-0">
              <NoteAIPanel
                noteId={displayNoteId}
                userId={session.user.id}
                noteStatus={note.ai_summary_status ?? 'idle'}
                onPromoteToNote={onCreateNote ? handlePromoteToNote : undefined}
              />
            </div>
          )}

          {/* ── BARRA DE TABS UNIFICADA — siempre visible si hay hijos o summaries ── */}
          {(manualChildren.length > 0 || aiSummaries.length > 0 || childrenLoaded) && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 shrink-0 min-w-0">

              {/* Tab Original */}
              <button
                onClick={() => setActiveTab('original')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border shrink-0 transition-all ${
                  activeTab === 'original'
                    ? 'bg-[#4940D9] text-white border-[#4940D9] shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                }`}
              >
                <FileText size={11} /> Original
              </button>

               {/* Tabs subnotas manuales — verdes */}
              {manualChildren.map((child) => {
                const isActive = activeTab === `sub_${child.id}`;
                const isMatch = searchQuery?.trim() && checkNoteMatch(child, searchQuery.trim(), groupNotes, allSummaries);

                return (
                  <div key={child.id} className="relative shrink-0 flex items-center group">
                    <button
                      onClick={() => setActiveTab(`sub_${child.id}`)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all max-w-[150px] ${
                        isActive
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                          : isMatch
                            ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-100 shadow-[0_0_8px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                            : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-emerald-500/50 hover:text-emerald-400'
                      }`}
                    >
                      <GitBranch size={10} className="shrink-0" />
                      <SubnoteTitle
                        child={child}
                        isActive={isActive}
                        onRename={handleSaveChildTitle}
                        searchQuery={searchQuery}
                      />
                      {isActive && (
                        <span 
                          onClick={(e) => { e.stopPropagation(); if (confirm('¿Borrar esta sub-nota?')) onDelete(child.id); }} 
                          className="ml-1 p-0.5 hover:bg-black/20 rounded transition-colors text-white/70 hover:text-white" 
                          title="Borrar sub-nota"
                        >
                          <Trash2 size={10} />
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}

              {/* Tabs AI summaries — violetas (procesando) */}
              {aiSummaries.filter(s => s.status === 'pending' || s.status === 'processing').map(s => (
                <div key={s.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border shrink-0 max-w-[150px] bg-zinc-800/60 border-zinc-700 text-zinc-400 animate-pulse"
                >
                  <Loader2 size={10} className="animate-spin shrink-0" />
                  <span className="truncate">{s.target_objective || 'Analizando...'}</span>
                </div>
              ))}

               {/* Tabs AI summaries — violetas (completados) */}
              {completedSummaries.map(s => {
                const isMatch = searchQuery?.trim() && (
                  s.content?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                  s.target_objective?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                  s.scratchpad?.toLowerCase().includes(searchQuery.trim().toLowerCase())
                );
                return (
                  <button key={s.id}
                    onClick={() => setActiveTab(activeTab === s.id ? 'original' : s.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border shrink-0 transition-all max-w-[150px] ${
                      activeTab === s.id
                        ? 'bg-violet-600 text-white border-violet-500 shadow-sm'
                        : isMatch
                          ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-100 shadow-[0_0_8px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                          : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-violet-500/40 hover:text-violet-400'
                    }`}
                  >
                  <Sparkles size={10} className="shrink-0" />
                  <span className="truncate">{s.target_objective || 'Análisis'}</span>
                </button>
              );
            })}

            </div>
          )}


          {/* ── AI INPUT PANEL — sobre el contenido activo (como TikTok/Pizarrón) ─── */}
          {session?.user && showAIInput && (
            <div className="shrink-0 mb-2">
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 dark:bg-[#1A1A2E]/60 p-3 animate-fadeIn">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-violet-400 flex items-center gap-1.5">
                    <Sparkles size={11} /> AI — basado en contenido activo
                  </span>
                  <button onClick={() => setShowAIInput(false)} className="text-zinc-400 hover:text-zinc-300 p-0.5">
                    <X size={13} />
                  </button>
                </div>
                <NoteAIPanel
                  noteId={displayNoteId}
                  userId={session.user.id}
                  noteStatus={note.ai_summary_status ?? 'idle'}
                  onPromoteToNote={onCreateNote ? handlePromoteToNote : undefined}
                />
              </div>
            </div>
          )}

          {/* ── CONTENIDO ACTIVO ─────────────────────────────────────────────────── */}
          {(() => {
            const activeSubnoteId = activeTab.startsWith('sub_') ? activeTab.replace('sub_', '') : null;
            const activeSubnote = activeSubnoteId ? manualChildren.find(c => c.id === activeSubnoteId) : null;
            const activeSummary = !activeSubnoteId && activeTab !== 'original'
              ? completedSummaries.find(s => s.id === activeTab)
              : null;

            if (activeSummary) {
              return (
                <div className="flex-1 flex flex-col min-h-0 animate-fadeIn">
                  <SummaryTabContent
                    key={activeTab}
                    summary={activeSummary}
                    noteFont={noteFont}
                    noteFontSize={noteFontSize}
                    noteLineHeight={noteLineHeight}
                    showLineNumbers={showLineNumbers}
                    onDelete={handleDeleteSummary}
                    onPromote={onCreateNote ? handlePromoteToNote : undefined}
                    updateScratchpad={updateScratchpad}
                    updateContent={updateSummaryContent}
                    searchQuery={searchQuery}
                    showScratch={showNoteScratch}
                    setShowScratch={setShowNoteScratch}
                  />
                </div>
              );
            }

            // Current target note context
            const currentNote: Note = activeSubnote ? activeSubnote : {
              ...note,
              id: displayNoteId,
              content: displayContent,
              scratchpad: localNoteScratch
            };

            return (
              <SubnoteTabContent
                key={activeTab === 'original' ? displayNoteId : activeTab}
                note={currentNote}
                showScratch={showNoteScratch}
                onUpdate={onUpdate}
                splitRatio={splitRatio}
                onDividerMouseDown={handleDividerMouseDown}
                splitContainerRef={splitContainerRef}
                noteFont={noteFont}
                noteFontSize={noteFontSize}
                noteLineHeight={noteLineHeight}
                showLineNumbers={showLineNumbers}
                searchQuery={searchQuery}
                onUpdateContent={(text) => {
                  if (activeSubnote) {
                    onUpdate(activeSubnote.id, { content: text });
                  } else {
                    handleUpdateContent(text);
                  }
                }}
                onUpdateScratch={(text) => {
                  if (activeSubnote) {
                    onUpdate(activeSubnote.id, { scratchpad: text });
                  } else {
                    handleNoteScratchChange(text);
                  }
                }}
                editorRef={editorRef}
                scratchRef={noteScratchRef}
                checklistRef={checklistRef}
              />
            );
          })()}
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex items-center pl-3 pr-4 py-3 bg-zinc-50 dark:bg-[#2D2D42]/50 rounded-b-2xl border-t border-zinc-200 dark:border-[#2D2D42] mt-auto">
        <div className="flex flex-wrap items-center gap-4 text-[10px] uppercase tracking-widest font-bold text-zinc-400">
          {note.created_at && (
            <span className="flex items-center gap-1.5"><Clock size={10} /> {new Date(note.created_at).toLocaleDateString()}</span>
          )}
          {note.updated_at && note.created_at && (new Date(note.updated_at).getTime() - new Date(note.created_at).getTime() > 60000) && (
            <span className="flex items-center gap-1.5"><History size={10} /> Editado {new Date(note.updated_at).toLocaleDateString()}</span>
          )}
          {propSyncStatus === 'saving' && (<span className="flex items-center gap-1 text-amber-500 animate-pulse ml-1"><Loader2 size={10} className="animate-spin" /> Guardando...</span>)}
          {propSyncStatus === 'saved' && (<span className="flex items-center gap-1 text-emerald-500 ml-1"><CloudCheck size={10} /> Sincronizado</span>)}
        </div>
      </div>

      {isMoveModalOpen && onMove && (
        <MoveToGroupModal
          note={note}
          groups={groups}
          onClose={() => setIsMoveModalOpen(false)}
          onMove={onMove}
        />
      )}
    </div>
  );
};