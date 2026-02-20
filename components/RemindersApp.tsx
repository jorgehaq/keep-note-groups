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
    const { setOverdueRemindersCount } = useUIStore();

    // --- Form states ---
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newNote, setNewNote] = useState('');
    const [newDueDate, setNewDueDate] = useState('');

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

    // --- Update overdue badge ---
    useEffect(() => {
        const now = new Date();
        const overdueCount = reminders.filter(
            r => !r.is_completed && new Date(r.due_at) <= now
        ).length;
        setOverdueRemindersCount(overdueCount);
    }, [reminders, setOverdueRemindersCount]);

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
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
                <div className="flex items-center justify-between px-4 md:px-6 h-14">
                    <h1 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                        <Bell size={20} className="text-zinc-500" />
                        Recordatorios
                    </h1>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1F3760] hover:bg-[#152643] text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
                        title="Nuevo Recordatorio"
                    >
                        <Plus size={14} />
                        <span className="hidden md:inline">Nuevo Recordatorio</span>
                    </button>
                </div>
            </div>

            {/* Reminders List */}
            <div className="flex-1 overflow-y-auto hidden-scrollbar p-4 md:p-6">
                <div className="max-w-2xl mx-auto flex flex-col gap-2">

                    {/* Inline Creation Form */}
                    {isCreating && (
                        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800 mb-4 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Nuevo Recordatorio</h3>
                                <button onClick={resetForm} className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="¿Qué necesitas recordar?"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                                autoFocus
                                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#1F3760]/50 mb-3"
                            />
                            <textarea
                                placeholder="Detalles adicionales (opcional)..."
                                value={newNote}
                                onChange={e => setNewNote(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#1F3760]/50 mb-3 resize-none"
                            />
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 block">Fecha y hora límite</label>
                                    <div className="flex gap-1.5">
                                        {[1, 5, 10, 15, 30, 60].map(min => (
                                            <button
                                                key={min}
                                                type="button"
                                                onClick={() => setRelativeTime(min)}
                                                className="px-2 py-0.5 text-[10px] font-semibold bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-[#1F3760] hover:text-white dark:hover:bg-[#1F3760] dark:hover:text-white rounded transition-colors shrink-0"
                                                title={`Añadir ${min} minuto${min > 1 ? 's' : ''}`}
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
                                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[#1F3760]/50"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={resetForm}
                                    className="px-3 py-1.5 text-xs font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveReminder}
                                    disabled={!newTitle.trim() || !newDueDate}
                                    className="px-4 py-1.5 text-xs font-medium text-white bg-[#1F3760] hover:bg-[#152643] rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Guardar Recordatorio
                                </button>
                            </div>
                        </div>
                    )}
                    {sortedReminders.length === 0 ? (
                        <div className="text-center py-20 text-zinc-400 text-sm">
                            No hay recordatorios.
                        </div>
                    ) : (
                        sortedReminders.map(reminder => {
                            const isOverdue = !reminder.is_completed && new Date(reminder.due_at) <= new Date();
                            const isDone = reminder.is_completed;

                            return (
                                <div
                                    key={reminder.id}
                                    className={`flex items-start gap-3 rounded-lg p-3 border transition-all group hover:shadow-sm ${isDone
                                        ? 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 opacity-75'
                                        : isOverdue
                                            ? 'bg-red-50 dark:bg-red-950/20 border-red-400/50 dark:border-red-500/50'
                                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                                        }`}
                                >
                                    {/* Complete toggle */}
                                    <button
                                        onClick={() => toggleComplete(reminder.id, !isDone)}
                                        className={`mt-0.5 shrink-0 transition-all hover:scale-110 ${isDone
                                            ? 'text-emerald-500 hover:text-zinc-400'
                                            : isOverdue
                                                ? 'text-red-400 hover:text-emerald-500'
                                                : 'text-zinc-300 dark:text-zinc-600 hover:text-emerald-500'
                                            }`}
                                        title={isDone ? 'Desmarcar' : 'Marcar como completado'}
                                    >
                                        {isDone
                                            ? <CheckCircle2 size={20} />
                                            : <>
                                                <Circle size={20} className="group-hover:hidden" />
                                                <CheckCircle2 size={20} className="hidden group-hover:block" />
                                            </>
                                        }
                                    </button>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium ${isDone
                                            ? 'line-through text-zinc-400 dark:text-zinc-400'
                                            : isOverdue
                                                ? 'text-red-600 dark:text-red-400'
                                                : 'text-zinc-800 dark:text-zinc-200'
                                            }`}>
                                            {reminder.title}
                                        </p>
                                        {reminder.note && (
                                            <p className={`text-xs mt-1 line-clamp-2 ${isDone ? 'text-zinc-400 dark:text-zinc-300 line-through' : 'text-zinc-500 dark:text-zinc-400'}`}>{reminder.note}</p>
                                        )}
                                        <div className={`flex items-center gap-1 mt-1.5 text-[11px] ${isDone
                                            ? 'text-zinc-400'
                                            : isOverdue
                                                ? 'text-red-600 dark:text-red-400'
                                                : 'text-zinc-500 dark:text-zinc-400'
                                            }`}>
                                            {isDone
                                                ? <CheckCircle2 size={12} />
                                                : isOverdue
                                                    ? <AlertCircle size={12} />
                                                    : <Clock size={12} />
                                            }
                                            <span className="font-mono">{formatDueDate(reminder.due_at)}</span>
                                        </div>
                                    </div>

                                    {/* Overdue badge (only for pending) */}
                                    {isOverdue && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-red-600 px-2 py-0.5 rounded-full animate-pulse shrink-0 mt-0.5">
                                            Vencido
                                        </span>
                                    )}

                                    {/* Delete (always visible) */}
                                    <button
                                        onClick={() => {
                                            if (confirm('¿Eliminar este recordatorio permanentemente?')) deleteReminder(reminder.id);
                                        }}
                                        className="p-1.5 text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0 mt-0.5"
                                        title="Eliminar permanentemente"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
