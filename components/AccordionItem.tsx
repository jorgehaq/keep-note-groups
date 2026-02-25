import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Trash2, Check, Pin, PanelLeft, Loader2, CloudCheck, X, MoreVertical, Clock, ListTodo, CheckSquare, Square, GripVertical } from 'lucide-react';
import { Note, NoteFont } from '../types';
import { SmartNotesEditor } from '../src/components/editor/SmartNotesEditor';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { KanbanSemaphore } from './KanbanSemaphore';

interface AccordionItemProps {
  note: Note;
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  searchQuery?: string;
  noteFont?: NoteFont;
  noteFontSize?: string;
}

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
  searchQuery,
  noteFont = 'sans',
  noteFontSize = 'medium',
}) => {
  const fontClass = noteFont === 'serif' ? 'font-serif' : noteFont === 'mono' ? 'font-mono text-xs' : 'font-sans';

  const [isEditingTitle, setIsEditingTitle] = useState(!note.title);
  const [tempTitle, setTempTitle] = useState(note.title);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null); // <-- NUEVO

  // Mobile kebab menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const toggleChecklistItem = (index: number) => {
    const lines = note.content.split('\n');
    const line = lines[index];
    if (line.startsWith('[x] ')) {
      lines[index] = '[ ] ' + line.slice(4);
    } else if (line.startsWith('[ ] ')) {
      lines[index] = '[x] ' + line.slice(4);
    } else {
      lines[index] = '[x] ' + line;
    }

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

  const cleanMarkdownToNaturalText = (text: string) => {
    let cleaned = text;
    cleaned = cleaned.replace(/^#+\s+/gm, '');
    cleaned = cleaned.replace(/^>\s+/gm, '');
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '"$1"');
    cleaned = cleaned.replace(/\b_([^_]+)_\b/g, '"$1"');
    cleaned = cleaned.replace(/`([^`]+)`/g, '"$1"');
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '"$1"');
    return cleaned;
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
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditingTitle]);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // We rely directly on onChange from SmartNotesEditor to push updates up to the parent and Supabase.
  const handleUpdateContent = (newMarkdown: string) => {
    if (newMarkdown === note.content) return;

    // Ponemos la UI en modo guardando
    setSyncStatus('saving');
    
    // Le decimos a App.tsx que actualice (App.tsx ahora se encarga de esperar 2 segundos para la DB)
    onUpdate(note.id, { content: newMarkdown });

    // Sincronizamos la respuesta visual con los 5 segundos de App.tsx
    if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
    }
    
    syncTimeoutRef.current = setTimeout(() => {
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 2000); // El mensaje de "Sincronizado" desaparece a los 2s
    }, 5000); 
  };

  const handleCancelTitle = () => {
    setTempTitle(note.title);
    setIsEditingTitle(false);
  };

  const handleSaveTitle = (shouldFocusEditor = false) => {
    if (tempTitle.trim()) {
      onUpdate(note.id, { title: tempTitle });
    } else {
      // Fallback for empty title save
      const fallback = "Nueva Nota";
      setTempTitle(fallback);
      onUpdate(note.id, { title: fallback });
    }
    setIsEditingTitle(false);
    if (shouldFocusEditor && !note.isOpen) {
      // if title was saved via Enter and note is closed, open it to let them write
      onToggle(note.id);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  return (
    <div className={`mb-2 transition duration-300 overflow-hidden ${note.isOpen
      ? 'bg-white dark:bg-zinc-900 shadow-md ring-2 ring-indigo-500/40 rounded-xl border-transparent'
      : 'bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 hover:shadow-md rounded-xl'
      }`}>
      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors border-b ${note.isOpen
          ? 'bg-indigo-50/60 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20'
          : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}
        onClick={() => {
          if (!isEditingTitle) onToggle(note.id);
        }}
      >
        <div className="flex items-center gap-2 flex-1 overflow-hidden pl-1">
          <div className="flex flex-col flex-1 min-w-0 justify-center">
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5 flex-1 animate-fadeIn">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onBlur={() => handleSaveTitle(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle(true);
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      handleCancelTitle();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Título de la nota..."
                  autoFocus
                  className="flex-1 min-w-0 text-sm font-medium text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-800 placeholder-zinc-400"
                />
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelTitle();
                  }}
                  className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors shrink-0"
                  title="Cancelar (Esc)"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <h3
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate select-none hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer hover:underline decoration-zinc-400 decoration-dashed underline-offset-4"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
                title={note.title || 'Nota sin título'}
              >
                {note.title ? highlightText(note.title, searchQuery) : <span className="text-zinc-400 italic">Sin título</span>}
              </h3>
            )}
            {!isEditingTitle && (
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                {note.updated_at && (
                  <>
                    <Clock size={10} className="shrink-0" />
                    <span className="font-mono">{formatDate(note.updated_at)}</span>
                  </>
                )}
                {syncStatus === 'saving' && (
                  <span className="flex items-center gap-0.5 text-amber-500 font-mono whitespace-nowrap animate-pulse">
                    <Loader2 size={10} className="animate-spin" />
                    Guardando...
                  </span>
                )}
                {syncStatus === 'saved' && (
                  <span className="flex items-center gap-0.5 text-emerald-500 font-mono whitespace-nowrap">
                    <CloudCheck size={10} />
                    Sincronizado
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">

          {/* 1. SEMÁFORO KANBAN: Visible siempre, abre la nota al interactuar */}
          <KanbanSemaphore
            sourceId={note.id}
            sourceTitle={note.title || 'Sin título'}
            onInteract={() => {
              if (!note.isOpen) onToggle(note.id);
            }}
          />

          {/* 3. BOTONES DESKTOP (Checklist, Pin, Dock, Delete) */}
          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(note.id, { is_checklist: !note.is_checklist });
              }}
              className={`p-1.5 rounded-lg transition-all ${note.is_checklist
                ? 'text-[#1F3760] bg-blue-50 dark:bg-[#1F3760]/20'
                : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              title={note.is_checklist ? 'Desactivar Checklist' : 'Convertir en Checklist'}
            >
              <ListTodo size={15} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.currentTarget.blur();
                onUpdate(note.id, { is_pinned: !note.is_pinned });
              }}
              className={`p-1.5 rounded-lg transition-all ${note.is_pinned
                ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                : 'text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              title={note.is_pinned ? "Desfijar Nota" : "Fijar Nota"}
            >
              <Pin size={15} className={note.is_pinned ? "fill-current" : ""} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                e.currentTarget.blur();
                onUpdate(note.id, { is_docked: !note.is_docked });
              }}
              className={`p-1.5 rounded-lg transition-all ${note.is_docked
                ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'text-zinc-400 hover:text-indigo-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              title={note.is_docked ? "Quitar del Sidebar" : "Anclar al Sidebar"}
            >
              <PanelLeft size={15} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                e.currentTarget.blur();
                if (confirm('¿Estás seguro de eliminar esta nota?')) {
                  onDelete(note.id);
                }
              }}
              className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Eliminar Nota"
            >
              <Trash2 size={15} />
            </button>
          </div>

          {/* Mobile-only: Kebab menu */}
          <div className="relative flex md:hidden" ref={mobileMenuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // MAGIA: Si el acordeón está cerrado, lo abre
                if (!note.isOpen) onToggle(note.id);
                // Abre el menú
                setIsMobileMenuOpen(!isMobileMenuOpen);
              }}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="Más opciones"
            >
              <MoreVertical size={16} />
            </button>

            {isMobileMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-zinc-800 shadow-xl rounded-lg border border-zinc-200 dark:border-zinc-700 p-1 flex flex-col gap-0.5 min-w-[160px] animate-fadeIn">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate(note.id, { is_pinned: !note.is_pinned });
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${note.is_pinned
                    ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                    }`}
                >
                  <Pin size={14} className={note.is_pinned ? "fill-current" : ""} />
                  {note.is_pinned ? 'Desfijar' : 'Fijar Nota'}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate(note.id, { is_docked: !note.is_docked });
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${note.is_docked
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                    }`}
                >
                  <PanelLeft size={14} />
                  {note.is_docked ? 'Quitar del Sidebar' : 'Anclar al Sidebar'}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate(note.id, { is_checklist: !note.is_checklist });
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${note.is_checklist
                    ? 'text-[#1F3760] dark:text-blue-400 bg-blue-50 dark:bg-[#1F3760]/20'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                    }`}
                >
                  <ListTodo size={14} />
                  {note.is_checklist ? 'Quitar Checklist' : 'Hacer Checklist'}
                </button>

                <div className="border-t border-zinc-100 dark:border-zinc-700 my-0.5" />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMobileMenuOpen(false);
                    if (confirm('¿Estás seguro de eliminar esta nota?')) {
                      onDelete(note.id);
                    }
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 size={14} />
                  Eliminar Nota
                </button>
              </div>
            )}
          </div>

          <div className={`p-1 transform transition-transform duration-300 ${note.isOpen ? 'rotate-180' : ''} text-zinc-400`}>
            <ChevronDown size={16} />
          </div>
        </div>
      </div>

      {/* Content Body */}
      {note.isOpen && (
        <div className="p-0 bg-white dark:bg-zinc-900 animate-fadeIn">
          {/* No more Toolbar */}

          {/* Editor / Viewer */}
          <div className="px-3 md:px-6 py-2 w-full overflow-hidden">
            {note.is_checklist ? (
              // Keep the original rich checklist implementation intact since its fully custom drag-and-drop
              <DragDropContext onDragEnd={handleDragEndChecklist}>
                <Droppable droppableId={`checklist-${note.id}`}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1 mt-1 mb-4">
                      {note.content.split('\n').map((line, index) => {
                        if (!line.trim()) return null;
                        const isChecked = line.startsWith('[x] ');
                        const cleanText = line.replace(/^\[[x ]\] /, '');
                        return (
                          <Draggable draggableId={`checklist-${note.id}-${index}`} index={index} key={`checklist-${note.id}-${index}`}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-start gap-1.5 group rounded-md px-1 py-0.5 transition-colors ${snapshot.isDragging ? 'bg-zinc-100 dark:bg-zinc-800 shadow-md ring-1 ring-zinc-200 dark:ring-zinc-700' : ''}`}
                              >
                                <div {...provided.dragHandleProps} className="mt-0.5 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 cursor-grab active:cursor-grabbing shrink-0">
                                  <GripVertical size={14} />
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleChecklistItem(index); }}
                                  className={`mt-0.5 shrink-0 rounded transition-colors ${isChecked ? 'text-emerald-500' : 'text-zinc-400 hover:text-[#1F3760]'}`}
                                >
                                  {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                                </button>
                                <span className={`flex-1 text-[15px] font-sans leading-[24px] ${isChecked ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                  {highlightText(cleanText, searchQuery)}
                                </span>
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
            ) : (
              <div className="pb-4 min-h-[50px]">
                <SmartNotesEditor
                  noteId={note.id}
                  initialContent={note.content}
                  searchQuery={searchQuery}
                  onChange={handleUpdateContent}
                  noteFont={noteFont}
                  noteFontSize={noteFontSize}
                />
              </div>
            )}
          </div>

          {/* Footer para cerrar nota larga */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggle(note.id);
            }}
            className="flex items-center justify-center gap-2 py-2 mt-2 bg-indigo-50/60 hover:bg-indigo-100/60 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 border-t border-indigo-100 dark:border-indigo-500/20 cursor-pointer transition-colors text-indigo-600 dark:text-indigo-400 font-bold"
          >
            <ChevronUp size={16} />
            <span className="text-xs uppercase tracking-wider">
              Cerrar: {note.title ? note.title.substring(0, 30) : 'Sin título'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};