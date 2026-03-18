import React, { useState, useEffect } from 'react';
import { Plus, KanbanSquare, Archive, Inbox, LayoutDashboard, Bell } from 'lucide-react';
import { Task, TaskStatus, Group } from '../types';
import { supabase } from '../src/lib/supabaseClient';
import { KanbanBoard } from './KanbanBoard';
import { KanbanList } from './KanbanList';
import { KanbanTaskModal } from './KanbanTaskModal';
import { useUIStore } from '../src/lib/store';
import { useTranslation } from 'react-i18next';

type KanbanTab = 'board' | 'backlog' | 'archive';

const TABS: { key: KanbanTab; labelKey: string; icon: React.ReactNode }[] = [
    { key: 'board', labelKey: 'kanban.board', icon: <LayoutDashboard size={16} /> },
    { key: 'backlog', labelKey: 'kanban.backlog', icon: <Inbox size={16} /> },
    { key: 'archive', labelKey: 'kanban.archive', icon: <Archive size={16} /> },
];

interface KanbanAppProps {
    groups?: Group[];
    onOpenNote?: (groupId: string, noteId: string) => void;
    dateFormat?: string;
    timeFormat?: string;
}

export const KanbanApp: React.FC<KanbanAppProps> = ({ groups = [], onOpenNote, dateFormat = 'dd/mm/yyyy', timeFormat = '12h' }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<KanbanTab>('board');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
    const { t } = useTranslation();

    // --- STORE ---
    const { setKanbanCounts, showOverdueMarquee, setShowOverdueMarquee, overdueRemindersCount } = useUIStore();

    // --- FETCH ---
    useEffect(() => {
        const fetchTasks = async (isFirstLoad = false) => {
            if (isFirstLoad) setLoading(true);
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data) {
                setTasks(data as Task[]);
                
                // Actualizar store (solo counts globales si es necesario)
                const todo = data.filter(t => t.status === 'todo').length;
                const inProgress = data.filter(t => t.status === 'in_progress').length;
                const done = data.filter(t => t.status === 'done').length;
                setKanbanCounts(todo, inProgress, done);
            }
            if (isFirstLoad) setLoading(false);
        };
        fetchTasks(true);
        const handleUpdate = () => fetchTasks(false);
        window.addEventListener('kanban-updated', handleUpdate);
        return () => window.removeEventListener('kanban-updated', handleUpdate);
    }, [setKanbanCounts]);

    // --- COUNTS ---
    const backlogCount = tasks.filter(t => t.status === 'backlog').length;
    const todoCount = tasks.filter(t => t.status === 'todo').length;
    const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
    const archivedCount = tasks.filter(t => t.status === 'archived').length;

    // --- HANDLERS (FUNCIONALIDAD INTACTA) ---
    const handleAdd = async () => {
        const targetStatus = activeTab === 'backlog' ? 'backlog' : 'todo';
        setEditingTask({
            title: '',
            content: '',
            status: targetStatus,
        });
        setIsModalOpen(true);
    };

    const handleSaveNewTask = async (updates: Partial<Task>) => {
        const user = (await supabase.auth.getUser()).data.user;
        const targetStatus = updates.status || (activeTab === 'backlog' ? 'backlog' : 'todo');
        const position = tasks.filter(t => t.status === targetStatus).length * 1024;
        
        const newTask: Partial<Task> = {
            ...updates,
            position: position,
            user_id: user?.id
        };

        const { data, error } = await supabase.from('tasks').insert([newTask]).select().single();
        if (!error && data) {
            setTasks(prev => [data as Task, ...prev]);
            
            // Re-calc counts
            const allTasks = [data as Task, ...tasks];
            const todo = allTasks.filter(t => t.status === 'todo').length;
            const inProgress = allTasks.filter(t => t.status === 'in_progress').length;
            const done = allTasks.filter(t => t.status === 'done').length;
            setKanbanCounts(todo, inProgress, done);
            window.dispatchEvent(new CustomEvent('kanban-updated'));
        }
    };

    const updateTask = async (id: string, updates: Partial<Task>) => {
        // Re-calc counts inmediatamente para UI fluida
        setTasks(prev => {
            const next = prev.map(t => t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t);
            const todo = next.filter(t => t.status === 'todo').length;
            const inProgress = next.filter(t => t.status === 'in_progress').length;
            const done = next.filter(t => t.status === 'done').length;
            setKanbanCounts(todo, inProgress, done);
            return next;
        });

        await supabase.from('tasks').update(updates).eq('id', id);
        window.dispatchEvent(new CustomEvent('kanban-updated'));
    };

    const deleteTask = async (id: string) => {
        setTasks(prev => {
            const next = prev.filter(t => t.id !== id);
            const todo = next.filter(t => t.status === 'todo').length;
            const inProgress = next.filter(t => t.status === 'in_progress').length;
            const done = next.filter(t => t.status === 'done').length;
            setKanbanCounts(todo, inProgress, done);
            return next;
        });
        await supabase.from('tasks').delete().eq('id', id);
        window.dispatchEvent(new CustomEvent('kanban-updated'));
    };

    if (loading) {
        return <div className="p-10 text-center animate-pulse text-zinc-500">{t('kanban.loading')}</div>;
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-[#13131A] overflow-hidden">
            
            {/* 🚀 FIX: HEADER UNIFICADO (Estilo Enterprise Mental Space) */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#1A1A24]/90 backdrop-blur-md border-b border-zinc-200 dark:border-[#2D2D42] shadow-sm shrink-0">
                <div className="h-[72px] flex items-center justify-between px-4 md:px-6 py-4">
                    <h1 className="text-xl font-bold text-zinc-800 dark:text-[#CCCCCC] flex items-center gap-3">
                        <div className="h-9 p-2 bg-[#10B981] rounded-lg text-emerald-950 shadow-lg shadow-emerald-500/20 shrink-0">
                            <KanbanSquare size={20} />
                        </div>
                        Kanban
                    </h1>

                    <div className="flex items-center gap-3">
                        {/* Botón Toggle Reminder (siempre primero de izquierda a derecha) */}
                        <button
                          onClick={() => setShowOverdueMarquee(!showOverdueMarquee)}
                          className={`h-9 p-2 rounded-xl transition-all active:scale-95 shrink-0 flex items-center gap-2 border ${
                            showOverdueMarquee 
                              ? 'bg-[#DC2626] border-red-600 text-white shadow-md shadow-red-600/20' 
                              : overdueRemindersCount > 0
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40'
                                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600'
                          }`}
                          title={showOverdueMarquee ? "Ocultar Recordatorios" : "Mostrar Recordatorios"}
                        >
                          <Bell size={18} className={overdueRemindersCount > 0 ? 'animate-pulse' : ''} />
                          <span className="text-xs font-bold">{overdueRemindersCount}</span>
                        </button>

                        {/* TABS EN EL HEADER */}
                        <div className="h-9 hidden md:flex bg-white dark:bg-[#1A1A24] p-1 rounded-xl border border-zinc-200 dark:border-[#2D2D42] shadow-sm shrink-0">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex items-center justify-center gap-2 px-4 py-1.5 text-[11px] font-medium rounded-lg transition-all ${
                                        activeTab === tab.key
                                            ? 'max-h-[26px] bg-white dark:bg-[#2D2D42] text-zinc-900 dark:text-[#CCCCCC] shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                                    }`}
                                >
                                    {tab.icon}
                                    <span className="hidden lg:inline">{t(tab.labelKey)}</span>
                                    <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold transition-colors ${
                                        activeTab === tab.key ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-100 dark:bg-white/5 text-zinc-400'
                                    }`}>
                                        {tab.key === 'board' ? todoCount + inProgressCount : tab.key === 'backlog' ? backlogCount : archivedCount}
                                    </span>
                                </button>
                            ))}
                        </div>


                        {/* Botón Nueva Tarea */}
                        <button 
                            onClick={handleAdd} 
                            className="h-9 bg-[#10B981] hover:bg-emerald-600 text-emerald-950 px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0"
                        >
                            <Plus size={18} /> 
                            <span className="text-sm font-medium hidden sm:inline pr-1">{t('kanban.new_task')}</span>
                        </button>
                    </div>
                </div>

                {/* Mobile Tabs (Sub-header) */}
                <div className="flex md:hidden px-4 pb-3">
                    <div className="flex bg-white dark:bg-[#1A1A24] p-1 rounded-xl w-full border border-zinc-200 dark:border-[#2D2D42] shadow-sm">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-[11px] font-medium rounded-lg transition-all ${
                                    activeTab === tab.key
                                        ? 'bg-white dark:bg-[#2D2D42] text-zinc-900 dark:text-[#CCCCCC] shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                                }`}
                            >
                                {tab.icon}
                                <span>{t(tab.labelKey)}</span>
                                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                                    activeTab === tab.key ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-100 dark:bg-white/5 text-zinc-400'
                                }`}>
                                    {tab.key === 'board' ? todoCount + inProgressCount : tab.key === 'backlog' ? backlogCount : archivedCount}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* CONTENIDO PRINCIPAL */}
            <div className="flex-1 overflow-y-auto p-4 hidden-scrollbar flex flex-col">
                <div className="w-full flex flex-col h-full max-w-[1400px] mx-auto">

                    {/* VISTAS FUNCIONALES INTACTAS */}
                    <div className="flex-1 flex flex-col min-h-0 animate-fadeIn">
                        {activeTab === 'board' && (
                            <KanbanBoard tasks={tasks} groups={groups} onOpenNote={onOpenNote} onUpdate={updateTask} onDelete={deleteTask} onEdit={(task) => { setEditingTask(task); setIsModalOpen(true); }} dateFormat={dateFormat} timeFormat={timeFormat} />
                        )}
                        {activeTab === 'backlog' && (
                            <KanbanList view="backlog" tasks={tasks} groups={groups} onOpenNote={onOpenNote} onUpdate={updateTask} onDelete={deleteTask} onEdit={(task) => { setEditingTask(task); setIsModalOpen(true); }} />
                        )}
                        {activeTab === 'archive' && (
                            <KanbanList view="archive" tasks={tasks} groups={groups} onOpenNote={onOpenNote} onUpdate={updateTask} onDelete={deleteTask} onEdit={(task) => { setEditingTask(task); setIsModalOpen(true); }} />
                        )}
                    </div>
                    
                </div>
            </div>

            {isModalOpen && editingTask && (
                <KanbanTaskModal 
                    task={editingTask}
                    isNew={!editingTask.id}
                    onClose={() => {
                        setIsModalOpen(false);
                        setEditingTask(null);
                    }}
                    onSave={async (updates) => {
                        if (editingTask.id) {
                            await updateTask(editingTask.id, updates);
                        } else {
                            await handleSaveNewTask(updates);
                        }
                    }}
                />
            )}
        </div>
    );
};