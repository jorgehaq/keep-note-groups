import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, Trash2, Check, Pin, PanelLeft, Loader2, CloudCheck, X, MoreVertical, Clock, ListTodo, CheckSquare, Square, GripVertical, Download, Clipboard, CopyPlus, FolderInput, Hash, Sparkles, FileText, PenLine, ArrowUpRight } from 'lucide-react';
import { Note, NoteFont } from '../types';
import { SmartNotesEditor, SmartNotesEditorRef } from '../src/components/editor/SmartNotesEditor';
import { ChecklistEditor, parseMarkdownToChecklist, serializeChecklistToMarkdown } from '../src/components/editor/ChecklistEditor';
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
  onDelete: (id: string) => void;
  onPromote?: (content: string, title: string) => void;
  updateScratchpad: (id: string, text: string) => void;
  updateContent: (id: string, text: string) => void;
}> = ({ summary, noteFont, noteFontSize, noteLineHeight, showLineNumbers, searchQuery, onDelete, onPromote, updateScratchpad, updateContent }) => {
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
        <div className="px-4 py-3 min-w-0">
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

      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-1.5 mb-1.5 px-1">
          <PenLine size={11} className="text-zinc-500" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Pizarrón</span>
        </div>
        <div onClick={() => scratchRef.current?.focus()}
          className={`note-editor-scroll bg-zinc-50 dark:bg-[#242432] rounded-xl p-4 cursor-text flex-1 overflow-y-scroll min-h-[120px] border ${searchQuery?.trim() && localScratch?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ? 'border-amber-500' : 'border-zinc-200 dark:border-[#2D2D42]'}`}>
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

export const AccordionItem: React.FC<AccordionItemProps> = ({
  note,
  onToggle,
  onUpdate,
  onDelete,
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
}) => {

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(!note.title);
  const [tempTitle, setTempTitle] = useState(note.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<SmartNotesEditorRef>(null);
  const fontClass = noteFont === 'serif' ? 'font-serif' : noteFont === 'mono' ? 'font-mono text-xs' : 'font-sans';

  const { aiPanelOpenByNote, activeTabByNote, setAiPanelOpen, setActiveTab: setStoreActiveTab } = useUIStore();
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

  // Fallback to 'original' if the active tab summary is missing (ONLY after initial fetch completes)
  useEffect(() => {
    if (summariesLoading || !hasFetched) return;
    if (activeTab !== 'original' && !completedSummaries.find(s => s.id === activeTab)) {
      console.log(`Fallback to original for ${displayNoteId} (summary ${activeTab} not found)`);
      setActiveTab('original');
    }
  }, [completedSummaries.length, summariesLoading, hasFetched, activeTab, displayNoteId]);

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

  const [isInKanban, setIsInKanban] = useState(false);
  useEffect(() => {
    const checkKanban = async () => {
      const { data } = await supabase.from('tasks').select('id').eq('id', note.id).maybeSingle();
      setIsInKanban(!!data);
    };
    checkKanban();
    const handleUpdate = () => checkKanban();
    window.addEventListener('kanban-updated', handleUpdate);
    return () => window.removeEventListener('kanban-updated', handleUpdate);
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

  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleUpdateContent = (newMarkdown: string) => {
    if (newMarkdown === note.content) return;
    setSyncStatus('saving');
    onUpdate(displayNoteId, { content: newMarkdown });
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }, 5000);
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
    <div className={`m-1 transition-all duration-300 flex-1 flex flex-col min-h-0 bg-white dark:bg-[#1A1A24] overflow-hidden rounded-2xl shadow-lg border ${
      isHighlightedBySearch
        ? 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-50/30 dark:bg-amber-900/10'
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

        <div className="flex items-center gap-2 shrink-0 border border-transparent">
          {/* Botón AI con badge */}
          {session?.user && (
            <AIBadge
              count={completedSummaries.length}
              hasPending={aiSummaries.some(s => s.status === 'pending' || s.status === 'processing')}
              active={showAIPanel}
              onClick={() => setShowAIPanel(v => !v)}
            />
          )}

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
            <div className="shrink-0 flex items-center">
              <KanbanSemaphore sourceId={note.id} sourceTitle={note.title || 'Sin título'} onInteract={() => {}} />
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
                  let newContent = note.content;
                  if (willBeChecklist) {
                    newContent = serializeChecklistToMarkdown(parseMarkdownToChecklist(note.content));
                  }
                  onUpdate(note.id, { is_checklist: willBeChecklist, content: newContent });
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
                
                {/* GRUPO 4: Peligro */}
                <button onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(false); if (confirm('¿Estás seguro de eliminar esta nota?')) onDelete(note.id); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={14} />Eliminar Nota</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div
        ref={contentRef}
        className="flex-1 flex flex-col overflow-hidden min-h-0 bg-transparent relative"
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
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 dark:bg-[#1A1A2E]/60 p-4 animate-fadeIn">
              <NoteAIPanel
                noteId={displayNoteId}
                userId={session.user.id}
                noteStatus={note.ai_summary_status ?? 'idle'}
                onPromoteToNote={onCreateNote ? handlePromoteToNote : undefined}
              />
            </div>
          )}

          {/* TABS — chips unificados: pendientes + completados */}
          {showAIPanel && (aiSummaries.length > 0) && (() => {
            const q = searchQuery?.trim().toLowerCase() || '';
            const originalMatches = q && (note.content?.toLowerCase().includes(q) || note.title?.toLowerCase().includes(q));
            return (
            <div className="flex items-center gap-2.5 overflow-x-auto flex-wrap p-[2px]">
              {/* Tab Original — solo si hay completados */}
              {completedSummaries.length > 0 && (
                <button
                  onClick={() => setActiveTab('original')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border shrink-0 ${
                    activeTab === 'original'
                      ? `bg-[#4940D9] text-white border-[#4940D9] shadow-sm shadow-[#4940D9]/20 ${originalMatches ? 'ring-2 ring-amber-400' : ''}`
                      : originalMatches
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-500 ring-1 ring-amber-500/50'
                        : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                  }`}
                >
                  <FileText size={11} /> Original
                </button>
              )}
              {/* Chips pendientes/processing — gestándose */}
              {aiSummaries.filter(s => s.status === 'pending' || s.status === 'processing').map(s => (
                <div key={s.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border shrink-0 max-w-[180px] bg-zinc-800/60 border-zinc-700 text-zinc-400 animate-pulse"
                >
                  <Loader2 size={10} className="animate-spin shrink-0" />
                  <span className="truncate">{s.target_objective || 'Analizando...'}</span>
                </div>
              ))}
              {/* Chips completados */}
              {completedSummaries.map(s => {
                const summaryMatches = q && ((s.content?.toLowerCase().includes(q)) || (s.scratchpad?.toLowerCase().includes(q)) || (s.target_objective?.toLowerCase().includes(q)));
                return (
                <button key={s.id}
                  onClick={() => setActiveTab(activeTab === s.id ? 'original' : s.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border shrink-0 max-w-[180px] ${
                    activeTab === s.id
                      ? `bg-violet-600 text-white border-violet-500 shadow-sm shadow-violet-500/20 ${summaryMatches ? 'ring-2 ring-amber-400' : ''}`
                      : summaryMatches
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-500 ring-1 ring-amber-500/50'
                        : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-violet-500/40 hover:text-violet-400'
                  }`}
                >
                  <Sparkles size={10} className="shrink-0" />
                  <span className="truncate">{s.target_objective || 'Análisis'}</span>
                </button>
                );
              })}
            </div>
            );
          })()}

          {/* CONTENIDO ACTIVO */}
          {(!showAIPanel || activeTab === 'original') ? (
            note.is_checklist ? (
              <div className="bg-zinc-50 dark:bg-[#242432] border border-zinc-200 dark:border-[#2D2D42] rounded-xl p-4">
                <ChecklistEditor idPrefix={displayNoteId} initialContent={displayContent} onUpdate={handleUpdateContent} />
              </div>
            ) : (
              <div onClick={() => editorRef.current?.focus()}
                className={`note-editor-scroll bg-zinc-50 dark:bg-[#242432] rounded-xl p-4 cursor-text flex-1 overflow-y-scroll min-h-0 border ${searchQuery?.trim() && note.content?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ? 'border-amber-500' : 'border-zinc-200 dark:border-[#2D2D42]'}`}>
                <SmartNotesEditor
                  ref={editorRef}
                  noteId={displayNoteId}
                  initialContent={displayContent}
                  searchQuery={searchQuery}
                  onChange={handleUpdateContent}
                  noteFont={noteFont}
                  noteFontSize={noteFontSize}
                  noteLineHeight={noteLineHeight}
                  showLineNumbers={showLineNumbers}
                />
              </div>
            )
          ) : completedSummaries.find(s => s.id === activeTab) ? (
            <div className="flex-1 flex flex-col min-h-0 animate-fadeIn">
              <SummaryTabContent
                key={activeTab}
                summary={completedSummaries.find(s => s.id === activeTab)!}
                noteFont={noteFont}
                noteFontSize={noteFontSize}
                noteLineHeight={noteLineHeight}
                showLineNumbers={showLineNumbers}
                onDelete={handleDeleteSummary}
                onPromote={onCreateNote ? handlePromoteToNote : undefined}
                updateScratchpad={updateScratchpad}
                updateContent={updateSummaryContent}
                searchQuery={searchQuery}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex items-center pl-3 pr-4 py-3 bg-zinc-50 dark:bg-[#2D2D42]/50 rounded-b-2xl border-t border-zinc-200 dark:border-[#2D2D42] mt-auto">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-zinc-400 pl-2">
          {note.created_at && (<span>Creado: {formatCleanDate(note.created_at)}</span>)}
          {note.updated_at && note.created_at && (new Date(note.updated_at).getTime() - new Date(note.created_at).getTime() > 60000) && (
            <><span className="opacity-50">|</span><span>Editado: {formatCleanDate(note.updated_at)}</span></>
          )}
          {syncStatus === 'saving' && (<span className="flex items-center gap-1 text-amber-500 animate-pulse ml-1"><Loader2 size={10} className="animate-spin" /> Guardando...</span>)}
          {syncStatus === 'saved' && (<span className="flex items-center gap-1 text-emerald-500 ml-1"><CloudCheck size={10} /> Sincronizado</span>)}
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