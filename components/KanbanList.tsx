import React from 'react';
import { Task, TaskStatus } from '../types';
import { Trash2, ArrowRight } from 'lucide-react';

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
    const promoteLabel = view === 'backlog' ? 'Mover a Todo' : 'Restaurar a Todo';
    const promoteStatus: TaskStatus = 'todo';

    return (
        <div className="flex-1 overflow-y-auto hidden-scrollbar p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                {filtered.length === 0 ? (
                    <div className="text-center py-20 text-zinc-400 text-sm">{emptyLabel}</div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {filtered.map(task => (
                            <div
                                key={task.id}
                                className="flex items-center gap-3 bg-white dark:bg-zinc-800 rounded-lg px-4 py-3 shadow-sm border border-zinc-200 dark:border-zinc-700 group hover:shadow-md transition-shadow"
                            >
                                <p className="flex-1 text-sm text-zinc-800 dark:text-zinc-200">{task.title}</p>
                                <button
                                    onClick={() => onUpdate(task.id, { status: promoteStatus })}
                                    className="p-1.5 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title={promoteLabel}
                                >
                                    <ArrowRight size={14} />
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm('¿Eliminar esta tarea permanentemente?')) {
                                            onDelete(task.id);
                                        }
                                    }}
                                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="Eliminar"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
