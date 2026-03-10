import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, Trash2, Check, Pin, PanelLeft, Loader2, CloudCheck, X, MoreVertical, Clock, ListTodo, CheckSquare, Square, GripVertical, Download, Clipboard, CopyPlus, FolderInput, Hash } from 'lucide-react';
import { Note, NoteFont } from '../types';
import { SmartNotesEditor } from '../src/components/editor/SmartNotesEditor';
import { ChecklistEditor, parseMarkdownToChecklist, serializeChecklistToMarkdown } from '../src/components/editor/ChecklistEditor';
import { KanbanSemaphore } from './KanbanSemaphore';
import { MoveToGroupModal } from './MoveToGroupModal';
import { Group } from '../types';
import { Session } from '@supabase/supabase-js';
import { NoteAIPanel } from './NoteAIPanel';
import { NoteBreadcrumb } from './NoteBreadcrumb';
import { useNoteTree } from '../src/lib/useNoteTree';

interface AccordionItemProps {
  note: Note;
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  onExportNote?: (note: Note) => void;
  onCopyNote?: (note: Note) => void;
  onDuplicate?: (noteId: string) => void;
  onMove?: (noteId: string, targetGroupId: string) => Promise<void>;
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

export const AccordionItem: React.FC<AccordionItemProps> = ({
  note,
  onToggle,
  onUpdate,
  onDelete,
  onExportNote,
  onCopyNote,
  onDuplicate,
  onMove,
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
  const fontClass = noteFont === 'serif' ? 'font-serif' : noteFont === 'mono' ? 'font-mono text-xs' : 'font-sans';
  const [isEditingTitle, setIsEditingTitle] = useState(!note.title);
  const [tempTitle, setTempTitle] = useState(note.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // --- AI Summary State ---
  const { activeNoteId, activeNote, breadcrumbPath, navigate } = useNoteTree(note.id);
  const displayContent = activeNote?.content ?? note.content;
  const displayNoteId = activeNoteId ?? note.id;

  // 🚀 NUEVO: Sincronización Realtime UI
  // Fuerza la actualización del input local si el título cambia en otro dispositivo
  useEffect(() => {
    // Solo sincronizar si NO está en modo edición activa
    if (!isEditingTitle && note.title !== undefined && note.title !== tempTitle) {
      setTempTitle(note.title);
    }
  }, [note.title, isEditingTitle]);

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
    if (tempTitle.trim()) onUpdate(note.id, { title: tempTitle });
    else {
      const fallback = "Nueva Nota";
      setTempTitle(fallback);
      onUpdate(note.id, { title: fallback });
    }
  };

  return (
    <div className={`transition-all duration-300 flex-1 flex flex-col min-h-0 bg-white dark:bg-[#1A1A24] overflow-hidden ${
      note.is_docked 
        ? 'rounded-none shadow-none border-b border-zinc-200 dark:border-[#2D2D42]' 
        : 'rounded-2xl shadow-lg border'
    } ${
      isHighlightedBySearch
        ? 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-50/30 dark:bg-amber-900/10'
        : `${note.is_docked ? '' : 'border-zinc-200 dark:border-[#2D2D42] hover:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/50'}`
    }`}>
      
      <div
        ref={headerRef}
        className="flex flex-wrap items-start sm:items-center justify-between px-4 pt-4 pb-2 transition-colors gap-2"
      >
        <div className="flex items-center gap-3 flex-1 overflow-hidden pl-1">
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
                onBlur={() => handleSaveTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle(true);
                  if (e.key === 'Escape') { e.stopPropagation(); handleCancelTitle(); }
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    // Focus directly into the editor area
                    const editorContainer = contentRef.current;
                    if (editorContainer) {
                      const focusable = editorContainer.querySelector('input, .cm-content') as HTMLElement;
                      if (focusable) focusable.focus();
                    }
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="Título de la nota..."
                className={`w-full bg-transparent text-lg font-bold outline-none placeholder-zinc-400 transition-colors cursor-text pr-2 ${
                  searchQuery && tempTitle.toLowerCase().includes(searchQuery.toLowerCase())
                    ? "text-transparent caret-zinc-800 dark:caret-[#CCCCCC]"
                    : "text-zinc-800 dark:text-[#CCCCCC]"
                }`}
                title="Haz clic para editar"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onToggleLineNumbers && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleLineNumbers(); }}
              className={`p-1.5 rounded-lg transition-colors ${
                showLineNumbers
                  ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title={showLineNumbers ? 'Ocultar números de línea' : 'Mostrar números de línea'}
            >
              <Hash size={14} />
            </button>
          )}
          <KanbanSemaphore sourceId={note.id} sourceTitle={note.title || 'Sin título'} onInteract={() => {}} />

          <div className="relative" ref={mobileMenuRef}>
            <button onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(!isMobileMenuOpen); }} className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"><MoreVertical size={16} /></button>
            {isMobileMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-[#1A1A24] shadow-xl rounded-lg border border-zinc-200 dark:border-[#2D2D42] p-1 flex flex-col gap-0.5 min-w-[180px] animate-fadeIn">
                <button onClick={(e) => { 
                  e.stopPropagation(); 
                  const willBeChecklist = !note.is_checklist;
                  let newContent = note.content;
                  if (willBeChecklist) {
                      newContent = serializeChecklistToMarkdown(parseMarkdownToChecklist(note.content));
                  }
                  onUpdate(note.id, { is_checklist: willBeChecklist, content: newContent }); 
                  setIsMobileMenuOpen(false); 
                }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${note.is_checklist ? 'text-[#1F3760] dark:text-blue-400 bg-blue-50 dark:bg-[#1F3760]/20' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}><ListTodo size={14} />{note.is_checklist ? 'Quitar Checklist' : 'Hacer Checklist'}</button>
                <button onClick={(e) => { e.stopPropagation(); e.currentTarget.blur(); onUpdate(note.id, { is_pinned: !note.is_pinned }); setIsMobileMenuOpen(false); }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${note.is_pinned ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}><Pin size={14} className={note.is_pinned ? "fill-current" : ""} />{note.is_pinned ? 'Desfijar' : 'Fijar Nota'}</button>
                {onDuplicate && <button onClick={(e) => { e.stopPropagation(); onDuplicate(note.id); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><CopyPlus size={14} />Duplicar Nota</button>}
                {onMove && <button onClick={(e) => { e.stopPropagation(); setIsMoveModalOpen(true); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42] transition-colors"><FolderInput size={14} />Mover de Grupo</button>}
                <div className="border-t border-zinc-100 dark:border-[#2D2D42] my-0.5" />
                <button onClick={(e) => { e.stopPropagation(); e.currentTarget.blur(); onUpdate(note.id, { is_docked: !note.is_docked }); setIsMobileMenuOpen(false); }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${note.is_docked ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}><PanelLeft size={14} />{note.is_docked ? 'Quitar del Sidebar' : 'Anclar al Sidebar'}</button>
                {onCopyNote && <button onClick={(e) => { e.stopPropagation(); onCopyNote(note); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><Clipboard size={14} />Copiar Nota</button>}
                {onExportNote && <button onClick={(e) => { e.stopPropagation(); onExportNote(note); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><Download size={14} />Exportar (.md)</button>}
                <div className="border-t border-zinc-100 dark:border-zinc-700 my-0.5" />
                <button onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(false); if (confirm('¿Estás seguro de eliminar esta nota?')) onDelete(note.id); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={14} />Eliminar Nota</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div 
        ref={contentRef}
        className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white dark:bg-[#1A1A24] relative"
      >
        {showStickyTitle && (
          <div className="sticky top-4 left-0 right-0 z-[40] flex justify-center pointer-events-none animate-fadeIn px-4">
            <div onClick={(e) => { e.stopPropagation(); headerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="bg-white/95 dark:bg-zinc-100/95 backdrop-blur-md text-zinc-900 dark:text-zinc-900 px-5 py-1.5 rounded-full shadow-lg shadow-black/10 text-[13px] font-bold flex items-center gap-2 pointer-events-auto cursor-pointer active:scale-95 transition-all border border-zinc-200/50 dark:border-zinc-300 w-auto max-w-[90%] sm:max-w-[400px] hover:shadow-xl"><span className="truncate">{note.title || 'Sin título'}</span><ChevronUp size={14} className="opacity-70 shrink-0" /></div>
          </div>
        )}

        <div className="px-4 pb-4 pt-2 w-full flex-1 flex flex-col min-h-0">
          <NoteBreadcrumb 
            path={breadcrumbPath}
            activeNoteId={activeNoteId || note.id}
            onNavigate={navigate}
          />

          {note.is_checklist ? (
            <div className="bg-zinc-50 dark:bg-[#242432] border border-zinc-200 dark:border-[#2D2D42] rounded-xl p-4">
              <ChecklistEditor idPrefix={displayNoteId} initialContent={displayContent} onUpdate={handleUpdateContent} />
            </div>
          ) : (
            <div className="note-editor-scroll bg-zinc-50 dark:bg-[#242432] border border-zinc-200 dark:border-[#2D2D42] rounded-xl p-4 cursor-text flex-1 overflow-y-scroll min-h-0">
              <SmartNotesEditor 
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
          )}

          {session?.user && (
            <NoteAIPanel 
              noteId={displayNoteId}
              userId={session.user.id}
            />
          )}
        </div>
      </div>

      {/* Footer: Fechas y Estado Sync (Estilo Pizarrón) */}
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