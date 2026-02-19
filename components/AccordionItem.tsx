import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Trash2, Edit2, Check, StickyNote, Pin } from 'lucide-react';
import { Note } from '../types';
import { LinkifiedText } from './LinkifiedText';
import { SmartEditor } from './SmartEditor';

interface AccordionItemProps {
  note: Note;
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({
  note,
  onToggle,
  onUpdate,
  onDelete,
}) => {
  const [isEditingContent, setIsEditingContent] = useState(false);

  /* 
    Create-to-Edit Flow:
    If title is empty (new note), default to editing mode.
  */
  const [isEditingTitle, setIsEditingTitle] = useState(!note.title);
  const [tempTitle, setTempTitle] = useState(note.title);
  const [tempContent, setTempContent] = useState(note.content);

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditingTitle]);

  const handleSaveContent = () => {
    onUpdate(note.id, { content: tempContent });
    setIsEditingContent(false);
  };

  const handleSaveTitle = () => {
    if (tempTitle.trim()) {
      onUpdate(note.id, { title: tempTitle });
    } else {
      // Fallback for empty title save
      const fallback = "Nueva Nota";
      setTempTitle(fallback);
      onUpdate(note.id, { title: fallback });
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="mb-4 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all duration-300 hover:shadow-md">
      {/* Header */}
      <div
        className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${note.isOpen
          ? 'bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800'
          : 'bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}
        onClick={() => !isEditingTitle && onToggle(note.id)}
      >
        <div className="flex items-center gap-3 flex-1 overflow-hidden">
          <div className={`p-2 rounded-lg ${note.isOpen
            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
            }`}>
            <StickyNote size={20} />
          </div>

          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
              onClick={(e) => e.stopPropagation()}
              placeholder="Título de la nota..."
              autoFocus
              className="flex-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-800 placeholder-zinc-400"
            />
          ) : (
            <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 truncate select-none flex-1">
              {note.title}
            </h3>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onUpdate(note.id, { is_pinned: !note.is_pinned });
          }}
          className={`p-2 rounded-lg transition-all ${note.is_pinned
            ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
            : 'text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          title={note.is_pinned ? "Desfijar Nota" : "Fijar Nota"}
        >
          <Pin size={18} className={note.is_pinned ? "fill-current" : ""} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditingTitle(!isEditingTitle);
          }}
          className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          title="Editar Título"
        >
          <Edit2 size={18} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('¿Estás seguro de eliminar esta nota?')) {
              onDelete(note.id);
            }
          }}
          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Eliminar Nota"
        >
          <Trash2 size={18} />
        </button>

        <div className={`transform transition-transform duration-300 ${note.isOpen ? 'rotate-180' : ''} text-zinc-400`}>
          <ChevronDown size={20} />
        </div>
      </div>

      {/* Content Body */}
      {note.isOpen && (
        <div className="p-0 bg-white dark:bg-zinc-900 animate-fadeIn">
          {/* Toolbar */}
          <div className="flex justify-end px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 gap-2">
            <span className="text-xs text-zinc-400 self-center mr-auto px-2">
              {isEditingContent ? 'Modo Edición' : 'Modo Lectura - Enlaces activos'}
            </span>
            {isEditingContent ? (
              <button
                onClick={handleSaveContent}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors shadow-sm"
              >
                <Check size={14} />
                Listo
              </button>
            ) : (
              <button
                onClick={() => {
                  setTempContent(note.content);
                  setIsEditingContent(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md transition-colors shadow-sm"
              >
                <Edit2 size={14} />
                Editar Contenido
              </button>
            )}
          </div>

          {/* Editor / Viewer */}
          <div className="p-6">
            {isEditingContent ? (
              <SmartEditor
                value={tempContent}
                onChange={setTempContent}
                placeholder="Escribe tus notas aquí... (Los enlaces serán clickeables en modo lectura)"
                autoFocus={true}
              />
            ) : (
              <div
                className="w-full min-h-[100px] p-2"
                onClick={() => {
                  // Optional: Double click to edit convenience
                }}
              >
                <LinkifiedText content={note.content} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};