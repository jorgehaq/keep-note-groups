import React, { useState, useEffect } from 'react';
import { Plus, KanbanSquare, Archive, Inbox } from 'lucide-react';
import { Task, TaskStatus, Group } from '../types';
import { supabase } from '../src/lib/supabaseClient';
import { KanbanBoard } from './KanbanBoard';
import { KanbanList } from './KanbanList';
import { useUIStore } from '../src/lib/store';

type KanbanTab = 'board' | 'backlog' | 'archive';

const TABS: { key: KanbanTab; label: string; icon: React.ReactNode }[] = [
    { key: 'board', label: 'Tablero', icon: <KanbanSquare size={14} /> },
    { key: 'backlog', label: 'Backlog', icon: <Inbox size={14} /> },
    { key: 'archive', label: 'Archivo', icon: <Archive size={14} /> },
];

interface KanbanAppProps {
    groups?: Group[];
    onOpenNote?: (groupId: string, noteId: string) => void;
}

export const KanbanApp: React.FC<KanbanAppProps> = ({ groups = [], onOpenNote }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<KanbanTab>('board');

    // --- STORE ---
    const { setKanbanCounts } = useUIStore();

    // --- FETCH ---
    useEffect(() => {
        const fetchTasks = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .order('position', { ascending: true });

            if (error) {
                console.error('Error fetching tasks:', error);
            } else {
                setTasks(data || []);
            }
            setLoading(false);
        };

        fetchTasks();
        window.addEventListener('kanban-refetch', fetchTasks);
        return () => window.removeEventListener('kanban-refetch', fetchTasks);
    }, []);

    // --- SYNC ---
    useEffect(() => {
        const counts = {
            todo: tasks.filter(t => t.status === 'todo').length,
            in_progress: tasks.filter(t => t.status === 'in_progress').length,
            done: tasks.filter(t => t.status === 'done').length,
        };
        setKanbanCounts(counts.todo, counts.in_progress, counts.done);
    }, [tasks, setKanbanCounts]);

    // --- CRUD ---
    const addTask = async (title: string, status: TaskStatus) => {
        const maxPos = tasks
            .filter(t => t.status === status)
            .reduce((max, t) => Math.max(max, t.position), -1);

        const { data, error } = await supabase
            .from('tasks')
            .insert({ title, status, position: maxPos + 1 })
            .select()
            .single();

        if (error) {
            console.error('Error adding task:', error);
            return;
        }
        if (data) {
            setTasks(prev => [...prev, data]);
            window.dispatchEvent(new CustomEvent('kanban-updated'));
        }
    };

    const updateTask = async (id: string, updates: Partial<Task>) => {
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

        const { error } = await supabase
            .from('tasks')
            .update(updates)
            .eq('id', id);

        if (!error) {
            window.dispatchEvent(new CustomEvent('kanban-updated'));
            
            // Sincronización dual hacia Notas
            if (updates.title !== undefined) {
                await supabase.from('notes')
                    .update({ title: updates.title })
                    .eq('id', id);
                
                window.dispatchEvent(new CustomEvent('reload-app-data'));
            }
        }

        if (error) {
            console.error('Error updating task:', error);
            // Revert on error — re-fetch
            const { data } = await supabase.from('tasks').select('*').order('position', { ascending: true });
            if (data) setTasks(data);
        }
    };

    const deleteTask = async (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));

        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', id);

        if (!error) window.dispatchEvent(new CustomEvent('kanban-updated'));

        if (error) {
            console.error('Error deleting task:', error);
        }
    };

    // --- ADD HANDLER ---
    const handleAdd = () => {
        const title = prompt('Título de la nueva tarea:');
        if (!title?.trim()) return;
        const status: TaskStatus = activeTab === 'backlog' ? 'backlog' : 'todo';
        addTask(title.trim(), status);
    };

    // --- RENDER ---
    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center text-zinc-400">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
                <div className="flex items-center justify-between px-4 md:px-6 h-14">
                    {/* Left: Title */}
                    <h1 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">
                        Kanban
                    </h1>

                    {/* Center: Tabs */}
                    <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === tab.key
                                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Right: Add */}
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1F3760] hover:bg-[#152643] text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
                        title="Nueva Tarea"
                    >
                        <Plus size={14} />
                        <span className="hidden md:inline">Nueva Tarea</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            {activeTab === 'board' && (
                <KanbanBoard tasks={tasks} groups={groups} onOpenNote={onOpenNote} onUpdate={updateTask} onDelete={deleteTask} />
            )}
            {activeTab === 'backlog' && (
                <KanbanList view="backlog" tasks={tasks} groups={groups} onOpenNote={onOpenNote} onUpdate={updateTask} onDelete={deleteTask} />
            )}
            {activeTab === 'archive' && (
                <KanbanList view="archive" tasks={tasks} groups={groups} onOpenNote={onOpenNote} onUpdate={updateTask} onDelete={deleteTask} />
            )}
        </div>
    );
};
