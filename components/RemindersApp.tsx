import React, { useState, useEffect } from 'react';
import { Plus, Bell, Check, Trash2, Clock, X, Circle, CheckCircle2, AlertCircle } from 'lucide-react';
import { Reminder } from '../types';
import { supabase } from '../src/lib/supabaseClient';
import { useUIStore } from '../src/lib/store';
import { Session } from '@supabase/supabase-js';

interface RemindersAppProps {
    session: Session;
}

const formatDueDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const isPast = diffMs < 0;
    const absDiffMin = Math.abs(Math.floor(diffMs / 60000));

    let relative = '';
    if (absDiffMin < 1) relative = 'ahora';
    else if (absDiffMin < 60) relative = `${absDiffMin}m`;
    else if (absDiffMin < 1440) relative = `${Math.floor(absDiffMin / 60)}h`;
    else relative = `${Math.floor(absDiffMin / 1440)}d`;

    const formatted = new Intl.DateTimeFormat('es-ES', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);

    return isPast ? `Hace ${relative} · ${formatted}` : `En ${relative} · ${formatted}`;
};

export const RemindersApp: React.FC<RemindersAppProps> = ({ session }) => {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);
    const { setOverdueRemindersCount, setImminentRemindersCount } = useUIStore();

    // --- Form states ---
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newNote, setNewNote] = useState('');
    const [newDueDate, setNewDueDate] = useState('');

    // --- Edit states ---
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

    // --- Fetch (all reminders, limit 100) ---
    useEffect(() => {
        const fetchReminders = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('reminders')
                .select('*')
                .order('due_at', { ascending: true })
                .limit(100);

            if (error) {
                console.error('Error fetching reminders:', error);
            } else {
                setReminders(data || []);
            }
            setLoading(false);
        };

        fetchReminders();
    }, []);

    // --- SYNC ---
    useEffect(() => {
        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const overdueCount = reminders.filter(r => !r.is_completed && new Date(r.due_at) <= now).length;
        const imminentCount = reminders.filter(r => {
            const d = new Date(r.due_at);
            return !r.is_completed && d > now && d <= in24h;
        }).length;

        setOverdueRemindersCount(overdueCount);
        setImminentRemindersCount(imminentCount);
    }, [reminders, setOverdueRemindersCount, setImminentRemindersCount]);

    // --- CRUD ---
    const addReminder = async (title: string, note: string, due_at: string) => {
        const { data, error } = await supabase
            .from('reminders')
            .insert({ title, note: note || null, due_at, is_completed: false })
            .select()
            .single();

        if (error) {
            console.error('Error adding reminder:', error);
            return;
        }
        if (data) setReminders(prev => [...prev, data]);
    };

    const toggleComplete = async (id: string, completed: boolean) => {
        setReminders(prev => prev.map(r => r.id === id ? { ...r, is_completed: completed } : r));
        await supabase.from('reminders').update({ is_completed: completed }).eq('id', id);
    };

    const deleteReminder = async (id: string) => {
        setReminders(prev => prev.filter(r => r.id !== id));
        await supabase.from('reminders').delete().eq('id', id);
    };

    const handleRename = async (id: string) => {
        const trimmed = editTitle.trim();
        if (trimmed && trimmed !== reminders.find(r => r.id === id)?.title) {
            setReminders(prev => prev.map(r => r.id === id ? { ...r, title: trimmed } : r));
            await supabase.from('reminders').update({ title: trimmed }).eq('id', id);
        }
        setEditingId(null);
    };

    // --- Sorted: pending (by due_at ASC) then completed (by due_at DESC) ---
    const sortedReminders = React.useMemo(() => {
        const pending = reminders.filter(r => !r.is_completed).sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
        const completed = reminders.filter(r => r.is_completed).sort((a, b) => new Date(b.due_at).getTime() - new Date(a.due_at).getTime());
        return [...pending, ...completed];
    }, [reminders]);

    // --- Form handlers ---
    const resetForm = () => {
        setNewTitle('');
        setNewNote('');
        setNewDueDate('');
        setIsCreating(false);
    };

    const handleSaveReminder = () => {
        if (!newTitle.trim()) return;
        if (!newDueDate) return;
        const due_at = new Date(newDueDate).toISOString();
        addReminder(newTitle.trim(), newNote.trim(), due_at);
        resetForm();
    };

    const setRelativeTime = (minutes: number) => {
        const d = new Date();
        d.setMinutes(d.getMinutes() + minutes);
        const tzOffset = d.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
        setNewDueDate(localISOTime);
    };

    // --- Render ---
    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center text-zinc-400">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
                <div className="flex items-center justify-between px-4 md:px-6 py-4">
                    <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-3">
                        <div className="p-2 bg-[#1F3760] rounded-lg text-white shadow-lg shadow-[#1F3760]/20">
                            <Bell size={20} />
                        </div>
                        Recordatorios
                    </h1>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#1F3760] hover:bg-[#152643] text-white font-medium rounded-lg shadow-md transition-colors active:scale-95"
                    >
                        <Plus size={16} />
                        <span className="hidden md:inline">Nuevo Recordatorio</span>
                    </button>
                </div>
            </div>

            {/* Reminders Grid List */}
            <div className="flex-1 overflow-y-auto hidden-scrollbar p-4 md:p-8">
                <div className="max-w-5xl mx-auto">

                    {/* Inline Creation Form */}
                    {isCreating && (
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border-2 border-[#1F3760]/30 mb-8 shadow-xl shadow-[#1F3760]/5 animate-fadeIn">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Nuevo Recordatorio</h3>
                                <button onClick={resetForm} className="p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="¿Qué necesitas recordar?"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                                autoFocus
                                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-medium text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#1F3760]/50 mb-3"
                            />
                            <textarea
                                placeholder="Detalles adicionales (opcional)..."
                                value={newNote}
                                onChange={e => setNewNote(e.target.value)}
                                rows={2}
                                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#1F3760]/50 mb-4 resize-none"
                            />
                            <div className="mb-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Fecha y hora límite</label>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {[1, 5, 10, 15, 30, 60].map(min => (
                                            <button
                                                key={min}
                                                type="button"
                                                onClick={() => setRelativeTime(min)}
                                                className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-[#1F3760] hover:text-white dark:hover:bg-[#1F3760] transition-colors rounded-lg"
                                            >
                                                +{min}{min === 60 ? 'h' : 'm'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <input
                                    type="datetime-local"
                                    value={newDueDate}
                                    onChange={e => setNewDueDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[#1F3760]/50"
                                />
                            </div>
                            <div className="flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                                <button
                                    onClick={resetForm}
                                    className="px-5 py-2 text-sm font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveReminder}
                                    disabled={!newTitle.trim() || !newDueDate}
                                    className="px-6 py-2 text-sm font-bold text-white bg-[#1F3760] hover:bg-[#152643] rounded-xl shadow-lg shadow-[#1F3760]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    )}

                    {sortedReminders.length === 0 ? (
                        <div className="text-center py-20 text-zinc-400">
                            <Bell size={32} className="mx-auto mb-4 opacity-20" />
                            <p>No hay recordatorios pendientes.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {sortedReminders.map(reminder => {
                                const isOverdue = !reminder.is_completed && new Date(reminder.due_at) <= new Date();
                                const isDone = reminder.is_completed;

                                return (
                                    <div
                                        key={reminder.id}
                                        className={`group bg-white dark:bg-zinc-900 p-5 rounded-2xl transition-all duration-500 ease-in-out border ${isDone
                                            ? 'border-zinc-200 dark:border-zinc-800 opacity-60 hover:opacity-100'
                                            : isOverdue
                                                ? 'border-red-300 dark:border-red-900/50 hover:border-red-500/50 shadow-md hover:shadow-xl hover:shadow-red-500/10'
                                                : 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5'
                                            }`}
                                    >
                                        {/* Header */}
                                        <div className="flex justify-between items-start mb-3">
                                            <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-md transition-colors ${isDone ? 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400' : isOverdue ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400'}`}>
                                                <Bell size={10} /> Recordatorio
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => toggleComplete(reminder.id, !isDone)}
                                                    className="p-1.5 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                    title={isDone ? 'Desmarcar' : 'Completar'}
                                                >
                                                    {isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                                                </button>
                                                <button
                                                    onClick={() => { if (confirm('¿Eliminar permanentemente?')) deleteReminder(reminder.id); }}
                                                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Tarea</p>
                                                {editingId === reminder.id ? (
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        value={editTitle}
                                                        onChange={e => setEditTitle(e.target.value)}
                                                        onBlur={() => handleRename(reminder.id)}
                                                        onKeyDown={e => { if (e.key === 'Enter') handleRename(reminder.id); if (e.key === 'Escape') setEditingId(null); }}
                                                        className="w-full text-zinc-800 dark:text-zinc-100 font-medium leading-tight bg-transparent border-b border-indigo-500 outline-none pb-0.5"
                                                    />
                                                ) : (
                                                    <p
                                                        onDoubleClick={() => { setEditingId(reminder.id); setEditTitle(reminder.title); }}
                                                        className={`font-medium leading-tight cursor-pointer hover:underline decoration-dashed ${isDone ? 'line-through text-zinc-400 dark:text-zinc-500' : isOverdue ? 'text-red-600 dark:text-red-400' : 'text-zinc-800 dark:text-zinc-100'}`}
                                                    >
                                                        {reminder.title}
                                                    </p>
                                                )}
                                                {reminder.note && <p className={`text-xs mt-2 leading-relaxed ${isDone ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-500 dark:text-zinc-400'}`}>{reminder.note}</p>}
                                            </div>

                                            <div className="h-px bg-zinc-100 dark:bg-zinc-800 w-full"></div>

                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className={`text-[10px] font-bold uppercase mb-1 ${isDone ? 'text-zinc-400' : isOverdue ? 'text-red-400/80' : 'text-indigo-400/80'}`}>Vencimiento</p>
                                                    <p className={`text-xs font-bold leading-tight flex items-center gap-1.5 ${isDone ? 'text-zinc-400' : isOverdue ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                                        {isOverdue && !isDone ? <AlertCircle size={12} /> : <Clock size={12} />}
                                                        {formatDueDate(reminder.due_at)}
                                                    </p>
                                                </div>
                                                {isOverdue && !isDone && <span className="text-[9px] font-bold uppercase tracking-widest text-white bg-red-600 px-2 py-0.5 rounded-md animate-pulse">Vencido</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
