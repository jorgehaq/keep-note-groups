import React, { useState, useEffect } from 'react';
import { Plus, Play, Pause, Trash2, Clock, BarChart2 } from 'lucide-react';
import { Timer } from '../types';
import { supabase } from '../src/lib/supabaseClient';
import { useUIStore } from '../src/lib/store';
import { Session } from '@supabase/supabase-js';

// --- Day labels (Spanish, Mon-Sun) ---
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// --- MicroStats Sub-component ---
const TimerMicroStats: React.FC<{ timerId: string }> = ({ timerId }) => {
    const [days, setDays] = useState<{ label: string; total: number }[]>([]);
    const [loadingStats, setLoadingStats] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            setLoadingStats(true);
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            const { data } = await supabase
                .from('timer_logs')
                .select('duration_seconds, created_at')
                .eq('timer_id', timerId)
                .gte('created_at', sevenDaysAgo.toISOString())
                .order('created_at', { ascending: true });

            // Build 7-day buckets
            const buckets: { label: string; total: number }[] = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dayOfWeek = d.getDay(); // 0=Sun
                const label = DAY_LABELS[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
                const dateKey = d.toISOString().slice(0, 10);

                const dayTotal = (data || []).filter(log => {
                    return new Date(log.created_at).toISOString().slice(0, 10) === dateKey;
                }).reduce((sum, log) => sum + (log.duration_seconds || 0), 0);

                buckets.push({ label, total: dayTotal });
            }
            setDays(buckets);
            setLoadingStats(false);
        };
        fetchLogs();
    }, [timerId]);

    const maxSeconds = Math.max(...days.map(d => d.total), 1);
    const totalSeconds = days.reduce((s, d) => s + d.total, 0);
    const totalH = Math.floor(totalSeconds / 3600);
    const totalM = Math.floor((totalSeconds % 3600) / 60);

    if (loadingStats) {
        return (
            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 flex items-center justify-center rounded-xl">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300" />
            </div>
        );
    }

    return (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Últimos 7 días</span>
                <span className="text-[11px] font-mono font-bold text-indigo-500 dark:text-indigo-400">
                    {totalH > 0 ? `${totalH}h ${totalM}m` : `${totalM}m`}
                </span>
            </div>
            <div className="flex items-end justify-between gap-1.5" style={{ height: 64 }}>
                {days.map((day, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 h-full justify-end">
                        <div
                            className="w-full rounded-t transition-all duration-300"
                            style={{
                                height: day.total > 0 ? `${Math.max((day.total / maxSeconds) * 100, 6)}%` : '4px',
                                backgroundColor: day.total > 0 ? '#1F3760' : 'var(--bar-empty, rgba(161,161,170,0.2))',
                                minHeight: day.total > 0 ? 4 : 2,
                            }}
                            title={`${Math.floor(day.total / 60)}m`}
                        />
                        <span className="text-[9px] text-zinc-400 mt-1 font-bold">{day.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface TimeTrackerAppProps {
    session: Session;
}

const calculateCurrentSeconds = (timer: Timer): number => {
    if (timer.status === 'paused' || !timer.last_started_at) {
        return timer.accumulated_seconds;
    }
    const elapsedSinceStart = Math.floor(
        (Date.now() - new Date(timer.last_started_at).getTime()) / 1000
    );
    return timer.accumulated_seconds + elapsedSinceStart;
};

const formatTime = (totalSeconds: number): string => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const TimeTrackerApp: React.FC<TimeTrackerAppProps> = ({ session }) => {
    const [timers, setTimers] = useState<Timer[]>([]);
    const [loading, setLoading] = useState(true);
    const [, setTick] = useState(0);
    const { setActiveTimersCount } = useUIStore();

    const [editingTimerId, setEditingTimerId] = useState<string | null>(null);
    const [expandedStatsId, setExpandedStatsId] = useState<string | null>(null);
    const [tempTitle, setTempTitle] = useState('');

    useEffect(() => {
        const fetchTimers = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('timers')
                .select('*')
                .order('updated_at', { ascending: false });

            if (error) console.error('Error fetching timers:', error);
            else setTimers(data || []);
            setLoading(false);
        };
        fetchTimers();
    }, []);

    useEffect(() => {
        const runningCount = timers.filter(t => t.status === 'running').length;
        setActiveTimersCount(runningCount);
    }, [timers, setActiveTimersCount]);

    useEffect(() => {
        const hasRunning = timers.some(t => t.status === 'running');
        if (!hasRunning) return;
        const interval = setInterval(() => setTick(prev => prev + 1), 1000);
        return () => clearInterval(interval);
    }, [timers]);

    const addTimer = async (title: string) => {
        const { data, error } = await supabase
            .from('timers')
            .insert({
                title, type: 'stopwatch', status: 'paused', accumulated_seconds: 0, target_seconds: 0, last_started_at: null,
            }).select().single();
        if (data) setTimers(prev => [data, ...prev]);
    };

    const startTimer = async (id: string) => {
        const now = new Date().toISOString();
        setTimers(prev => prev.map(t => t.id === id ? { ...t, status: 'running' as const, last_started_at: now } : t));
        await supabase.from('timers').update({ status: 'running', last_started_at: now }).eq('id', id);
    };

    const pauseTimer = async (id: string) => {
        const timer = timers.find(t => t.id === id);
        if (!timer) return;
        const currentSeconds = calculateCurrentSeconds(timer);

        const sessionSeconds = currentSeconds - timer.accumulated_seconds;
        if (sessionSeconds > 0) {
            supabase.from('timer_logs').insert({ timer_id: id, duration_seconds: sessionSeconds }).then();
        }

        setTimers(prev => prev.map(t => t.id === id ? { ...t, status: 'paused' as const, accumulated_seconds: currentSeconds, last_started_at: null } : t));
        await supabase.from('timers').update({ status: 'paused', accumulated_seconds: currentSeconds, last_started_at: null }).eq('id', id);
    };

    const deleteTimer = async (id: string) => {
        setTimers(prev => prev.filter(t => t.id !== id));
        await supabase.from('timers').delete().eq('id', id);
    };

    const handleAdd = () => {
        const title = prompt('Nombre del cronómetro:');
        if (!title?.trim()) return;
        addTimer(title.trim());
    };

    const handleRename = async (id: string, newTitle: string) => {
        const trimmed = newTitle.trim();
        setEditingTimerId(null);
        if (!trimmed || trimmed === timers.find(t => t.id === id)?.title) return;
        setTimers(prev => prev.map(t => t.id === id ? { ...t, title: trimmed } : t));
        await supabase.from('timers').update({ title: trimmed }).eq('id', id);
    };

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
                            <Clock size={20} />
                        </div>
                        Timers & Focus
                    </h1>
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#1F3760] hover:bg-[#152643] text-white font-medium rounded-lg shadow-md transition-colors active:scale-95"
                    >
                        <Plus size={16} />
                        <span className="hidden md:inline">Nuevo Cronómetro</span>
                    </button>
                </div>
            </div>

            {/* Timer Grid List */}
            <div className="flex-1 overflow-y-auto hidden-scrollbar p-4 md:p-8">
                <div className="max-w-5xl mx-auto">
                    {timers.length === 0 ? (
                        <div className="text-center py-20 text-zinc-400">
                            <Clock size={32} className="mx-auto mb-4 opacity-20" />
                            <p>No hay cronómetros. Crea uno para empezar a medir tu tiempo.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {timers.map(timer => {
                                const currentSeconds = calculateCurrentSeconds(timer);
                                const isRunning = timer.status === 'running';
                                const isStatsOpen = expandedStatsId === timer.id;

                                return (
                                    <div key={timer.id} className={`group bg-white dark:bg-zinc-900 p-5 rounded-2xl transition-all duration-500 ease-in-out border ${isRunning ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/10 scale-[1.02]' : 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5'}`}>

                                        {/* Card Header */}
                                        <div className="flex justify-between items-start mb-3">
                                            <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-md transition-colors ${isRunning ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400'}`}>
                                                <Clock size={10} /> {isRunning ? 'En curso' : 'Pausado'}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => setExpandedStatsId(isStatsOpen ? null : timer.id)} className={`p-1.5 rounded-lg transition-colors ${isStatsOpen ? 'bg-indigo-50 text-indigo-500 dark:bg-indigo-900/20' : 'text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`} title="Estadísticas">
                                                    <BarChart2 size={16} />
                                                </button>
                                                <button onClick={() => { if (confirm('¿Eliminar este cronómetro?')) deleteTimer(timer.id); }} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Eliminar">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Actividad</p>
                                                    {editingTimerId === timer.id ? (
                                                        <input autoFocus type="text" value={tempTitle} onChange={e => setTempTitle(e.target.value)} onBlur={() => handleRename(timer.id, tempTitle)} onKeyDown={e => { if (e.key === 'Enter') handleRename(timer.id, tempTitle); if (e.key === 'Escape') setEditingTimerId(null); }} className="w-full text-zinc-800 dark:text-zinc-100 font-medium leading-tight bg-transparent border-b border-indigo-500 outline-none pb-0.5" />
                                                    ) : (
                                                        <p onDoubleClick={() => { setEditingTimerId(timer.id); setTempTitle(timer.title); }} className="text-zinc-800 dark:text-zinc-100 font-medium leading-tight cursor-pointer hover:underline decoration-dashed truncate" title="Doble clic para editar">{timer.title}</p>
                                                    )}
                                                </div>
                                                {/* Action Button */}
                                                <button onClick={() => isRunning ? pauseTimer(timer.id) : startTimer(timer.id)} className={`p-3.5 rounded-xl shadow-lg transition-all active:scale-95 shrink-0 ${isRunning ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20' : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'}`}>
                                                    {isRunning ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                                                </button>
                                            </div>

                                            <div className="h-px bg-zinc-100 dark:bg-zinc-800 w-full"></div>

                                            <div className="flex flex-col items-center">
                                                <p className="text-[10px] text-indigo-400/80 font-bold uppercase mb-1 w-full text-left">Tiempo Acumulado</p>
                                                <p className={`font-mono text-4xl tracking-tight tabular-nums font-bold leading-none py-2 ${isRunning ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                                    {formatTime(currentSeconds)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Stats Drawer */}
                                        {isStatsOpen && (
                                            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 animate-fadeIn">
                                                <TimerMicroStats timerId={timer.id} />
                                            </div>
                                        )}
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
