import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Archive, ChevronUp, ChevronLeft, ChevronRight, Trash2, Check, Pin, Maximize2, Minimize2, PanelLeft, Loader2, CloudCheck, X, MoreVertical, Clock, ListTodo, CheckSquare, Square, GripVertical, Download, Clipboard, CopyPlus, FolderInput, Hash, Sparkles, FileText, PenLine, ArrowUpRight, GitBranch, Plus, Wind, ListPlus, History, Calendar, Columns, Rows } from 'lucide-react';
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
  onCreateNote?: (content: string, title: string, groupId?: string, orderIndex?: number) => Promise<string | null>;
  groups?: Group[];
  searchQuery?: string;
  noteFont?: NoteFont;
  noteFontSize?: string;
  noteLineHeight?: string;
  isHighlightedBySearch?: boolean;
  showLineNumbers?: boolean;
  onToggleLineNumbers?: () => void;
  session?: Session | null;
  allSaveStatuses?: Record<string, 'saving' | 'saved' | 'idle'>;
  groupNotes?: Note[];
  allSummaries?: any[];
  triggerGlobalScrollToActive?: () => void;
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
    return (
        <span className="text-[9px] sm:text-[10px] text-center sm:text-left block sm:inline font-medium whitespace-nowrap">
            {day}/{month}/{year}, {hours.toString().padStart(2, '0')}:{minutes} {ampm}
        </span>
    );
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
  triggerScrollToActive: () => void;
  splitRatio: number;
  onDividerMouseDown: (e: React.MouseEvent) => void;
}> = ({ summary, noteFont, noteFontSize, noteLineHeight, showLineNumbers, searchQuery, onDelete, onPromote, updateScratchpad, updateContent, showScratch, setShowScratch, triggerScrollToActive, splitRatio, onDividerMouseDown }) => {
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

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const forcedOrientation = useUIStore(s => s.forcedPizarronOrientation);
  const layoutCol = forcedOrientation 
    ? forcedOrientation === 'horizontal' 
    : isMobile;

  return (
    <div 
        onFocusCapture={triggerScrollToActive}
        onClickCapture={triggerScrollToActive}
        className={`flex-1 flex min-h-0 ${layoutCol ? 'flex-col' : 'flex-row'} gap-3`}
    >
      <div className={`flex-1 flex flex-col min-h-0 bg-violet-50 dark:bg-[#131314] rounded-2xl border ${searchQuery?.trim() && (summary.content?.toLowerCase().includes(searchQuery.trim().toLowerCase()) || summary.target_objective?.toLowerCase().includes(searchQuery.trim().toLowerCase())) ? 'border-amber-500' : 'border-violet-300 dark:border-violet-500/30'} overflow-hidden`}>
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
                       className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-zinc-700 dark:text-zinc-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors font-bold"
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
        <div className={`flex-1 flex flex-col min-h-0 bg-violet-50 dark:bg-[#131314] rounded-2xl border ${searchQuery?.trim() && (summary.content?.toLowerCase().includes(searchQuery.trim().toLowerCase()) || summary.target_objective?.toLowerCase().includes(searchQuery.trim().toLowerCase())) ? 'border-amber-500' : 'border-violet-200 dark:border-violet-500/20'} overflow-hidden`}
          style={showScratch
            ? (layoutCol
                ? { height: `${splitRatio * 100}%`, flex: 'none' }
                : { width: `${splitRatio * 100}%`, flex: 'none' })
            : { flex: '1' }
          }
        >
          <div 
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('.cm-panel, .cm-search, .cm-search-marker-container')) return;
              // No ref for summary editor in this component, but it has focusable areas
            }}
            className="flex-1 px-8 py-6 overflow-y-auto cursor-text note-editor-scroll"
          >
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
      </div>

      {showScratch && (
        <div
          onMouseDown={onDividerMouseDown}
          className={`shrink-0 flex items-center justify-center rounded-full select-none hover:bg-violet-400/20 transition-colors ${
            layoutCol ? 'h-2 w-full cursor-row-resize' : 'w-2 h-full cursor-col-resize'
          }`}
          title="Arrastrar para redimensionar"
        >
          <div className={`rounded-full bg-violet-400/30 ${layoutCol ? 'h-1 w-8' : 'w-1 h-8'}`} />
        </div>
      )}

      <div 
        className={`flex flex-col flex-1 min-h-0 rounded-xl border border-[#291B46] focus-within:border-[#4E3884] bg-white dark:bg-[#1A1A24] animate-fadeIn overflow-hidden transition-colors ${!showScratch ? 'hidden md:flex' : 'flex'}`}
        style={showScratch && !layoutCol ? { width: `${(1 - splitRatio) * 100}%`, flex: 'none' } : { flex: 1 }}
      >
        <div className="relative flex items-center justify-center gap-2 px-3 py-2 border-b border-violet-200/20 shrink-0">
          <div className="flex items-center gap-2">
            <PenLine size={11} className="text-violet-400" />
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Pizarrón</span>
          </div>
          <div className="absolute right-2 flex items-center">
            <button
              onClick={() => {
                const cur = useUIStore.getState().forcedPizarronOrientation;
                const next = cur === 'vertical' ? 'horizontal' : 'vertical';
                useUIStore.getState().setForcedPizarronOrientation(next);
              }}
              title={useUIStore.getState().forcedPizarronOrientation === 'horizontal' ? "Cambiar a disposición Vertical (Columnas)" : "Cambiar a disposición Horizontal (Filas)"}
              className="p-1 hover:bg-violet-400/10 rounded-lg text-violet-400 transition-colors"
            >
              {useUIStore.getState().forcedPizarronOrientation === 'horizontal' ? <Columns size={12} /> : <Rows size={12} />}
            </button>
          </div>
        </div>
        <div onClick={(e) => {
          if ((e.target as HTMLElement).closest('.cm-panel, .cm-search, .cm-search-marker-container')) return;
          scratchRef.current?.focus();
        }}
          className="note-editor-scroll flex-1 px-8 py-6 overflow-y-scroll min-h-[120px]">
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

const SummaryTitle: React.FC<{
  summary: any;
  isActive: boolean;
  searchQuery?: string;
  onRename: (id: string, newObjective: string) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
}> = ({ summary, isActive, searchQuery, onRename, isEditing, setIsEditing }) => {
  const [val, setVal] = useState(summary.target_objective || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(summary.target_objective || ''); }, [summary.target_objective]);

  const save = () => {
    setIsEditing(false);
    const trimmed = val.trim();
    if (trimmed && trimmed !== summary.target_objective) onRename(summary.id, trimmed);
    else setVal(summary.target_objective || '');
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(0, 0);
      inputRef.current.scrollLeft = 0;
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={val}
        autoFocus
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') { setIsEditing(false); setVal(summary.target_objective || ''); }
          e.stopPropagation();
        }}
        onClick={e => e.stopPropagation()}
        className="bg-black text-white border-violet-500 border rounded px-1.5 py-0.5 outline-none text-[14px] max-w-[280px] shadow-inner text-left"
        placeholder="Título..."
      />
    );
  }

  return (
    <span
      className="truncate max-w-[200px] cursor-pointer text-[13px]"
      onDoubleClick={e => { e.stopPropagation(); if (isActive) setIsEditing(true); }}
      title={isActive ? 'Doble clic para renombrar' : summary.target_objective || ''}
    >
      {searchQuery?.trim() 
        ? highlightText(summary.target_objective || 'Análisis AI', searchQuery) 
        : (summary.target_objective || 'Análisis AI').length > 23 
          ? (summary.target_objective || 'Análisis AI').slice(0, 23) + '...' 
          : (summary.target_objective || 'Análisis AI')}
    </span>
  );
};

const SubnoteTitle: React.FC<{
  child: Note;
  isActive: boolean;
  onRename: (id: string, title: string) => void;
  searchQuery?: string;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
}> = ({ child, isActive, onRename, searchQuery, isEditing, setIsEditing }) => {
  const isJustCreated = !child.title && (Date.now() - new Date(child.created_at || 0).getTime() < 3000);
  const [val, setVal] = useState(child.title || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(child.title || ''); }, [child.title]);

  useEffect(() => {
    if (isJustCreated) setIsEditing(true);
  }, [isJustCreated, setIsEditing]);

  const save = () => {
    setIsEditing(false);
    const trimmed = val.trim();
    if (trimmed !== (child.title || '')) {
      onRename(child.id, trimmed);
    } else {
      setVal(child.title || '');
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(0, 0);
      inputRef.current.scrollLeft = 0;
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={val}
        autoFocus
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') { setIsEditing(false); setVal(child.title || ''); }
          e.stopPropagation();
        }}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        className="bg-black text-white border-emerald-500 border rounded px-1.5 py-0.5 outline-none text-[14px] max-w-[280px] shadow-inner text-left"
        placeholder="Título..."
      />
    );
  }

  return (
    <span
      className="truncate max-w-[200px] cursor-pointer text-[13px]"
      onDoubleClick={e => { e.stopPropagation(); if (isActive) setIsEditing(true); }}
      title={isActive ? 'Doble clic para renombrar' : child.title || ''}
    >
      {searchQuery?.trim() 
        ? highlightText(child.title || 'Sin título', searchQuery) 
        : (child.title || 'Sin título').length > 23 
          ? (child.title || 'Sin título').slice(0, 23) + '...' 
          : (child.title || 'Sin título')}
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
  triggerScrollToActive: () => void;
  syncStatus: 'saving' | 'saved' | 'idle';
  activeTab: string;
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
  checklistRef,
  triggerScrollToActive,
  syncStatus,
  activeTab
}) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const borderColor = note.parent_note_id 
    ? 'border-[#291B46] focus-within:border-[#17634F]' 
    : 'border-[#291B46] focus-within:border-[#40418E]';

  const forcedOrientation = useUIStore(s => s.forcedPizarronOrientation);
  const layoutCol = forcedOrientation
    ? forcedOrientation === 'horizontal'
    : isMobile;

  return (
    <div
      ref={splitContainerRef}
      onFocusCapture={triggerScrollToActive}
      onClickCapture={triggerScrollToActive}
      className={`flex-1 flex min-h-0 ${layoutCol ? 'flex-col' : 'flex-row'} gap-2 pt-2`}
    >
      <div
        className={`min-h-0 overflow-hidden flex flex-col rounded-xl border ${borderColor} bg-zinc-50 dark:bg-[#131314]`}
        style={showScratch
          ? (layoutCol
              ? { height: `${splitRatio * 100}%`, flex: 'none' }
              : { width: `${splitRatio * 100}%`, flex: 'none' })
          : { flex: '1' }
        }
      >
        {/* Editor Metadata Header */}
        <div className="flex items-center justify-center gap-6 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#1A1A24] shrink-0">
          <div className="flex items-center gap-1.5 opacity-60">
            <Clock size={11} className="text-zinc-500" />
            <span className="text-[9px] font-bold uppercase tracking-tighter text-zinc-500">Creación:</span>
            {formatCleanDate(note.created_at)}
          </div>
          <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-800" />
          <div className="flex items-center gap-1.5 opacity-60">
            <History size={11} className="text-zinc-500" />
            <span className="text-[9px] font-bold uppercase tracking-tighter text-zinc-500">Edición:</span>
            {formatCleanDate(note.updated_at)}
          </div>
        </div>

        {note.is_checklist ? (
          <div className="px-8 py-6 h-full overflow-y-auto note-editor-scroll">
            <ChecklistEditor ref={checklistRef} idPrefix={note.id} initialContent={note.content || ''} onUpdate={onUpdateContent} />
          </div>
        ) : (
          <div
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('.cm-panel, .cm-search')) return;
              editorRef.current?.focus();
            }}
            className="px-8 py-6 h-full overflow-y-auto cursor-text note-editor-scroll"
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
          className={`shrink-0 flex items-center justify-center rounded-full select-none hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors ${
            layoutCol ? 'h-2 w-full cursor-row-resize' : 'w-2 h-full cursor-col-resize'
          }`}
          title="Arrastrar para redimensionar"
        >
          <div className={`rounded-full bg-zinc-300 dark:bg-zinc-600 ${layoutCol ? 'h-1 w-8' : 'w-1 h-8'}`} />
        </div>
      )}

      {showScratch && (
        <div
          className="min-h-0 overflow-hidden flex flex-col rounded-xl border border-[#291B46] focus-within:border-[#4E3884] bg-white dark:bg-[#1A1A24] animate-fadeIn transition-colors"
          style={{ flex: 1 }}
        >
          <div className="relative flex items-center justify-center gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#1A1A24] shrink-0">
            <div className="flex items-center gap-2">
              <PenLine size={11} className="text-violet-400" />
              <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Pizarrón</span>
            </div>
            <div className="absolute right-2 flex items-center">
              <button
                onClick={() => {
                  const curr = useUIStore.getState().forcedPizarronOrientation;
                  const next = curr === 'vertical' ? 'horizontal' : 'vertical';
                  useUIStore.getState().setForcedPizarronOrientation(next);
                }}
                title={useUIStore.getState().forcedPizarronOrientation === 'horizontal' ? "Cambiar a disposición Vertical (Columnas)" : "Cambiar a disposición Horizontal (Filas)"}
                className="p-1 hover:bg-violet-400/10 rounded-lg text-violet-400 transition-colors"
              >
                {useUIStore.getState().forcedPizarronOrientation === 'horizontal' ? <Columns size={12} /> : <Rows size={12} />}
              </button>
            </div>
          </div>
          <div
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('.cm-panel, .cm-search')) return;
              scratchRef.current?.focus();
            }}
            className="flex-1 px-8 py-6 overflow-y-auto cursor-text note-editor-scroll"
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
  allSaveStatuses = {},
  allSummaries = [],
  groupNotes = [],
  triggerGlobalScrollToActive
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
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState(note.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<SmartNotesEditorRef>(null);
  const checklistRef = useRef<ChecklistEditorRef>(null);
  const fontClass = noteFont === 'serif' ? 'font-serif' : noteFont === 'mono' ? 'font-mono text-xs' : 'font-sans';

 
   const { 
      aiPanelOpenByNote, setAiPanelOpen, activeTabByNote, setActiveTab: setStoreActiveTab,
      isNotesPizarronOpen, setIsNotesPizarronOpen,
      notesSplitRatio, setNotesSplitRatio,
      isArchiveOpenByApp, setArchiveOpenByApp,
      isMaximized, setIsMaximized,
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
    const { summaries: aiSummaries, deleteSummary, updateScratchpad, updateSummaryContent, updateSummaryMetadata, loading: summariesLoading, hasFetched } = useSummaries(displayNoteId);
    const completedSummaries = aiSummaries.filter(s => s.status === 'completed');
  
    const manualChildren = groupNotes.filter(n => n.parent_note_id === displayNoteId && !n.ai_generated);

    const unifiedTabs = useMemo(() => {
      const items = [
        ...manualChildren.map(c => ({ id: `sub_${c.id}`, type: 'sub' as const, order_index: c.order_index || 0, data: c })),
        ...aiSummaries.map(s => ({ id: s.id, type: 'summary' as const, order_index: s.order_index || 0, data: s }))
      ];
      return items.sort((a, b) => a.order_index - b.order_index);
    }, [manualChildren, aiSummaries]);

    // DETERMINAR ORDEN RELATIVO (Interpolación REAL estilo Notion/Linear)
    const getNewOrderIndex = () => {
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
    };

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
  const videoSaveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [scrollToActiveCount, setScrollToActiveCount] = useState(0);
  const triggerScrollToActive = () => {
    setScrollToActiveCount(prev => prev + 1);
    if (triggerGlobalScrollToActive) triggerGlobalScrollToActive();
  };

  const tabBarRef = useRef<HTMLDivElement>(null);

  // useEffect que scrollea al tab activo tras cada cambio
  useEffect(() => {
    if (!tabBarRef.current || !activeTab) return;
    const timer = setTimeout(() => {
        const activeBtn = tabBarRef.current?.querySelector('[data-active-tab="true"]');
        if (activeBtn) {
            activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, 100);
    return () => clearTimeout(timer);
  }, [activeTab, scrollToActiveCount]);

  // ── AI INPUT COLAPSABLE ────────────────────────────────────────────────────
  const [showAIInput, setShowAIInput] = useState(false);
  
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasSearchMatchLeft, setHasSearchMatchLeft] = useState(false);
  const [hasSearchMatchRight, setHasSearchMatchRight] = useState(false);

  const checkScroll = useCallback(() => {
    if (tabBarRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabBarRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);

      // --- Lógica de Iluminación de Flechas por Búsqueda ---
      const query = searchQuery?.trim();
      if (!query) {
        setHasSearchMatchLeft(false);
        setHasSearchMatchRight(false);
        return;
      }

      let matchLeft = false;
      let matchRight = false;
      const tabs = tabBarRef.current.querySelectorAll('button[data-is-match="true"]');
      
      tabs.forEach(tab => {
        const t = tab as HTMLElement;
        const tabStart = t.offsetLeft;
        const tabEnd = tabStart + t.offsetWidth;
        
        // Ajuste de sensibilidad para detectar tabs ocultos tras el gradiente/flecha
        if (tabStart < scrollLeft + 35) matchLeft = true;
        if (tabEnd > scrollLeft + clientWidth - 35) matchRight = true;
      });

      setHasSearchMatchLeft(matchLeft);
      setHasSearchMatchRight(matchRight);
    }
  }, [searchQuery]);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabBarRef.current) {
      tabBarRef.current.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const container = tabBarRef.current;
    if (container) {
      checkScroll();

      // Recalculate after render
      const timer = setTimeout(checkScroll, 300);

      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      
      const ro = new ResizeObserver(checkScroll);
      ro.observe(container);

      return () => {
        clearTimeout(timer);
        container.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
        ro.disconnect();
      };
    }
  }, [checkScroll, unifiedTabs]);

  // Recalcular scroll cuando cambien las pestañas
  useEffect(() => {
    checkScroll();
  }, [unifiedTabs, checkScroll]);

    // ── SPLIT RATIO (pizarron) ─────────────────────────────────────────────────
    // Usamos el ratio global del store para sincronizar todas las notas
    const splitRatio = notesSplitRatio;
    const setSplitRatio = (val: number) => setNotesSplitRatio(val);
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

  // Debounce ref para guardado del título durante la escritura
  const titleSaveDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sincronizar tempTitle cuando la nota cambia (solo cuando el input no está enfocado)
  useEffect(() => {
    if (document.activeElement !== titleInputRef.current) {
      setTempTitle(note.title ?? '');
    }
  }, [note.id]);

  // Sync from external title updates (e.g. Kanban), only when not editing
  useEffect(() => {
    const isActuallyFocused = document.activeElement === titleInputRef.current;
    if (!isActuallyFocused && !isEditingTitle && note.title !== undefined && note.title !== tempTitle) {
      setTempTitle(note.title ?? '');
    }
  }, [note.title]);

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
      const forcedOrientation = useUIStore.getState().forcedPizarronOrientation;
      const layoutCol = forcedOrientation ? forcedOrientation === 'horizontal' : isMobile;

      if (layoutCol) {
        // En stacked (horizontal split line): drag vertical
        const ratio = (ev.clientY - rect.top) / rect.height;
        setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
      } else {
        // En side-by-side (vertical split line): drag horizontal
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
    if (!onCreateNote) return;
    const orderIndex = getNewOrderIndex();
    console.log('🔢 orderIndex calculado:', orderIndex, '| activeTab:', activeTab);
    console.log('📊 unifiedTabs actual:', unifiedTabs.map(t => ({ id: t.id, oi: t.order_index })));
    const newId = await onCreateNote('', '', displayNoteId, orderIndex);
    if (newId) setActiveTab(`sub_${newId}`);
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
    // Cancel any pending debounced save, we're saving now
    if (titleSaveDebounceRef.current) clearTimeout(titleSaveDebounceRef.current);
    setIsEditingTitle(false);
    onUpdate(note.id, { title: tempTitle.trim() });
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTempTitle(val);
    // Debounced pre-save while typing (800ms) — keeps DB in sync without blocking input
    if (titleSaveDebounceRef.current) clearTimeout(titleSaveDebounceRef.current);
    titleSaveDebounceRef.current = setTimeout(() => {
      onUpdate(note.id, { title: val.trim() });
    }, 800);
  };

  const handlePromoteToNote = async (content: string, title: string) => {
    if (!onCreateNote) return;
    const newId = await onCreateNote(content, title, note.group_id, getNewOrderIndex());
    if (newId) setActiveTab(`sub_${newId}`);
  };

  return (
    <div className={`m-1 transition-all duration-300 flex-1 flex flex-col min-h-0 bg-white dark:bg-[#1A1A24] rounded-2xl shadow-lg border select-text ${
      isHighlightedBySearch
        ? 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-50/30 dark:bg-amber-900/10 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
        : 'border-zinc-200 dark:border-[#2D2D42] hover:border-[#3D3E89]/60 focus-within:border-[#3D3E89] dark:focus-within:border-[#3D3E89]'
    }`}>

      {/* HEADER: TITLE + BUTTONS + ACCESSES */}
      <div
        ref={headerRef}
        className="flex flex-col px-4 pt-4 pb-2 transition-colors gap-3 min-w-0"
      >
        {/* ROW 1: TITLE */}
        <div className="flex items-center justify-between gap-2 min-w-0">
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
                  onChange={handleTitleChange}
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
          {isInKanban && (
            <div className="flex-shrink-0 animate-fadeIn pr-1">
              <KanbanSemaphore sourceType="note" sourceId={note.id} sourceTitle={note.title || 'Sin título'} onInteract={() => {}} />
            </div>
          )}
        </div>
        {/* ROW 2: ACTION BUTTONS */}
        <div className="flex items-center justify-between gap-1.5 flex-wrap pl-1">
          {/* GRUPO IZQUIERDO: Utilidades principales */}
          <div className="flex items-center gap-1.5">
            {/* Permanent Sync Symbol */}
            {(() => {
              const currentSyncStatus = allSaveStatuses[displayNoteId] || 'idle';
              return (
                <div className="mr-0.5 flex items-center justify-center w-6 h-6" title={currentSyncStatus === 'saving' ? 'Sincronizando...' : 'Sincronizado'}>
                  {currentSyncStatus === 'saving' ? (
                    <Loader2 size={13} className="animate-spin text-indigo-500" />
                  ) : (
                    <CloudCheck size={13} className={currentSyncStatus === 'saved' ? "text-emerald-500" : "text-zinc-300 dark:text-zinc-600"} />
                  )}
                </div>
              );
            })()}

            {session?.user && (
              <button
                onClick={(e) => { e.stopPropagation(); handleCreateSubnote(); }}
                title="Nueva subnota"
                className="flex items-center justify-center px-3 h-[32.5px] rounded-lg text-[13px] font-medium border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 transition-all"
              >
                <ListPlus size={13} className="mr-1.5" />
                <span>+</span>
              </button>
            )}

            {/* Botón AI */}
            {session?.user && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowAIInput(v => !v); }}
                title={showAIInput ? 'Ocultar panel AI' : 'Abrir panel AI'}
                className={`flex items-center px-3 h-[32.5px] rounded-lg text-[13px] font-medium border transition-all ${
                  showAIInput 
                    ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/40 shadow-sm' 
                    : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-violet-500/50 hover:text-violet-500'
                }`}
              >
                <Sparkles size={13} className={showAIInput ? '' : 'text-violet-400'} />
              </button>
            )}

            {/* Botón pizarrón en header */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowNoteScratch(v => !v); }}
              title={showNoteScratch ? 'Ocultar pizarrón' : 'Abrir pizarrón'}
              className={`flex items-center px-3 h-[32.5px] rounded-lg text-[13px] font-medium border transition-all ${
                showNoteScratch
                  ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/40 shadow-sm' 
                  : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-violet-500/50 hover:text-violet-500'
              }`}
            >
              <PenLine size={13} className={showNoteScratch ? '' : 'text-violet-400'} />
            </button>

            {showLineNumbers && onToggleLineNumbers && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleLineNumbers(); }}
                className="flex items-center px-3 h-[32.5px] rounded-lg text-[13px] font-medium border border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 transition-all shadow-sm"
                title="Ocultar números de línea"
              >
                <Hash size={13} />
              </button>
            )}

            {note.is_docked && (
              <button
                onClick={(e) => { e.stopPropagation(); onUpdate(note.id, { is_docked: false }); }}
                className="flex items-center px-3 h-[32.5px] rounded-lg border border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 transition-all shadow-sm"
                title="Quitar del Sidebar"
              >
                <PanelLeft size={13} />
              </button>
            )}

            {note.is_pinned && (
              <button
                onClick={(e) => { e.stopPropagation(); onUpdate(note.id, { is_pinned: false }); }}
                className="flex items-center px-3 h-[32.5px] rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 transition-all shadow-sm"
                title="Desfijar Nota"
              >
                <Pin size={13} className="fill-current" />
              </button>
            )}

          </div>

          {/* GRUPO DERECHO: Zen, Maximize, More */}
          <div className="flex items-center gap-1.5">
            {/* Botón Zen */}
            <button
              onClick={(e) => { e.stopPropagation(); useUIStore.getState().toggleZenMode('notes'); }}
              className={`p-2 rounded-xl border transition-all ${
                useUIStore.getState().isZenModeByApp['notes']
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500 shadow-sm' 
                  : 'text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-[#4940D9]/30'
              }`}
              title={useUIStore.getState().isZenModeByApp['notes'] ? "Salir de Modo Zen" : "Entrar a Modo Zen"}
            >
              <Wind size={13} />
            </button>

            {/* Botón Maximizar/Minimizar */}
            <button
              onClick={(e) => { e.stopPropagation(); setIsMaximized(!isMaximized); }}
              className={`hidden md:flex p-2 rounded-xl border transition-all ${
                isMaximized
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500 shadow-sm' 
                  : 'text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-[#4940D9]/30'
              }`}
              title={isMaximized ? "Minimizar" : "Maximizar"}
            >
              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>

            {/* Tres puntos (More) */}
            <div className="relative shrink-0 flex items-center" ref={mobileMenuRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(!isMobileMenuOpen); }}
                className={`p-2 rounded-xl border transition-all ${
                  isMobileMenuOpen
                    ? 'bg-[#4940D9] border-[#4940D9]/80 text-white font-bold shadow-lg shadow-[#4940D9]/20' 
                    : 'text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-[#4940D9]/30'
                }`}
                title="Más opciones de la nota"
              >
                <MoreVertical size={13} />
              </button>
              {isMobileMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-[#1A1A24] shadow-xl rounded-lg border border-zinc-200 dark:border-[#2D2D42] p-1 flex flex-col gap-0.5 min-w-[180px] animate-fadeIn">
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
                  
                  <div className="border-t border-zinc-100 dark:border-zinc-700 my-0.5" />
                  
                  <button onClick={(e) => {
                    e.stopPropagation();
                    const willBeChecklist = !note.is_checklist;
                    let newContent = displayContent;
                    if (willBeChecklist) {
                      newContent = serializeChecklistToMarkdown(parseMarkdownToChecklist(displayContent));
                    } else {
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

                  <div className="border-t border-zinc-100 dark:border-zinc-700 my-0.5" />
                  
                  {onCopyNote && <button onClick={(e) => { e.stopPropagation(); onCopyNote(note); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><Clipboard size={14} />Copiar Nota</button>}
                  {onDuplicate && <button onClick={(e) => { e.stopPropagation(); onDuplicate(note.id); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><CopyPlus size={14} />Duplicar Nota</button>}
                  {onMove && <button onClick={(e) => { e.stopPropagation(); setIsMoveModalOpen(true); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42] transition-colors"><FolderInput size={14} />Mover de Grupo</button>}
                  {onExportNote && <button onClick={(e) => { e.stopPropagation(); onExportNote(note); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors font-bold"><Download size={14} />Exportar (.md)</button>}
                  
                  {onArchive && (
                    <button onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(false); onArchive(note.id); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 font-bold transition-colors">
                      <Archive size={14} /> Archivar Nota
                    </button>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(false); if (confirm('¿Estás seguro de eliminar esta nota?')) onDelete(note.id); }} 
                    className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-bold"
                  >
                    <Trash2 size={14} /> Eliminar Permanentemente
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 3: ACCESSES (Breadcrumb + Tabs) */}
        <div className="flex flex-col gap-2 w-full">
          <NoteBreadcrumb
            path={breadcrumbPath}
            activeNoteId={activeNoteId || note.id}
            onNavigate={navigate}
          />

          {(manualChildren.length > 0 || aiSummaries.length > 0 || childrenLoaded) && (
            <div className="relative group/tabbar shrink-0">
              {/* Flecha Izquierda */}
              <div className={`absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white dark:from-[#1A1A24] to-transparent z-10 flex items-center justify-start pointer-events-none transition-opacity duration-150 ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`}>
                <button 
                  onClick={() => scrollTabs('left')} 
                  className={`p-1 rounded-full bg-white dark:bg-zinc-800 shadow-md text-zinc-400 hover:text-emerald-500 transition-all active:scale-95 border ${hasSearchMatchLeft ? 'border-amber-500 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,192,45,0.4)] scale-110' : 'border-zinc-200 dark:border-zinc-700'} ml-1 ${canScrollLeft ? 'pointer-events-auto' : 'pointer-events-none'}`}
                >
                  <ChevronLeft size={14} />
                </button>
              </div>

              <div ref={tabBarRef} className={`flex items-center gap-1.5 overflow-x-auto pt-2 pb-1 shrink-0 min-w-0 hidden-scrollbar px-10 transition-all ${(!canScrollLeft && !canScrollRight) ? 'justify-center' : 'justify-start'}`}>

              {/* Tab Original */}
              {(() => {
                const isOriginalMatch = Boolean(searchQuery?.trim() && (
                  note.title?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                  note.content?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                  note.scratchpad?.toLowerCase().includes(searchQuery.trim().toLowerCase())
                ));
                return (
                  <button
                    onClick={() => setActiveTab('original')}
                    data-active-tab={activeTab === 'original' || undefined}
                    className={`relative flex items-center justify-center gap-1.5 px-4 h-[32.5px] rounded-lg text-[13px] font-medium whitespace-nowrap border shrink-0 transition-all ${
                      activeTab === 'original'
                        ? `bg-indigo-50/80 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-indigo-500/40 shadow-sm ${isOriginalMatch ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-[#1A1A24] shadow-[0_0_15px_rgba(251,192,45,0.4)]' : ''}`
                        : isOriginalMatch
                          ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-100 shadow-[0_0_8px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                          : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-indigo-500/50'
                    }`}
                  >
                    {globalTasks?.some(t => t.id === displayNoteId || t.linked_note_id === displayNoteId) && (
                      <div className="absolute -top-1.5 -right-1.5 z-10"><KanbanSemaphore sourceType="note" sourceId={displayNoteId} sourceTitle="Nota Original" /></div>
                    )}
                    <FileText size={12} className={activeTab === 'original' ? 'text-indigo-500 dark:text-indigo-300' : 'text-zinc-400'} />
                  </button>
                );
              })()}

               {/* Tabs UNIFICADAS (Subnotes + Summaries mezclados por fecha) */}
              {unifiedTabs.map((tab) => {
                if (tab.type === 'sub') {
                  const child = tab.data as Note;
                  const isActive = activeTab === `sub_${child.id}`;
                  const isMatch = searchQuery?.trim() && checkNoteMatch(child, searchQuery.trim(), groupNotes, allSummaries);

                    return (
                      <div key={child.id} className="relative shrink-0 flex items-center group">
                        <button
                          onClick={() => setActiveTab(`sub_${child.id}`)}
                          data-active-tab={isActive || undefined}
                          data-is-match={isMatch}
                          className={`flex items-center ${editingTabId === child.id ? 'gap-0' : 'gap-1.5'} px-3 h-[32.5px] rounded-lg text-[13px] font-medium whitespace-nowrap border transition-all max-w-[320px] ${
                            isActive
                              ? `bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 shadow-sm ${isMatch ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-[#1A1A24] shadow-[0_0_15px_rgba(251,192,45,0.4)]' : ''}`
                              : isMatch
                                ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-100 shadow-[0_0_8px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                                : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-emerald-500/50 hover:text-emerald-400'
                          }`}
                        >
                          {editingTabId !== child.id && <GitBranch size={10} className="shrink-0" />}
                          <SubnoteTitle
                            child={child}
                            isActive={isActive}
                            onRename={handleSaveChildTitle}
                            searchQuery={searchQuery}
                            isEditing={editingTabId === child.id}
                            setIsEditing={(val) => setEditingTabId(val ? child.id : null)}
                          />
                          {isActive && editingTabId !== child.id && (
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
                } else {
                  const s = tab.data as any;
                  const isProcessing = s.status === 'pending' || s.status === 'processing';
                  const isMatch = !isProcessing && searchQuery?.trim() && (
                    s.content?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                    s.target_objective?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                    s.scratchpad?.toLowerCase().includes(searchQuery.trim().toLowerCase())
                  );

                  if (isProcessing) {
                    return (
                      <div key={s.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border shrink-0 max-w-[150px] bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-400 animate-pulse"
                      >
                        <Loader2 size={10} className="animate-spin shrink-0" />
                        <span className="truncate">{s.target_objective || 'Analizando...'}</span>
                      </div>
                    );
                  }

                  return (
                    <button key={s.id}
                      onClick={() => setActiveTab(activeTab === s.id ? 'original' : s.id)}
                      data-active-tab={activeTab === s.id || undefined}
                      data-is-match={isMatch}
                      className={`flex items-center ${editingTabId === s.id ? 'gap-0' : 'gap-1.5'} px-3 h-[32.5px] rounded-lg text-[13px] font-medium whitespace-nowrap border shrink-0 transition-all max-w-[320px] ${
                        activeTab === s.id
                          ? `bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/40 shadow-sm ${isMatch ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-[#1A1A24] shadow-[0_0_15px_rgba(251,192,45,0.4)]' : ''}`
                          : isMatch
                            ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-100 shadow-[0_0_8px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                            : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-violet-500/50'
                      }`}
                    >
                    {editingTabId !== s.id && <Sparkles size={10} className="shrink-0" />}
                    <span className="truncate">
                      <SummaryTitle 
                        summary={s} 
                        isActive={activeTab === s.id} 
                        searchQuery={searchQuery} 
                        onRename={(id, newObj) => updateSummaryMetadata(id, { target_objective: newObj })} 
                        isEditing={editingTabId === s.id}
                        setIsEditing={(val) => setEditingTabId(val ? s.id : null)}
                      />
                    </span>
                  </button>
                  );
                }
              })}
              </div>

              {/* Flecha Derecha */}
              <div className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white dark:from-[#1A1A24] to-transparent z-10 flex items-center justify-end pointer-events-none transition-opacity duration-150 ${canScrollRight ? 'opacity-100' : 'opacity-0'}`}>
                <button 
                  onClick={() => scrollTabs('right')} 
                  className={`p-1 rounded-full bg-white dark:bg-zinc-800 shadow-md text-zinc-400 hover:text-emerald-500 transition-all active:scale-95 border ${hasSearchMatchRight ? 'border-amber-500 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,192,45,0.4)] scale-110' : 'border-zinc-200 dark:border-zinc-700'} mr-1 ${canScrollRight ? 'pointer-events-auto' : 'pointer-events-none'}`}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
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
                  userId={session?.user?.id || ''}
                  noteStatus={note.ai_summary_status ?? 'idle'}
                  getNewOrderIndex={getNewOrderIndex}
                  onPromoteToNote={handlePromoteToNote}
                  onCancel={() => setShowAIInput(false)}
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
                    triggerScrollToActive={triggerScrollToActive}
                    splitRatio={splitRatio}
                    onDividerMouseDown={handleDividerMouseDown}
                  />
                </div>
              );
            }
            
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
                activeTab={activeTab}
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
                triggerScrollToActive={triggerScrollToActive}
              />
            );
          })()}
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