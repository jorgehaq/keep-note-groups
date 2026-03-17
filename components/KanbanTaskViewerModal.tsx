import React from 'react';
import { X, Pencil, ListTodo, Type, Check } from 'lucide-react';
import { Task } from '../types';
import { SmartNotesEditor } from '../src/components/editor/SmartNotesEditor';

interface KanbanTaskViewerModalProps {
    task: Task;
    onClose: () => void;
    onEdit: (task: Task) => void;
}

export const KanbanTaskViewerModal: React.FC<KanbanTaskViewerModalProps> = ({ task, onClose, onEdit }) => {
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div 
                className="bg-white dark:bg-[#1A1A24] w-full max-w-2xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-[#2D2D42] flex flex-col overflow-hidden animate-scaleIn"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-[#2D2D42] bg-zinc-50/50 dark:bg-[#1A1A24]/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shadow-inner">
                            <ListTodo size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-800 dark:text-[#CCCCCC]">
                                Detalle de Tarea
                            </h2>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-none">Visor Kanban</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => onEdit(task)}
                            className="p-2 text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all flex items-center gap-2"
                            title="Editar esta tarea"
                        >
                            <Pencil size={20} />
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-[#CCCCCC] hover:bg-zinc-100 dark:hover:bg-[#2D2D42] rounded-xl transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 hidden-scrollbar">
                    {/* Title */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            <Type size={14} /> Título
                        </label>
                        <div className="w-full bg-zinc-50/50 dark:bg-[#101018]/50 border border-zinc-200 dark:border-[#2D2D42] p-4 rounded-xl text-zinc-800 dark:text-[#CCCCCC] font-bold text-xl leading-snug">
                            {task.title || <span className="text-zinc-400 italic font-normal">Sin título</span>}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="space-y-2 flex flex-col min-h-[200px]">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            <Check size={14} /> Contenido / Notas
                        </label>
                        <div className="flex-1 rounded-xl border border-zinc-200 dark:border-[#2D2D42] bg-white dark:bg-[#101018] overflow-hidden flex flex-col shadow-inner">
                            <div className="flex-1 overflow-y-auto min-h-0 note-editor-scroll p-2">
                                <SmartNotesEditor 
                                    noteId={`view-${task.id}`}
                                    initialContent={task.content || ''}
                                    onChange={() => {}}
                                    readOnly={true}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-zinc-100 dark:border-[#2D2D42] flex items-center justify-end gap-3 bg-zinc-50/50 dark:bg-[#1A1A24]/50">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold shadow-lg transition-all active:scale-95"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};
