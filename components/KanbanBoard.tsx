import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Task, TaskStatus, Group } from '../types';
import { useTranslation } from 'react-i18next';
import { Archive, Trash2, GripVertical, StickyNote, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient';
import { KanbanLinkerModal } from './KanbanLinkerModal';

interface KanbanBoardProps {
    tasks: Task[];
    groups?: Group[];
    onOpenNote?: (groupId: string, noteId: string) => void;
    onUpdate: (id: string, updates: Partial<Task>) => void;
    onDelete: (id: string) => void;
    dateFormat?: string;
    timeFormat?: string;
}

const COLUMNS: { status: TaskStatus; label: string; accent: string }[] = [
    { status: 'todo', label: 'Pendiente', accent: 'bg-[#3282F6]' },
    { status: 'in_progress', label: 'En Proceso', accent: 'bg-[#F08650]' },
    { status: 'done', label: 'Terminado', accent: 'bg-[#75FA61]' },
];

const formatCustomDate = (isoString: string, dateFormat: string, timeFormat: string): string => {
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const datePart = dateFormat === 'mm/dd/yyyy' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    let ampm = '';
    if (timeFormat === '12h') {
        ampm = hours >= 12 ? ' PM' : ' AM';
        hours = hours % 12 || 12;
    }
    return `${datePart}, ${hours.toString().padStart(2, '0')}:${minutes}${ampm}`;
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, groups = [], onOpenNote, onUpdate, onDelete, dateFormat = 'dd/mm/yyyy', timeFormat = '12h' }) => {
    const { t } = useTranslation();
    const getColumnTasks = (status: TaskStatus) =>
        tasks.filter(t => t.status === status).sort((a, b) => a.position - b.position);

    const handleDragEnd = (result: DropResult) => {
        const { source, destination, draggableId } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        const sourceStatus = source.droppableId as TaskStatus;
        const destStatus = destination.droppableId as TaskStatus;

        if (sourceStatus === destStatus) {
            // Reorder within same column
            const colTasks = [...getColumnTasks(sourceStatus)];
            const [moved] = colTasks.splice(source.index, 1);
            colTasks.splice(destination.index, 0, moved);

            // Update positions for all affected items
            colTasks.forEach((task, idx) => {
                if (task.position !== idx) {
                    onUpdate(task.id, { position: idx });
                }
            });
        } else {
            // Move to different column
            const sourceTasks = [...getColumnTasks(sourceStatus)];
            const destTasks = [...getColumnTasks(destStatus)];

            const [moved] = sourceTasks.splice(source.index, 1);
            destTasks.splice(destination.index, 0, { ...moved, status: destStatus });

            // Update moved task's status and position
            onUpdate(draggableId, { status: destStatus, position: destination.index });

            // Reindex source column
            sourceTasks.forEach((task, idx) => {
                if (task.position !== idx) {
                    onUpdate(task.id, { position: idx });
                }
            });

            // Reindex destination column (skip the moved task, already updated)
            destTasks.forEach((task, idx) => {
                if (task.id !== draggableId && task.position !== idx) {
                    onUpdate(task.id, { position: idx });
                }
            });
        }
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex-1 flex gap-4 p-4 md:p-6 overflow-x-auto overflow-y-hidden hidden-scrollbar snap-x snap-mandatory sm:snap-none">
                {COLUMNS.map(col => {
                    const colTasks = getColumnTasks(col.status);
                    return (
                        <div key={col.status} className="w-[85vw] shrink-0 sm:w-auto sm:shrink sm:flex-1 min-w-[260px] max-w-[400px] flex flex-col snap-center">
                            {/* Column Header */}
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <div className={`w-2 h-2 rounded-full ${col.accent}`}></div>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                    {col.label}
                                </h3>
                                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full ml-auto">
                                    {colTasks.length}
                                </span>
                            </div>

                            {/* Droppable Column */}
                            <Droppable droppableId={col.status}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`flex-1 flex flex-col gap-2 rounded-xl p-2 min-h-[200px] transition-colors border ${snapshot.isDraggingOver
                                            ? 'bg-zinc-200/70 dark:bg-zinc-700/40 ring-2 ring-zinc-300 dark:ring-zinc-600 ring-dashed border-zinc-300 dark:border-zinc-600'
                                            : 'bg-zinc-100/50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-800'
                                            }`}
                                    >
                                        {colTasks.map((task, index) => (
                                            <Draggable key={task.id} draggableId={task.id} index={index}>
                                                {(provided, snapshot) => (
                                                        <TaskCard
                                                            task={task}
                                                            provided={provided}
                                                            isDragging={snapshot.isDragging}
                                                            columnStatus={col.status}
                                                            onUpdate={onUpdate}
                                                            onDelete={onDelete}
                                                            groups={groups}
                                                            onOpenNote={onOpenNote}
                                                            dateFormat={dateFormat}
                                                            timeFormat={timeFormat}
                                                        />
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                        {colTasks.length === 0 && !snapshot.isDraggingOver && (
                                            <div className="text-center py-8 text-zinc-400 text-xs select-none">
                                                Arrastra tareas aquí
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    );
                })}
            </div>
        </DragDropContext>
    );
};

// --- Task Card Sub-component ---
interface TaskCardProps {
    task: Task;
    provided: any;
    isDragging: boolean;
    columnStatus: TaskStatus;
    onUpdate: (id: string, updates: Partial<Task>) => void;
    onDelete: (id: string) => void;
    groups?: Group[];
    onOpenNote?: (groupId: string, noteId: string) => void;
    dateFormat?: string;
    timeFormat?: string;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, provided, isDragging, columnStatus, onUpdate, onDelete, groups = [], onOpenNote, dateFormat = 'dd/mm/yyyy', timeFormat = '12h' }) => {
    const [isEditing, setIsEditing] = useState(() => task.title.trim() === '');
    const [tempTitle, setTempTitle] = useState(task.title);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

    const linkedNote = React.useMemo(() => {
        for (const g of groups) {
            const n = g.notes.find(note => note.id === task.id);
            if (n) return { ...n, groupId: g.id };
        }
        return null;
    }, [groups, task.id]);

    const handleSave = () => {
        if (tempTitle.trim() && tempTitle !== task.title) {
            onUpdate(task.id, { title: tempTitle.trim() });
        } else {
            setTempTitle(task.title);
        }
        setIsEditing(false);
    };

    return (
        <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={`group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 transition-all duration-300 mb-3 focus-within:ring-2 focus-within:ring-indigo-500/50 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 ${isDragging
                ? 'shadow-2xl border-indigo-500/50 ring-2 ring-indigo-500/30 scale-[1.02] rotate-1'
                : ''
                }`}
        >
            <div className="flex items-start gap-2 p-4">
                {/* Drag Handle */}
                <div
                    {...provided.dragHandleProps}
                    className="pt-0.5 text-zinc-300 dark:text-zinc-600 hover:text-indigo-500 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
                >
                    <GripVertical size={14} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <input
                            type="text"
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            onBlur={handleSave}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave();
                                if (e.key === 'Escape') {
                                    setTempTitle(task.title);
                                    setIsEditing(false);
                                }
                            }}
                            autoFocus
                            className="w-full text-zinc-800 dark:text-zinc-100 font-medium leading-tight bg-transparent outline-none placeholder-zinc-400"
                            placeholder="Nueva tarea..."
                        />
                    ) : (
                        <input
                            type="text"
                            value={task.title}
                            onFocus={() => {
                                setTempTitle(task.title);
                                setIsEditing(true);
                            }}
                            readOnly
                            className="w-full text-zinc-800 dark:text-zinc-100 font-medium leading-tight bg-transparent outline-none cursor-text placeholder-zinc-400"
                            placeholder="Nueva tarea..."
                        />
                    )}
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter mt-2 block">
                        {task.updated_at ? formatCustomDate(task.updated_at, dateFormat, timeFormat) : ''}
                    </span>
                </div>

                {/* Actions (hover reveal) */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex-col">
                    {linkedNote ? (
                        <button
                            onClick={() => onOpenNote?.(linkedNote.groupId, linkedNote.id)}
                            className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Abrir Nota Asociada"
                        >
                            <StickyNote size={14} />
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsLinkModalOpen(true)}
                            className="p-1.5 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                            title="Convertir en Nota"
                        >
                            <LinkIcon size={14} />
                        </button>
                    )}
                    {columnStatus === 'done' && (
                        <button
                            onClick={() => onUpdate(task.id, { status: 'archived' })}
                            className="p-1.5 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                            title="Archivar"
                        >
                            <Archive size={14} />
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (confirm('¿Eliminar esta tarea?')) onDelete(task.id);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Eliminar"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {isLinkModalOpen && (
                <KanbanLinkerModal 
                    task={task} 
                    groups={groups}
                    onClose={() => setIsLinkModalOpen(false)}
                    onSuccess={(groupId, noteId) => {
                        setIsLinkModalOpen(false);
                        onOpenNote?.(groupId, noteId);
                    }}
                />
            )}
        </div>
    );
};
