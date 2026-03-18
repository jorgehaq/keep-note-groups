import React from 'react';
import { Task, TaskStatus, Group } from '../types';
import { Trash2, ArrowRight, Inbox, Archive, Pencil, PenTool } from 'lucide-react';

interface KanbanListProps {
    view: 'backlog' | 'archive';
    tasks: Task[];
    onUpdate: (id: string, updates: Partial<Task>) => void;
    onDelete: (id: string) => void;
    onEdit: (task: Task) => void; // 🚀 ADDED
    groups?: Group[];
    onOpenNote?: (groupId: string, noteId: string) => void;
}

export const KanbanList: React.FC<KanbanListProps> = ({ view, tasks, onUpdate, onDelete, onEdit, groups, onOpenNote }) => {
    const status: TaskStatus = view === 'backlog' ? 'backlog' : 'archived';
    const filtered = tasks.filter(t => t.status === status).sort((a, b) => a.position - b.position);
    const emptyLabel = view === 'backlog' ? 'No hay tareas en el backlog.' : 'No hay tareas archivadas.';

    return (
        <div className="flex-1 overflow-y-auto hidden-scrollbar py-0 px-0">
            <div className="max-w-5xl mx-auto">
                <div className="bg-zinc-100/50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm transition-colors min-h-[400px]">
                    {filtered.length === 0 ? (
                        <div className="text-center py-24 text-zinc-400">
                            {view === 'backlog' ? <Inbox size={32} className="mx-auto mb-4 opacity-20" /> : <Archive size={32} className="mx-auto mb-4 opacity-20" />}
                            <p>{emptyLabel}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filtered.map(task => (
                                <TaskListItem key={task.id} task={task} view={view} onUpdate={onUpdate} onDelete={onDelete} onEdit={onEdit} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const TaskListItem: React.FC<{
    task: Task;
    view: 'backlog' | 'archive';
    onUpdate: (id: string, updates: Partial<Task>) => void;
    onDelete: (id: string) => void;
    onEdit: (task: Task) => void; // 🚀 ADDED
}> = ({ task, view, onUpdate, onDelete, onEdit }) => {
    const promoteStatus: TaskStatus = 'todo';
    const promoteLabel = view === 'backlog' ? 'Mover a Pendiente' : 'Restaurar a Pendiente';

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 transition-all duration-300 focus-within:ring-2 focus-within:ring-indigo-500/50 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5">
            {/* Header + Title */}
            <div className="p-3.5 pb-2.5">
                <div className="flex items-center gap-2 mb-2">
                    <div 
                        className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-400 uppercase tracking-tighter bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded-md border-l-2"
                        style={{ borderLeftColor: view === 'backlog' ? '#9E9E9E' : '#424242' }}
                    >
                        {view === 'backlog' ? <Inbox size={10} /> : <Archive size={10} />}
                        {view === 'backlog' ? 'Backlog' : 'Archivado'}
                    </div>
                </div>

                <div className="min-w-0" title={task.title}>
                    <h4 className="text-zinc-800 dark:text-[#CCCCCC] text-sm font-bold leading-tight line-clamp-1">
                        {task.title || <span className="text-zinc-400 italic font-normal">Sin título</span>}
                        {task.linked_board_id && (
                            <PenTool size={10} className="inline-block ml-1.5 text-amber-500 mb-0.5" />
                        )}
                    </h4>
                    {task.content && (
                        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-500 line-clamp-2 leading-normal" title={task.content}>
                            {task.content}
                        </p>
                    )}
                </div>
            </div>

            {/* Mini Footer (Permanent & Compact) */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-50/50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800/50 rounded-b-2xl">
                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-tighter">
                    {task.updated_at ? new Date(task.updated_at).toLocaleDateString() : ''}
                </span>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onEdit(task)}
                        className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Editar Tarea"
                    >
                        <Pencil size={15} />
                    </button>
                    {view === 'backlog' && (
                        <button
                            onClick={() => onUpdate(task.id, { status: 'archived' })}
                            className="p-1.5 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                            title="Mover a Archivo"
                        >
                            <Archive size={15} />
                        </button>
                    )}
                    <button
                        onClick={() => onUpdate(task.id, { status: promoteStatus })}
                        className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title={promoteLabel}
                    >
                        <ArrowRight size={15} />
                    </button>
                    <button
                        onClick={() => {
                            if (confirm('¿Eliminar permanentemente?')) onDelete(task.id);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Eliminar"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>
        </div>
    );
};
