import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Trash2, Check, Pin, PanelLeft, Loader2, CloudCheck, X, MoreVertical, Clock, ListTodo, CheckSquare, Square, GripVertical, Download, Clipboard, CopyPlus } from 'lucide-react';
import { Note, NoteFont } from '../types';
import { SmartNotesEditor } from '../src/components/editor/SmartNotesEditor';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { KanbanSemaphore } from './KanbanSemaphore';

interface AccordionItemProps {
  note: Note;
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  onExportNote?: (note: Note) => void;
  onCopyNote?: (note: Note) => void;
  onDuplicate?: (noteId: string) => void;
  searchQuery?: string;
  noteFont?: NoteFont;
  noteFontSize?: string;
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
      <mark key={index} className="bg-yellow-200 dark:bg-yellow-500/40 text-yellow-900 dark:text-yellow-100 rounded-sm px-0.5 font-medium">
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
  searchQuery,
  noteFont = 'sans',
  noteFontSize = 'medium',
}) => {
  const fontClass = noteFont === 'serif' ? 'font-serif' : noteFont === 'mono' ? 'font-mono text-xs' : 'font-sans';
  const [isEditingTitle, setIsEditingTitle] = useState(!note.title);
  const [tempTitle, setTempTitle] = useState(note.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showStickyTitle, setShowStickyTitle] = useState(false);

  useEffect(() => {
    if (!note.isOpen) {
      setShowStickyTitle(false);
      return;
    }
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
  }, [note.isOpen]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const toggleChecklistItem = (index: number) => {
    const lines = note.content.split('\n');
    const line = lines[index];
    if (line.startsWith('[x] ')) lines[index] = '[ ] ' + line.slice(4);
    else if (line.startsWith('[ ] ')) lines[index] = '[x] ' + line.slice(4);
    else lines[index] = '[x] ' + line;
    const pendingLines = lines.filter(l => l.trim() && !l.trim().startsWith('[x] '));
    const completedLines = lines.filter(l => l.trim() && l.trim().startsWith('[x] '));
    const emptyLines = lines.filter(l => !l.trim());
    onUpdate(note.id, { content: [...pendingLines, ...completedLines, ...emptyLines].join('\n') });
  };

  const handleDragEndChecklist = (result: any) => {
    if (!result.destination) return;
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    if (sourceIndex === destinationIndex) return;
    const lines = note.content.split('\n');
    const [reorderedItem] = lines.splice(sourceIndex, 1);
    lines.splice(destinationIndex, 0, reorderedItem);
    onUpdate(note.id, { content: lines.join('\n') });
  };

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
    onUpdate(note.id, { content: newMarkdown });
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
    if (shouldFocusEditor && !note.isOpen) onToggle(note.id);
  };

  // 🚀 FIX: Estandarización de ring y hover across toda la app, dependiente exclusivamente de pseudo-clases css
  return (
    <div className="mb-4 transition-all duration-300 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 focus-within:ring-2 focus-within:ring-indigo-500/50">
      
      <div
        ref={headerRef}
        className={`flex items-start sm:items-center justify-between px-4 py-4 cursor-pointer transition-colors ${note.isOpen
          ? 'border-b border-zinc-100 dark:border-zinc-800'
          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-2xl'
          }`}
        onClick={() => { onToggle(note.id); }}
      >
        <div className="flex items-center gap-3 flex-1 overflow-hidden pl-1">
          <div className="flex flex-col flex-1 min-w-0 justify-center">
            <input
              ref={titleInputRef}
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={() => handleSaveTitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle(true);
                if (e.key === 'Escape') { e.stopPropagation(); handleCancelTitle(); }
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="Título de la nota..."
              className="flex-1 min-w-0 bg-transparent text-lg font-bold text-zinc-800 dark:text-zinc-100 outline-none placeholder-zinc-400 truncate hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-text"
              title="Haz clic para editar"
            />

            <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 truncate">
              {note.created_at && (<span>Creado: {formatCleanDate(note.created_at)}</span>)}
              {note.updated_at && note.created_at && (new Date(note.updated_at).getTime() - new Date(note.created_at).getTime() > 60000) && (
                <><span className="opacity-50">|</span><span>Editado: {formatCleanDate(note.updated_at)}</span></>
              )}
              {syncStatus === 'saving' && (<span className="flex items-center gap-1 text-amber-500 animate-pulse ml-1"><Loader2 size={10} className="animate-spin" /> Guardando...</span>)}
              {syncStatus === 'saved' && (<span className="flex items-center gap-1 text-emerald-500 ml-1"><CloudCheck size={10} /> Sincronizado</span>)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <KanbanSemaphore sourceId={note.id} sourceTitle={note.title || 'Sin título'} onInteract={() => { if (!note.isOpen) onToggle(note.id); }} />
          <div className="hidden md:flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); onUpdate(note.id, { is_checklist: !note.is_checklist }); }} className={`p-1.5 rounded-lg transition-all ${note.is_checklist ? 'text-[#1F3760] bg-blue-50 dark:bg-[#1F3760]/20' : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}><ListTodo size={15} /></button>
            <button onClick={(e) => { e.stopPropagation(); e.currentTarget.blur(); onUpdate(note.id, { is_pinned: !note.is_pinned }); }} className={`p-1.5 rounded-lg transition-all ${note.is_pinned ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}><Pin size={15} className={note.is_pinned ? "fill-current" : ""} /></button>
            <button onClick={(e) => { e.stopPropagation(); e.currentTarget.blur(); onUpdate(note.id, { is_docked: !note.is_docked }); }} className={`p-1.5 rounded-lg transition-all ${note.is_docked ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'text-zinc-400 hover:text-indigo-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}><PanelLeft size={15} /></button>
            {onCopyNote && <button onClick={(e) => { e.stopPropagation(); onCopyNote(note); }} className="p-1.5 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Copiar Nota"><Clipboard size={15} /></button>}
            {onExportNote && <button onClick={(e) => { e.stopPropagation(); onExportNote(note); }} className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Exportar Nota (.md)"><Download size={15} /></button>}
            {onDuplicate && <button onClick={(e) => { e.stopPropagation(); onDuplicate(note.id); }} className="p-1.5 text-zinc-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors" title="Duplicar Nota"><CopyPlus size={15} /></button>}
            <button onClick={(e) => { e.stopPropagation(); e.currentTarget.blur(); if (confirm('¿Estás seguro de eliminar esta nota?')) onDelete(note.id); }} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={15} /></button>
          </div>

          <div className="relative flex md:hidden" ref={mobileMenuRef}>
            <button onClick={(e) => { e.stopPropagation(); if (!note.isOpen) onToggle(note.id); setIsMobileMenuOpen(!isMobileMenuOpen); }} className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"><MoreVertical size={16} /></button>
            {isMobileMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-zinc-800 shadow-xl rounded-lg border border-zinc-200 dark:border-zinc-700 p-1 flex flex-col gap-0.5 min-w-[160px] animate-fadeIn">
                <button onClick={(e) => { e.stopPropagation(); onUpdate(note.id, { is_pinned: !note.is_pinned }); setIsMobileMenuOpen(false); }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${note.is_pinned ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}><Pin size={14} className={note.is_pinned ? "fill-current" : ""} />{note.is_pinned ? 'Desfijar' : 'Fijar Nota'}</button>
                <button onClick={(e) => { e.stopPropagation(); onUpdate(note.id, { is_docked: !note.is_docked }); setIsMobileMenuOpen(false); }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${note.is_docked ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}><PanelLeft size={14} />{note.is_docked ? 'Quitar del Sidebar' : 'Anclar al Sidebar'}</button>
                <button onClick={(e) => { e.stopPropagation(); onUpdate(note.id, { is_checklist: !note.is_checklist }); setIsMobileMenuOpen(false); }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${note.is_checklist ? 'text-[#1F3760] dark:text-blue-400 bg-blue-50 dark:bg-[#1F3760]/20' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}><ListTodo size={14} />{note.is_checklist ? 'Quitar Checklist' : 'Hacer Checklist'}</button>
                {onCopyNote && <button onClick={(e) => { e.stopPropagation(); onCopyNote(note); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><Clipboard size={14} />Copiar Nota</button>}
                {onExportNote && <button onClick={(e) => { e.stopPropagation(); onExportNote(note); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><Download size={14} />Exportar (.md)</button>}
                {onDuplicate && <button onClick={(e) => { e.stopPropagation(); onDuplicate(note.id); setIsMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><CopyPlus size={14} />Duplicar Nota</button>}
                <div className="border-t border-zinc-100 dark:border-zinc-700 my-0.5" />
                <button onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(false); if (confirm('¿Estás seguro de eliminar esta nota?')) onDelete(note.id); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={14} />Eliminar Nota</button>
              </div>
            )}
          </div>

          <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-400 transition-colors shrink-0 ml-1 md:ml-2">
            {note.isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {note.isOpen && (
        <div ref={contentRef} className="p-0 bg-white dark:bg-zinc-900 animate-fadeIn relative rounded-b-2xl">
          {showStickyTitle && (
            <div className="fixed top-14 md:top-16 left-0 right-0 z-[40] flex justify-center pointer-events-none animate-fadeIn px-4">
              <div onClick={(e) => { e.stopPropagation(); headerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="bg-zinc-800/95 dark:bg-zinc-200/95 backdrop-blur-md text-white dark:text-zinc-900 px-5 py-1.5 rounded-full shadow-lg shadow-black/10 text-xs font-bold flex items-center gap-2 pointer-events-auto cursor-pointer active:scale-95 transition-transform border border-zinc-700 dark:border-zinc-300"><span className="truncate max-w-[200px] sm:max-w-[400px]">{note.title || 'Sin título'}</span><ChevronUp size={14} className="opacity-70" /></div>
            </div>
          )}

          <div className="px-4 py-4 w-full overflow-hidden">
            {note.is_checklist ? (
              <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                <DragDropContext onDragEnd={handleDragEndChecklist}>
                  <Droppable droppableId={`checklist-${note.id}`}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1">
                        {note.content.split('\n').map((line, index) => {
                          if (!line.trim()) return null;
                          const isChecked = line.startsWith('[x] ');
                          const cleanText = line.replace(/^\[[x ]\] /, '');
                          return (
                            <Draggable draggableId={`checklist-${note.id}-${index}`} index={index} key={`checklist-${note.id}-${index}`}>
                              {(provided, snapshot) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} className={`flex items-start gap-1.5 group rounded-md px-1 py-0.5 transition-colors ${snapshot.isDragging ? 'bg-zinc-100 dark:bg-zinc-800 shadow-md ring-1 ring-zinc-200 dark:ring-zinc-700' : ''}`}>
                                  <div {...provided.dragHandleProps} className="mt-0.5 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 cursor-grab active:cursor-grabbing shrink-0"><GripVertical size={14} /></div>
                                  <button onClick={(e) => { e.stopPropagation(); toggleChecklistItem(index); }} className={`mt-0.5 shrink-0 rounded transition-colors ${isChecked ? 'text-emerald-500' : 'text-zinc-400 hover:text-[#1F3760]'}`}>{isChecked ? <CheckSquare size={16} /> : <Square size={16} />}</button>
                                  <span className={`flex-1 text-[15px] font-sans leading-[24px] ${isChecked ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-700 dark:text-zinc-300'}`}>{highlightText(cleanText, searchQuery)}</span>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            ) : (
              <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 cursor-text min-h-[120px]">
                <SmartNotesEditor noteId={note.id} initialContent={note.content} searchQuery={searchQuery} onChange={handleUpdateContent} noteFont={noteFont} noteFontSize={noteFontSize} />
              </div>
            )}
          </div>

          <div onClick={(e) => { e.stopPropagation(); onToggle(note.id); }} className="flex items-center justify-center gap-2 py-3 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/30 dark:hover:bg-zinc-800/60 border-t border-zinc-200 dark:border-zinc-800 cursor-pointer transition-colors text-zinc-500 dark:text-zinc-400 font-bold rounded-b-2xl"><ChevronUp size={16} /><span className="text-xs uppercase tracking-wider">Cerrar Nota</span></div>
        </div>
      )}
    </div>
  );
};