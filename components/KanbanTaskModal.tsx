import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Save, Type, ListTodo, LayoutDashboard, Pencil, Loader2 } from 'lucide-react';
import { Task, TaskStatus } from '../types';
import { SmartNotesEditor } from '../src/components/editor/SmartNotesEditor';
import { useTranslation } from 'react-i18next';

interface KanbanTaskModalProps {
    task: Partial<Task>;
    onClose: () => void;
    onSave: (updates: Partial<Task>) => void;
    isNew?: boolean;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string; hex: string; textClass: string }[] = [
    { value: 'backlog', label: 'Backlog', hex: '#9E9E9E', textClass: 'text-zinc-950' },
    { value: 'todo', label: 'Pendiente', hex: '#FFD60A', textClass: 'text-amber-950' },
    { value: 'in_progress', label: 'En Proceso', hex: '#38BDF8', textClass: 'text-sky-950' },
    { value: 'done', label: 'Terminado', hex: '#4ADE80', textClass: 'text-green-950' },
];

export const KanbanTaskModal: React.FC<KanbanTaskModalProps> = ({ task, onClose, onSave, isNew = false }) => {
    const { t } = useTranslation();
    const [title, setTitle] = useState(task.title || '');
    const [content, setContent] = useState(task.content || '');
    const [status, setStatus] = useState<TaskStatus>(task.status || 'todo');
    const [isSaving, setIsSaving] = useState(false);

    const handleCloseWithConfirmation = () => {
        if (confirm('¿Descartar cambios y cerrar o continuar editando?')) {
            onClose();
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            alert('Por favor, ingresa un título para la tarea.');
            return;
        }
        setIsSaving(true);
        try {
            await onSave({
                title: title.trim(),
                content: content,
                status: status,
                updated_at: new Date().toISOString()
            });
            onClose();
        } catch (error) {
            console.error('Error saving task:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div 
                className="bg-white dark:bg-[#1A1A24] w-full max-w-2xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-[#2D2D42] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-[#2D2D42] bg-zinc-50/50 dark:bg-[#1A1A24]/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-sm shrink-0">
                            <ListTodo size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-800 dark:text-[#CCCCCC]">
                                {isNew ? 'Nueva Tarea' : 'Editar Tarea'}
                            </h2>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-none">Kanban Management</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleCloseWithConfirmation}
                        className="p-2 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-all active:scale-95 border border-transparent hover:border-emerald-500/30"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 hidden-scrollbar">
                    {/* Title Input */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            <Type size={14} /> Título
                        </label>
                        <input 
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Escribe el título de la tarea..."
                            className="w-full bg-zinc-50 dark:bg-[#131314] border border-zinc-200 dark:border-[#2D2D42] p-4 rounded-xl text-zinc-800 dark:text-[#CCCCCC] font-bold text-lg outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
                            autoFocus={isNew}
                            title={title} // Permite ver el título completo en el tooltip si es muy grande
                        />
                    </div>

                    {/* Status Selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            <LayoutDashboard size={14} /> Estado
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {STATUS_OPTIONS.map(opt => (
                                <button 
                                    key={opt.value}
                                    onClick={() => setStatus(opt.value)}
                                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                        status === opt.value 
                                            ? `${opt.textClass} scale-[1.02]` 
                                            : 'bg-white dark:bg-[#131314] border-zinc-200 dark:border-[#2D2D42] text-zinc-500 dark:text-zinc-500 hover:border-emerald-500/40'
                                    }`}
                                    style={status === opt.value ? { 
                                        backgroundColor: opt.hex, 
                                        borderColor: opt.hex,
                                        boxShadow: `0 10px 15px -3px ${opt.hex}33, 0 4px 6px -4px ${opt.hex}33`
                                    } : {}}
                                >
                                    {status === opt.value && <Check size={14} />}
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content Editor */}
                    <div className="space-y-2 flex flex-col min-h-[150px] max-h-[300px]">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            <Check size={14} /> Contenido / Notas
                        </label>
                        <div className="flex-1 rounded-xl border border-zinc-200 dark:border-[#2D2D42] bg-zinc-50 dark:bg-[#131314] overflow-hidden flex flex-col">
                            {/* 
                                🚀 FIX: Contenedor con scroll interno para el editor.
                                El editor puede crecer internamente pero el contenedor mantiene el scroll.
                            */}
                            <div className="flex-1 overflow-y-auto min-h-0 note-editor-scroll">
                                <SmartNotesEditor 
                                    noteId={task.id || 'new-task'}
                                    initialContent={task.content || ''}
                                    onChange={setContent}
                                    readOnly={false}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-6 py-4 border-t border-zinc-100 dark:border-[#2D2D42] flex items-center justify-end gap-3 bg-white dark:bg-[#1A1A24]">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 bg-transparent border border-transparent hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving || !title.trim()}
                        className="px-6 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95 shadow-sm font-bold text-sm"
                    >
                        {isSaving ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Save size={18} />
                        )}
                        {isNew ? 'Crear Tarea' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
};
