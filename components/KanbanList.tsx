import React from 'react';
import { Task, TaskStatus } from '../types';
import { Trash2, ArrowRight, Inbox, Archive } from 'lucide-react';

interface KanbanListProps {
    view: 'backlog' | 'archive';
    tasks: Task[];
    onUpdate: (id: string, updates: Partial<Task>) => void;
    onDelete: (id: string) => void;
}

export const KanbanList: React.FC<KanbanListProps> = ({ view, tasks, onUpdate, onDelete }) => {
    const status: TaskStatus = view === 'backlog' ? 'backlog' : 'archived';
    const filtered = tasks.filter(t => t.status === status).sort((a, b) => a.position - b.position);
    const emptyLabel = view === 'backlog' ? 'No hay tareas en el backlog.' : 'No hay tareas archivadas.';
    const promoteLabel = view === 'backlog' ? 'Mover a Pendiente' : 'Restaurar a Pendiente';
    const promoteStatus: TaskStatus = 'todo';

    return (
        <div className="flex-1 overflow-y-auto hidden-scrollbar p-4 md:p-8 bg-zinc-50 dark:bg-zinc-950">
            <div className="max-w-5xl mx-auto">
                {filtered.length === 0 ? (
                    <div className="text-center py-20 text-zinc-400">
                        {view === 'backlog' ? <Inbox size={32} className="mx-auto mb-4 opacity-20" /> : <Archive size={32} className="mx-auto mb-4 opacity-20" />}
                        <p>{emptyLabel}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map(task => (
                            <div
                                key={task.id}
                                className="group bg-white dark:bg-zinc-900 p-5 rounded-2xl transition-all duration-500 ease-in-out border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-tighter bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                                        {view === 'backlog' ? <Inbox size={10} /> : <Archive size={10} />}
                                        {view === 'backlog' ? 'Backlog' : 'Archivado'}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => onUpdate(task.id, { status: promoteStatus })}
                                            className="p-1.5 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                            title={promoteLabel}
                                        >
                                            <ArrowRight size={16} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (confirm('¿Eliminar esta tarea permanentemente?')) {
                                                    onDelete(task.id);
                                                }
                                            }}
                                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Tarea</p>
                                        <p className="text-zinc-800 dark:text-zinc-100 font-medium leading-tight">{task.title}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
