import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Trash2, Edit2, Check, StickyNote, Pin } from 'lucide-react';
import { Note } from '../types';
import { LinkifiedText } from './LinkifiedText';

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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(note.title);
  const [tempContent, setTempContent] = useState(note.content);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (isEditingContent && contentRef.current) {
      contentRef.current.focus();
    }
  }, [isEditingContent]);

  const handleSaveContent = () => {
    onUpdate(note.id, { content: tempContent });
    setIsEditingContent(false);
  };

  const handleSaveTitle = () => {
    if (tempTitle.trim()) {
      onUpdate(note.id, { title: tempTitle });
    } else {
      setTempTitle(note.title);
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="mb-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-300 hover:shadow-md">
      {/* Header */}
      <div
        className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${note.isOpen
          ? 'bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800'
          : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        onClick={() => !isEditingTitle && onToggle(note.id)}
      >
        <div className="flex items-center gap-3 flex-1 overflow-hidden">
          <div className={`p-2 rounded-lg ${note.isOpen
            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
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
              className="flex-1 text-lg font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-600 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800"
            />
          ) : (
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 truncate select-none flex-1">
              {note.title}
            </h3>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onUpdate(note.id, { is_pinned: !note.is_pinned });
          }}
          className={`p-2 rounded-full transition-colors ${note.is_pinned
            ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30'
            : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          title={note.is_pinned ? "Desfijar Nota" : "Fijar Nota"}
        >
          {/* Using StickyNote for Pin icon as requested? User asked for "Chincheta/Pin". 
                 StickyNote is already used for icon. Let's use 'Pin' from lucide-react. 
                 Need to import Pin. */}
          <Pin size={16} className={note.is_pinned ? "fill-current" : ""} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditingTitle(!isEditingTitle);
          }}
          className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors"
          title="Editar Título"
        >
          <Edit2 size={16} />
        </button>



        <div className={`transform transition-transform duration-300 ${note.isOpen ? 'rotate-180' : ''} text-slate-400`}>
          <ChevronDown size={20} />
        </div>
      </div>

      {/* Content Body */}
      {
        note.isOpen && (
          <div className="p-0 bg-white dark:bg-slate-900 animate-fadeIn">
            {/* Toolbar */}
            <div className="flex justify-end px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 gap-2">
              <span className="text-xs text-slate-400 self-center mr-auto px-2">
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
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md transition-colors shadow-sm"
                >
                  <Edit2 size={14} />
                  Editar Contenido
                </button>
              )}
            </div>

            {/* Editor / Viewer */}
            <div className="p-6">
              {isEditingContent ? (
                <textarea
                  ref={contentRef}
                  value={tempContent}
                  onChange={(e) => setTempContent(e.target.value)}
                  placeholder="Escribe tus notas aquí... (Los enlaces serán clickeables en modo lectura)"
                  className="w-full min-h-[300px] p-4 text-sm font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y leading-relaxed"
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
        )
      }
    </div >
  );
};