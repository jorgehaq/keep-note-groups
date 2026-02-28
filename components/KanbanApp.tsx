import React, { useState, useEffect } from 'react';
import { Plus, KanbanSquare, Archive, Inbox, LayoutDashboard } from 'lucide-react';
import { Task, TaskStatus, Group } from '../types';
import { supabase } from '../src/lib/supabaseClient';
import { KanbanBoard } from './KanbanBoard';
import { KanbanList } from './KanbanList';
import { useUIStore } from '../src/lib/store';

type KanbanTab = 'board' | 'backlog' | 'archive';

const TABS: { key: KanbanTab; label: string; icon: React.ReactNode }[] = [
    { key: 'board', label: 'Tablero', icon: <LayoutDashboard size={16} /> },
    { key: 'backlog', label: 'Backlog', icon: <Inbox size={16} /> },
    { key: 'archive', label: 'Archivo', icon: <Archive size={16} /> },
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
                .order('created_at', { ascending: false });

            if (!error && data) {
                setTasks(data as Task[]);
                
                // Actualizar store (solo counts globales si es necesario)
                const active = data.filter(t => t.status !== 'backlog' && t.status !== 'archived').length;
                const backlog = data.filter(t => t.status === 'backlog').length;
                setKanbanCounts(active, backlog);
            }
            setLoading(false);
        };
        fetchTasks();
    }, [setKanbanCounts]);

    // --- HANDLERS (FUNCIONALIDAD INTACTA) ---
    const handleAdd = async () => {
        const user = (await supabase.auth.getUser()).data.user;
        const newTask: Partial<Task> = {
            title: '',
            content: '',
            status: activeTab === 'backlog' ? 'backlog' : 'todo',
            user_id: user?.id
        };

        const { data, error } = await supabase.from('tasks').insert([newTask]).select().single();
        if (!error && data) {
            setTasks(prev => [data as Task, ...prev]);
            
            // Re-calc
            const allTasks = [data as Task, ...tasks];
            const active = allTasks.filter(t => t.status !== 'backlog' && t.status !== 'archived').length;
            const backlog = allTasks.filter(t => t.status === 'backlog').length;
            setKanbanCounts(active, backlog);
        }
    };

    const updateTask = async (id: string, updates: Partial<Task>) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t));
        
        // Re-calc counts inmediatamente para UI fluida
        setTasks(prev => {
            const active = prev.filter(t => t.status !== 'backlog' && t.status !== 'archived').length;
            const backlog = prev.filter(t => t.status === 'backlog').length;
            setKanbanCounts(active, backlog);
            return prev;
        });

        await supabase.from('tasks').update(updates).eq('id', id);
    };

    const deleteTask = async (id: string) => {
        setTasks(prev => {
            const next = prev.filter(t => t.id !== id);
            const active = next.filter(t => t.status !== 'backlog' && t.status !== 'archived').length;
            const backlog = next.filter(t => t.status === 'backlog').length;
            setKanbanCounts(active, backlog);
            return next;
        });
        await supabase.from('tasks').delete().eq('id', id);
    };

    if (loading) {
        return <div className="p-10 text-center animate-pulse text-zinc-500">Cargando Kanban...</div>;
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
            
            {/* 🚀 FIX: HEADER UNIFICADO (Estilo Enterprise Mental Space) */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
                <div className="flex items-center justify-between px-4 md:px-6 py-4">
                    <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-3">
                        <div className="p-2 bg-[#10B981] rounded-lg text-white shadow-lg shadow-emerald-500/20 shrink-0">
                            <KanbanSquare size={20} />
                        </div>
                        Kanban
                    </h1>
                    <button 
                        onClick={handleAdd} 
                        className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 md:px-5 md:py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0"
                    >
                        <Plus size={18} /> 
                        <span className="text-sm font-bold hidden sm:inline pr-1">Nueva Tarea</span>
                    </button>
                </div>
            </div>

            {/* CONTENIDO PRINCIPAL */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 hidden-scrollbar flex flex-col">
                <div className="w-full flex flex-col h-full max-w-[1400px] mx-auto">
                    
                    {/* 🚀 FIX: TABS ESTILO SEGMENTED CONTROL (Idéntico a Settings) */}
                    <div className="flex bg-zinc-200/50 dark:bg-zinc-900/50 p-1 rounded-xl w-full sm:w-auto mb-6 shrink-0 self-start border border-zinc-200/50 dark:border-zinc-800">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold rounded-lg transition-all ${
                                    activeTab === tab.key
                                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                                }`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* VISTAS FUNCIONALES INTACTAS */}
                    <div className="flex-1 flex flex-col min-h-0 animate-fadeIn">
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
                    
                </div>
            </div>
        </div>
    );
};