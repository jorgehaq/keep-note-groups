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
    const [activeStatus, setActiveStatus] = useState<TaskStatus>('todo');
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
    const doneCount = tasks.filter(t => t.status === 'done').length;
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
        
        // Sync título hacia la nota o pizarrón vinculado
        if (updates.title !== undefined) {
            const task = tasks.find(t => t.id === id);
            const noteId = task?.linked_note_id || id;
            const boardId = task?.linked_board_id || id;
            const tiktokId = task?.linked_tiktok_id || id;
            // Actualización segura (si no existe el ID en la tabla, no hace nada)
            await supabase.from('notes').update({ title: updates.title }).eq('id', noteId);
            await supabase.from('brain_dumps').update({ title: updates.title }).eq('id', boardId);
            await supabase.from('tiktok_videos').update({ title: updates.title }).eq('id', tiktokId);
        }
 
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
            <div className="sticky top-0 z-30 bg-zinc-50/90 dark:bg-[#13131A]/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/50 shrink-0">
                <div className="max-w-6xl mx-auto flex flex-row items-center justify-center md:justify-between px-6 py-4 gap-4">
                    <h1 className="hidden md:flex text-xl font-bold text-zinc-900 dark:text-white items-center gap-3">
                        <div className="h-9 p-2 bg-[#10B981] rounded-lg text-emerald-950 shadow-lg shadow-[#10B981]/20 shrink-0">
                            <KanbanSquare size={20} />
                        </div>
                        <span className="truncate">Kanban</span>
                    </h1>

                    <div className="flex items-center justify-center gap-2 sm:gap-3 shrink-0">
                        {/* TABS EN EL HEADER (Mobile & Desktop) */}
                        <div className="h-9 flex bg-zinc-200 dark:bg-zinc-900/50 p-1 rounded-xl border border-zinc-300 dark:border-zinc-800 shadow-sm shrink-0 items-center mr-0 sm:mr-2">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                                        activeTab === tab.key
                                            ? 'bg-[#10B981] text-emerald-950 shadow-sm'
                                            : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800'
                                    }`}
                                >
                                    <span className="shrink-0 scale-90 sm:scale-100">{tab.icon}</span>
                                    <span className="hidden sm:inline">{t(tab.labelKey)}</span>
                                    <span className={`px-1 py-0.5 rounded-md text-[8px] font-bold transition-colors ${
                                        activeTab === tab.key ? 'bg-emerald-400/20 text-emerald-900' : 'bg-zinc-300 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-500'
                                    }`}>
                                        {tab.key === 'board' ? todoCount + inProgressCount : tab.key === 'backlog' ? backlogCount : archivedCount}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Botón Toggle Reminder */}
                        <button
                          onClick={() => overdueRemindersCount > 0 && setShowOverdueMarquee(!showOverdueMarquee)}
                          disabled={overdueRemindersCount === 0}
                          className={`hidden md:flex h-9 px-3 rounded-xl transition-all active:scale-[0.98] shrink-0 items-center gap-2 border ${
                            showOverdueMarquee 
                              ? 'bg-[#DC2626] border-red-400 text-white shadow-sm shadow-red-600/20' 
                              : overdueRemindersCount > 0
                                ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20'
                                : 'bg-zinc-200 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 opacity-60 cursor-not-allowed'
                          }`}
                          title={overdueRemindersCount === 0 ? "No hay recordatorios vencidos" : showOverdueMarquee ? "Ocultar Recordatorios" : "Mostrar Recordatorios"}
                        >
                          <Bell size={18} className={overdueRemindersCount > 0 ? `animate-pulse ${showOverdueMarquee ? 'text-white' : 'text-red-500'}` : ''} />
                          {overdueRemindersCount > 0 && (
                            <span className={`text-xs font-bold whitespace-nowrap ${showOverdueMarquee ? 'text-white' : ''}`}>
                              {overdueRemindersCount}
                            </span>
                          )}
                        </button>
                        
                        <button onClick={handleAdd} className="h-9 w-9 bg-[#10B981] hover:bg-emerald-600 text-emerald-950 rounded-full shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center active:scale-95 shrink-0 border border-emerald-400/30 font-bold" title="Nueva tarea">
                            <Plus size={20} />
                        </button>
                    </div>
                </div>

                {/* Removed redundant Mobile Tabs block - now integrated in header */}

                {/* Status Switch for Mobile (Column Navigation) */}
                {activeTab === 'board' && (
                    <div className="flex lg:hidden px-6 pt-1 pb-3 justify-center">
                        <div className="flex bg-zinc-200 dark:bg-zinc-900/50 p-1 rounded-xl w-full max-w-[280px] border border-zinc-300 dark:border-zinc-800 shadow-sm gap-1">
                            {[
                                { status: 'todo', color: 'bg-[#FFD60A]', count: todoCount },
                                { status: 'in_progress', color: 'bg-[#38BDF8]', count: inProgressCount },
                                { status: 'done', color: 'bg-[#4ADE80]', count: doneCount }
                            ].map((col) => (
                                <button
                                    key={col.status}
                                    onClick={() => setActiveStatus(col.status as TaskStatus)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg transition-all ${
                                        activeStatus === col.status
                                            ? 'bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700'
                                            : 'hover:bg-zinc-300 dark:hover:bg-zinc-800/50'
                                    }`}
                                >
                                    <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                                    <span className={`text-[10px] font-bold ${activeStatus === col.status ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>
                                        {col.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* CONTENIDO PRINCIPAL */}
            <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#13131A] hidden-scrollbar flex flex-col">
                <div className="w-full flex-1 flex flex-col h-full max-w-[1400px] mx-auto">
                    {/* VISTAS FUNCIONALES INTACTAS */}
                    <div className="flex-1 flex flex-col min-h-0 animate-fadeIn">
                        {activeTab === 'board' && (
                            <KanbanBoard tasks={tasks} groups={groups} onOpenNote={onOpenNote} onUpdate={updateTask} onDelete={deleteTask} onEdit={(task) => { setEditingTask(task); setIsModalOpen(true); }} dateFormat={dateFormat} timeFormat={timeFormat} activeStatus={activeStatus} />
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