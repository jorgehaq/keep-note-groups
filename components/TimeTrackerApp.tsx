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
            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300" />
            </div>
        );
    }

    return (
        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">Últimos 7 días</span>
                <span className="text-[11px] font-mono font-medium text-zinc-500 dark:text-zinc-400">
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
                        <span className="text-[9px] text-zinc-400 mt-1 font-medium">{day.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface TimeTrackerAppProps {
    session: Session;
}

// --- Core calculation: derives real-time seconds from DB snapshot ---
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
    const [, setTick] = useState(0); // Force re-render every second
    const { setActiveTimersCount } = useUIStore();

    // --- Inline title editing ---
    const [editingTimerId, setEditingTimerId] = useState<string | null>(null);
    // --- Stats drawer ---
    const [expandedStatsId, setExpandedStatsId] = useState<string | null>(null);
    const [tempTitle, setTempTitle] = useState('');

    // --- Fetch timers ---
    useEffect(() => {
        const fetchTimers = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('timers')
                .select('*')
                .order('updated_at', { ascending: false });

            if (error) {
                console.error('Error fetching timers:', error);
            } else {
                setTimers(data || []);
            }
            setLoading(false);
        };

        fetchTimers();
    }, []);

    // --- Update badge count whenever timers change ---
    useEffect(() => {
        const runningCount = timers.filter(t => t.status === 'running').length;
        setActiveTimersCount(runningCount);
    }, [timers, setActiveTimersCount]);

    // --- 1-second tick for running timers (UI only, no DB writes) ---
    useEffect(() => {
        const hasRunning = timers.some(t => t.status === 'running');
        if (!hasRunning) return;

        const interval = setInterval(() => {
            setTick(prev => prev + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [timers]);

    // --- CRUD ---
    const addTimer = async (title: string) => {
        const { data, error } = await supabase
            .from('timers')
            .insert({
                title,
                type: 'stopwatch',
                status: 'paused',
                accumulated_seconds: 0,
                target_seconds: 0,
                last_started_at: null,
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding timer:', error);
            return;
        }
        if (data) setTimers(prev => [data, ...prev]);
    };

    const startTimer = async (id: string) => {
        const now = new Date().toISOString();
        setTimers(prev =>
            prev.map(t => t.id === id ? { ...t, status: 'running' as const, last_started_at: now } : t)
        );
        await supabase.from('timers').update({ status: 'running', last_started_at: now }).eq('id', id);
    };

    const pauseTimer = async (id: string) => {
        const timer = timers.find(t => t.id === id);
        if (!timer) return;
        const currentSeconds = calculateCurrentSeconds(timer);

        // Log this session's duration
        const sessionSeconds = currentSeconds - timer.accumulated_seconds;
        if (sessionSeconds > 0) {
            supabase.from('timer_logs').insert({ timer_id: id, duration_seconds: sessionSeconds }).then();
        }

        setTimers(prev =>
            prev.map(t =>
                t.id === id
                    ? { ...t, status: 'paused' as const, accumulated_seconds: currentSeconds, last_started_at: null }
                    : t
            )
        );
        await supabase
            .from('timers')
            .update({ status: 'paused', accumulated_seconds: currentSeconds, last_started_at: null })
            .eq('id', id);
    };

    const deleteTimer = async (id: string) => {
        setTimers(prev => prev.filter(t => t.id !== id));
        await supabase.from('timers').delete().eq('id', id);
    };

    // --- Add handler ---
    const handleAdd = () => {
        const title = prompt('Nombre del cronómetro:');
        if (!title?.trim()) return;
        addTimer(title.trim());
    };

    const handleRename = async (id: string, newTitle: string) => {
        const trimmed = newTitle.trim();
        setEditingTimerId(null);
        if (!trimmed) return;
        setTimers(prev => prev.map(t => t.id === id ? { ...t, title: trimmed } : t));
        await supabase.from('timers').update({ title: trimmed }).eq('id', id);
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
                        <Clock size={20} className="text-zinc-500" />
                        Timers & Focus
                    </h1>
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1F3760] hover:bg-[#152643] text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
                        title="Nuevo Cronómetro"
                    >
                        <Plus size={14} />
                        <span className="hidden md:inline">Nuevo Cronómetro</span>
                    </button>
                </div>
            </div>

            {/* Timer List */}
            <div className="flex-1 overflow-y-auto hidden-scrollbar p-4 md:p-6">
                <div className="max-w-2xl mx-auto flex flex-col gap-3">
                    {timers.length === 0 ? (
                        <div className="text-center py-20 text-zinc-400 text-sm">
                            No hay cronómetros. Crea uno para empezar a medir tu tiempo.
                        </div>
                    ) : (
                        timers.map(timer => {
                            const currentSeconds = calculateCurrentSeconds(timer);
                            const isRunning = timer.status === 'running';

                            const isStatsOpen = expandedStatsId === timer.id;

                            return (
                                <div key={timer.id} className={`rounded-xl shadow-sm border overflow-hidden transition-all ${isRunning
                                    ? 'bg-[#1F3760]/5 dark:bg-[#1F3760]/20 border-[#1F3760]/30 dark:border-[#1F3760]/50 ring-1 ring-[#1F3760]/20'
                                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                                    }`}>
                                    <div className="flex items-center gap-4 px-5 py-4">
                                        {/* Play/Pause toggle */}
                                        <button
                                            onClick={() => isRunning ? pauseTimer(timer.id) : startTimer(timer.id)}
                                            className={`p-2.5 rounded-full transition-all shrink-0 ${isRunning
                                                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/30'
                                                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                                                }`}
                                            title={isRunning ? 'Pausar' : 'Iniciar'}
                                        >
                                            {isRunning ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                                        </button>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            {editingTimerId === timer.id ? (
                                                <input
                                                    type="text"
                                                    value={tempTitle}
                                                    onChange={e => setTempTitle(e.target.value)}
                                                    onBlur={() => handleRename(timer.id, tempTitle)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleRename(timer.id, tempTitle);
                                                        if (e.key === 'Escape') setEditingTimerId(null);
                                                    }}
                                                    autoFocus
                                                    className="text-sm font-medium text-zinc-800 dark:text-zinc-200 bg-transparent border-b border-[#1F3760] outline-none w-full py-0.5"
                                                />
                                            ) : (
                                                <p
                                                    className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate cursor-pointer hover:underline decoration-dashed"
                                                    onDoubleClick={() => {
                                                        setEditingTimerId(timer.id);
                                                        setTempTitle(timer.title);
                                                    }}
                                                >
                                                    {timer.title}
                                                </p>
                                            )}
                                            <span className={`text-[10px] uppercase tracking-wider font-semibold ${isRunning ? 'text-emerald-500' : 'text-zinc-400'
                                                }`}>
                                                {isRunning ? '● Corriendo' : 'Pausado'}
                                            </span>
                                        </div>

                                        {/* Time Display */}
                                        <div className={`font-mono text-2xl font-bold tracking-tight tabular-nums ${isRunning
                                            ? 'text-zinc-900 dark:text-white'
                                            : 'text-zinc-500 dark:text-zinc-400'
                                            }`}>
                                            {formatTime(currentSeconds)}
                                        </div>

                                        {/* Stats toggle */}
                                        <button
                                            onClick={() => setExpandedStatsId(isStatsOpen ? null : timer.id)}
                                            className={`p-2 rounded-lg transition-colors shrink-0 ${isStatsOpen
                                                ? 'text-[#1F3760] bg-[#1F3760]/10 dark:text-blue-400 dark:bg-blue-900/20'
                                                : 'text-zinc-300 dark:text-zinc-600 hover:text-[#1F3760] dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                                                }`}
                                            title="Estadísticas"
                                        >
                                            <BarChart2 size={15} />
                                        </button>

                                        {/* Delete */}
                                        <button
                                            onClick={() => {
                                                if (confirm('¿Eliminar este cronómetro?')) deleteTimer(timer.id);
                                            }}
                                            className="p-2 text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>

                                    {/* Expandable Stats Drawer */}
                                    {isStatsOpen && <TimerMicroStats timerId={timer.id} />}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
