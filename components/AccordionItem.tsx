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

  const editorRef = useRef<HTMLTextAreaElement>(null);
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
    if (shouldFocusEditor) {
      // If title was saved via Enter, focus the content editor
      setIsEditingContent(true);
      setTempContent(note.content); // Ensure tempContent is up-to-date before editing
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="mb-4 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all duration-300 hover:shadow-md">
      {/* Header */}
      <div
        className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${note.isOpen
          ? 'bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800'
          : 'bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}
        onClick={() => {
          // Only toggle if not editing title. 
          // If editing content, maybe we should allow toggling? 
          // Current req: "Move Edit Content button... Al hacer clic: Abre el acordeón (si estaba cerrado)..."
          if (!isEditingTitle) onToggle(note.id);
        }}
      >
        <div className="flex items-center gap-3 flex-1 overflow-hidden">
          <div className={`p-2 rounded-lg ${note.isOpen
            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
            }`}>
            <StickyNote size={20} />
          </div>

          <div className="flex flex-col flex-1 overflow-hidden">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={() => handleSaveTitle(false)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle(true)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Título de la nota..."
                autoFocus
                className="w-full text-lg font-semibold text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-800 placeholder-zinc-400"
              />
            ) : (
              <h3
                className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 truncate select-none hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
                title="Clic para editar título"
              >
                {note.title}
              </h3>
            )}
            {note.updated_at && (
              <span className="text-xs text-zinc-400 font-mono mt-0.5">
                Modificado: {formatDate(note.updated_at)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Edit Content Button (Moved to Header) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isEditingContent) {
                handleSaveContent();
              } else {
                // Open if closed
                if (!note.isOpen) onToggle(note.id);
                // Start editing
                setTempContent(note.content);
                setIsEditingContent(true);
              }
            }}
            className={`p-2 rounded-lg transition-colors ${isEditingContent
              ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
              : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            title={isEditingContent ? "Guardar Contenido" : "Editar Contenido"}
          >
            {isEditingContent ? <Check size={18} /> : <Edit2 size={18} />}
          </button>

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
              if (confirm('¿Estás seguro de eliminar esta nota?')) {
                onDelete(note.id);
              }
            }}
            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Eliminar Nota"
          >
            <Trash2 size={18} />
          </button>

          <div className={`p-2 transform transition-transform duration-300 ${note.isOpen ? 'rotate-180' : ''} text-zinc-400`}>
            <ChevronDown size={20} />
          </div>
        </div>
      </div>

      {/* Content Body */}
      {note.isOpen && (
        <div className="p-0 bg-white dark:bg-zinc-900 animate-fadeIn">
          {/* No more Toolbar */}

          {/* Editor / Viewer */}
          <div className="p-6 pt-2">
            {/* Reduced top padding since toolbar is gone */}
            {isEditingContent ? (
              <SmartEditor
                ref={editorRef}
                value={tempContent}
                onChange={setTempContent}
                placeholder="Escribe tus notas aquí..."
                autoFocus={true}
              />
            ) : (
              <div
                className="w-full min-h-[50px]"
                onDoubleClick={() => {
                  setTempContent(note.content);
                  setIsEditingContent(true);
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