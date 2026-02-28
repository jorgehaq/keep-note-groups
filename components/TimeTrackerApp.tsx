import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Clock, Trash2, CheckCircle2, Play, Pause, Square, Flag, History as HistoryIcon, Zap, ChevronDown, ChevronUp, RotateCcw, Archive as ArchiveIcon } from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { SmartNotesEditor } from '../src/components/editor/SmartNotesEditor';

// --- TYPES ---
type TimerStatus = 'main' | 'active' | 'history';
type TimerType = 'cycle' | 'racing';

interface TimerLap {
    id: string;
    start_time: string;
    end_time: string;
    duration_ms: number;
}

interface AdvancedTimer {
    id: string;
    title: string;
    content: string;
    status: TimerStatus;
    type: TimerType;
    laps: TimerLap[];
    accumulated_ms: number;
    last_started_at: string | null;
    created_at: string;
    updated_at: string;
    user_id: string;
}

// --- UTILS FORMATO DE FECHA Y TIEMPO ---
const formatCleanDate = (isoString: string) => {
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? ' PM' : ' AM';
    hours = hours % 12 || 12;
    return `${day}/${month}/${year}, ${hours.toString().padStart(2, '0')}:${minutes}${ampm}`;
};

const formatDuration = (totalMs: number) => {
    const h = Math.floor(totalMs / 3600000);
    const m = Math.floor((totalMs % 3600000) / 60000);
    const s = Math.floor((totalMs % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
};

const formatDigitalClock = (totalMs: number) => {
    const h = Math.floor(totalMs / 3600000);
    const m = Math.floor((totalMs % 3600000) / 60000);
    const s = Math.floor((totalMs % 60000) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- PARSER DE MARKDOWN PARA VISTA PREVIA ---
const parseMarkdownPreview = (text: string) => {
    if (!text) return '';
    return text
        .replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/==([^=]+)==/g, '<mark class="bg-yellow-200/60 dark:bg-yellow-500/40 text-inherit rounded-sm px-1 font-medium">$1</mark>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/_([^_]+)_/g, '<em>$1</em>')
        .replace(/~~([^~]+)~~/g, '<del class="opacity-70">$1</del>')
        .replace(/^&gt;\s+(.*)$/gm, '<span class="border-l-2 border-indigo-400 dark:border-indigo-600 pl-2 ml-1 italic opacity-90 block my-1">$1</span>')
        .replace(/\[\[tr:([^|]+)\|([^\]]+)\]\]/g, '<span class="text-indigo-600 dark:text-indigo-400 font-bold border-b border-indigo-400/50 border-dashed cursor-help" title="$1">$2</span>')
        .replace(/\n/g, '<span class="mx-1 opacity-30 text-[10px]">&para;</span> ');
};

// --- SUB-COMPONENT: LIVE CLOCK ---
const LiveClock: React.FC<{ accumulatedMs: number; lastStartedAt: string | null; isLarge?: boolean }> = ({ accumulatedMs, lastStartedAt, isLarge = false }) => {
    const [liveMs, setLiveMs] = useState(accumulatedMs);

    useEffect(() => {
        if (!lastStartedAt) {
            setLiveMs(accumulatedMs);
            return;
        }
        const interval = setInterval(() => {
            const currentSessionMs = Date.now() - new Date(lastStartedAt).getTime();
            setLiveMs(accumulatedMs + currentSessionMs);
        }, 1000);
        
        // Ejecución inmediata para no esperar el primer segundo
        const initialSessionMs = Date.now() - new Date(lastStartedAt).getTime();
        setLiveMs(accumulatedMs + initialSessionMs);

        return () => clearInterval(interval);
    }, [accumulatedMs, lastStartedAt]);

    return (
        <span className={`font-mono font-bold tracking-wider ${isLarge ? 'text-4xl text-indigo-600 dark:text-indigo-400' : 'text-sm text-zinc-600 dark:text-zinc-300'}`}>
            {formatDigitalClock(liveMs)}
        </span>
    );
};

export const TimeTrackerApp: React.FC<{ session: Session; noteFont?: string; noteFontSize?: string }> = ({ session, noteFont, noteFontSize }) => {
    const [timers, setTimers] = useState<AdvancedTimer[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedActiveIds, setExpandedActiveIds] = useState<Set<string>>(new Set());
    const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());
    const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

    const fetchTimers = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('timers')
                .select('*')
                .eq('user_id', session.user.id)
                .order('updated_at', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTimers(data as AdvancedTimer[]);
        } catch (error: any) {
            console.error("Error cargando cronómetros:", error.message);
        } finally {
            setLoading(false);
        }
    }, [session.user.id]);

    useEffect(() => { fetchTimers(); }, [fetchTimers]);

    const autoSave = (id: string, updates: Partial<AdvancedTimer>) => {
        setTimers(prev => prev.map(t => t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t));
        if (saveTimeoutRef.current[id]) clearTimeout(saveTimeoutRef.current[id]);
        saveTimeoutRef.current[id] = setTimeout(async () => {
            await supabase.from('timers').update(updates).eq('id', id);
        }, 500);
    };

    const createNewDraft = async () => {
        const { data: newMain } = await supabase.from('timers')
            .insert([{ title: '', content: '', status: 'main', type: 'cycle', user_id: session.user.id, laps: [] }])
            .select().single();
        if (newMain) setTimers(prev => [newMain as AdvancedTimer, ...prev]);
    };

    const changeStatus = async (id: string, newStatus: TimerStatus) => {
        setTimers(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
        await supabase.from('timers').update({ status: newStatus }).eq('id', id);
        
        if (newStatus === 'history') {
            setExpandedActiveIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        }
    };

    const deleteTimer = async (id: string) => {
        if (!window.confirm('¿Eliminar permanentemente este cronómetro y todos sus registros?')) return;
        setTimers(prev => prev.filter(t => t.id !== id));
        await supabase.from('timers').delete().eq('id', id);
    };

    // --- LÓGICA CORE DE LOS CRONÓMETROS ---
    const handlePlay = (id: string) => {
        const timer = timers.find(t => t.id === id);
        if (!timer || timer.last_started_at) return; // Ya está corriendo
        autoSave(id, { last_started_at: new Date().toISOString() });
    };

    const handlePauseCycle = (id: string) => {
        const timer = timers.find(t => t.id === id);
        if (!timer || !timer.last_started_at) return;
        
        const now = new Date();
        const start = new Date(timer.last_started_at);
        const elapsed = now.getTime() - start.getTime();
        
        const newLap: TimerLap = {
            id: crypto.randomUUID(),
            start_time: start.toISOString(),
            end_time: now.toISOString(),
            duration_ms: elapsed
        };

        autoSave(id, {
            laps: [...timer.laps, newLap],
            accumulated_ms: timer.accumulated_ms + elapsed,
            last_started_at: null // Detiene el reloj
        });
    };

    const handleLapRacing = (id: string) => {
        const timer = timers.find(t => t.id === id);
        if (!timer || !timer.last_started_at) return;

        const now = new Date();
        // El inicio de este lap es el fin del anterior, o el last_started_at si es el primero
        const lastLapEnd = timer.laps.length > 0 ? new Date(timer.laps[timer.laps.length - 1].end_time) : new Date(timer.last_started_at);
        const elapsed = now.getTime() - lastLapEnd.getTime();

        const newLap: TimerLap = {
            id: crypto.randomUUID(),
            start_time: lastLapEnd.toISOString(),
            end_time: now.toISOString(),
            duration_ms: elapsed
        };

        autoSave(id, { laps: [...timer.laps, newLap] });
        // NOTA: No modificamos last_started_at ni accumulated_ms porque la carrera sigue corriendo
    };

    const handleStopRacing = (id: string) => {
        const timer = timers.find(t => t.id === id);
        if (!timer || !timer.last_started_at) return;
        
        const now = new Date();
        const start = new Date(timer.last_started_at);
        const elapsed = now.getTime() - start.getTime();

        autoSave(id, {
            accumulated_ms: timer.accumulated_ms + elapsed,
            last_started_at: null // Detiene el reloj principal de la carrera
        });
    };

    const toggleExpandActive = (id: string) => setExpandedActiveIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const toggleExpandHistory = (id: string) => setExpandedHistoryIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

    if (loading) return <div className="p-10 text-center animate-pulse text-zinc-500">Cargando Tiempos...</div>;

    const drafts = timers.filter(t => t.status === 'main');
    const actives = timers.filter(t => t.status === 'active');
    const history = timers.filter(t => t.status === 'history');

    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
            {/* HEADER */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
                <div className="flex items-center justify-between px-4 md:px-6 py-4">
                    <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-3">
                        <div className="p-2 bg-[#2563EB] rounded-lg text-white shadow-lg shadow-blue-500/20">
                            <Clock size={20} />
                        </div>
                        Cronómetros
                    </h1>
                    <button onClick={createNewDraft} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl shadow-lg transition-colors flex items-center gap-2">
                        <Plus size={20} /> <span className="text-sm font-bold hidden sm:inline pr-2">Nuevo</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8 hidden-scrollbar">
                <div className="max-w-4xl mx-auto space-y-12 pb-20">
                    
                    {/* 1. BORRADORES (EN CONSTRUCCIÓN) */}
                    {drafts.length > 0 && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="flex items-center gap-2 text-indigo-500">
                                <Zap size={18} className="fill-current" />
                                <span className="text-sm font-bold uppercase tracking-widest">En Construcción</span>
                            </div>
                            {drafts.map(draft => (
                                <div key={draft.id} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-indigo-500/30 p-1 transition-all focus-within:ring-2 focus-within:ring-indigo-500/50">
                                    <div className="flex items-center justify-between pr-4">
                                        <input 
                                            type="text" placeholder="¿Qué vamos a medir? (ej. Sprint Programación)" 
                                            value={draft.title || ''} onChange={e => autoSave(draft.id, { title: e.target.value })} 
                                            className="w-full bg-transparent text-xl font-bold text-zinc-800 dark:text-zinc-100 p-4 pb-3 outline-none placeholder-zinc-400" 
                                        />
                                    </div>
                                    <div className="h-px bg-zinc-100 dark:bg-zinc-800/80 mx-4 mb-2" />
                                    
                                    <div className="mx-4 mb-4 p-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-text min-h-[100px]">
                                        <SmartNotesEditor noteId={draft.id} initialContent={draft.content} onChange={c => autoSave(draft.id, { content: c })} noteFont={noteFont} noteFontSize={noteFontSize} />
                                    </div>
                                    
                                    {/* SELECCIÓN DE TIPO DE CRONÓMETRO */}
                                    <div className="bg-zinc-50 dark:bg-[#1B1B1E] rounded-xl m-4 p-4 border border-zinc-200 dark:border-zinc-800">
                                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">Modo de Operación:</span>
                                        <select 
                                            value={draft.type} 
                                            onChange={e => autoSave(draft.id, { type: e.target.value as TimerType })}
                                            className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="cycle">🔄 Modo Ciclo (Pausar crea un Lap y detiene el reloj)</option>
                                            <option value="racing">🏁 Modo Carrera (Marcar Hitos sin detener el reloj principal)</option>
                                        </select>
                                    </div>

                                    <div className="flex justify-end p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-2xl border-t border-zinc-200 dark:border-zinc-800">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => deleteTimer(draft.id)} className="text-xs font-bold text-zinc-400 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2">
                                                <Trash2 size={14} /> Eliminar
                                            </button>
                                            <button onClick={() => changeStatus(draft.id, 'active')} className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/20 transition-all">
                                                <Play size={14}/> Establecer e Iniciar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 2. ACTIVOS Y CORRIENDO */}
                    {actives.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-emerald-500">
                                <Clock size={16} /> <span className="text-xs font-bold uppercase tracking-widest">Activos y Corriendo</span>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4">
                                {actives.map(timer => {
                                    const isExpanded = expandedActiveIds.has(timer.id);
                                    const isRunning = timer.last_started_at !== null;

                                    return (
                                        <div key={timer.id} className={`bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-lg transition-all flex flex-col ${isExpanded ? 'border-2 border-indigo-500/50' : 'border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50'}`}>
                                            
                                            {/* HEADER */}
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <button onClick={() => toggleExpandActive(timer.id)} className="p-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-400 transition-colors shrink-0">
                                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                    </button>
                                                    <div className="flex flex-col min-w-0">
                                                        <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-100 truncate">{timer.title || 'Cronómetro'}</h3>
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                                                            {timer.type === 'cycle' ? <><RotateCcw size={10}/> Modo Ciclo</> : <><Flag size={10}/> Modo Carrera</>}
                                                        </span>
                                                    </div>
                                                </div>
                                                {!isExpanded && (
                                                    <div className="shrink-0 pl-4 flex items-center gap-3">
                                                        {isRunning && <span className="flex w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>}
                                                        <LiveClock accumulatedMs={timer.accumulated_ms} lastStartedAt={timer.last_started_at} />
                                                    </div>
                                                )}
                                            </div>

                                            {/* ÁREA EXPANDIDA */}
                                            {isExpanded ? (
                                                <div className="animate-fadeIn space-y-4">
                                                    <input type="text" value={timer.title} onChange={e => autoSave(timer.id, { title: e.target.value })} className="w-full bg-zinc-50 dark:bg-zinc-950 text-sm font-bold p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 outline-none" />
                                                    
                                                    <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 cursor-text min-h-[100px]">
                                                        <SmartNotesEditor noteId={timer.id} initialContent={timer.content} onChange={c => autoSave(timer.id, { content: c })} noteFont={noteFont} noteFontSize={noteFontSize} />
                                                    </div>

                                                    {/* DISPLAY DEL RELOJ GIGANTE */}
                                                    <div className="flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-[#1B1B1E] rounded-xl border border-zinc-200 dark:border-zinc-800">
                                                        <LiveClock accumulatedMs={timer.accumulated_ms} lastStartedAt={timer.last_started_at} isLarge={true} />
                                                        
                                                        {/* BOTONES DE CONTROL DE TIEMPO */}
                                                        <div className="flex items-center justify-center gap-4 mt-8">
                                                            {!isRunning ? (
                                                                <button onClick={() => handlePlay(timer.id)} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95">
                                                                    <Play size={18} /> Iniciar / Reanudar
                                                                </button>
                                                            ) : timer.type === 'cycle' ? (
                                                                <button onClick={() => handlePauseCycle(timer.id)} className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95">
                                                                    <Pause size={18} /> Pausar y Marcar Lap
                                                                </button>
                                                            ) : (
                                                                <>
                                                                    <button onClick={() => handleLapRacing(timer.id)} className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95">
                                                                        <Flag size={18} /> Marcar Hito
                                                                    </button>
                                                                    <button onClick={() => handleStopRacing(timer.id)} className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95">
                                                                        <Square size={18} /> Pausar
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-2 opacity-80 pl-11 leading-relaxed" dangerouslySetInnerHTML={{__html: parseMarkdownPreview(timer.content)}} />
                                            )}

                                            {/* LISTA DE LAPS (DISEÑO 2 RENGLONES ESTILO REMINDERS) */}
                                            {timer.laps.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Registro de Laps ({timer.laps.length})</span>
                                                    {timer.laps.map((lap, idx) => (
                                                        <div key={lap.id} className="flex flex-col group p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
                                                            <div className="flex justify-between items-start w-full">
                                                                <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                                                                    <span className="bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-xs">Lap {idx + 1}</span>
                                                                </span>
                                                                <div className="flex items-center text-[12px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                                    + {formatDuration(lap.duration_ms)}
                                                                </div>
                                                            </div>
                                                            <div className="border-t border-zinc-200 dark:border-zinc-700/50 w-full my-2"></div>
                                                            <div className="flex items-center text-[11px] text-zinc-500">
                                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">Inicio: {formatCleanDate(lap.start_time)}</span>
                                                                <span className="mx-2 opacity-50">|</span>
                                                                <span className="font-bold text-amber-600 dark:text-amber-500">Fin: {formatCleanDate(lap.end_time)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* FOOTER ACCIONES */}
                                            {isExpanded && (
                                                <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-6">
                                                    <button onClick={() => deleteTimer(timer.id)} className="text-xs font-bold text-zinc-400 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2">
                                                        <Trash2 size={14} /> Eliminar
                                                    </button>
                                                    <button onClick={() => changeStatus(timer.id, 'history')} className="text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 px-3 py-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center gap-2">
                                                        <ArchiveIcon size={14} /> Archivar Cronómetro
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 3. ARCHIVO (HISTORIAL) */}
                    <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/50 opacity-70">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <HistoryIcon size={16} /> <span className="text-xs font-bold uppercase tracking-widest">Archivo ({history.length})</span>
                        </div>
                        {history.length === 0 ? (
                            <div className="text-sm text-center text-zinc-400 p-4">No hay cronómetros archivados.</div>
                        ) : (
                            <div className="space-y-2">
                                {history.map(t => {
                                    const isExpanded = expandedHistoryIds.has(t.id);
                                    
                                    return (
                                    <div key={t.id} className="flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 transition-colors">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                            
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <button onClick={() => toggleExpandHistory(t.id)} className="p-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-md text-zinc-500 transition-colors" title="Desplegar cronómetro">
                                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 line-through truncate">{t.title || 'Cronómetro finalizado'}</span>
                                            </div>

                                            <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto pl-11 md:pl-0">
                                                <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold shrink-0">
                                                    <span>Total Acumulado: <span className="text-indigo-500 font-mono text-xs">{formatDuration(t.accumulated_ms)}</span></span>
                                                    <span className="opacity-50">|</span>
                                                    <span>Creado: {formatCleanDate(t.created_at)}</span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>
                                                    <button onClick={() => changeStatus(t.id, 'active')} className="p-1.5 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors" title="Restaurar a Activos"><RotateCcw size={16}/></button>
                                                    <button onClick={() => deleteTimer(t.id)} className="p-1.5 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors" title="Eliminar para siempre"><Trash2 size={16}/></button>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Vista expandida del Archivo */}
                                        {isExpanded && (
                                            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 animate-fadeIn space-y-4">
                                                {t.content && (
                                                    <div className="bg-zinc-100/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 opacity-70">
                                                        <div className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed" dangerouslySetInnerHTML={{__html: parseMarkdownPreview(t.content)}} />
                                                    </div>
                                                )}
                                                
                                                <div className="space-y-2">
                                                    {t.laps.map((lap, idx) => (
                                                        <div key={lap.id} className="flex flex-col group p-3 bg-zinc-100/50 dark:bg-zinc-800/30 rounded-xl border border-zinc-100 dark:border-zinc-800/50 opacity-60">
                                                            <div className="flex justify-between items-start w-full">
                                                                <span className="font-bold text-sm text-zinc-500 line-through">Lap {idx + 1}</span>
                                                                <span className="text-[12px] font-mono text-zinc-500">{formatDuration(lap.duration_ms)}</span>
                                                            </div>
                                                            <div className="border-t border-zinc-200 dark:border-zinc-700/50 w-full my-2"></div>
                                                            <div className="flex items-center text-[11px] text-zinc-500 font-bold">
                                                                Inicio: {formatCleanDate(lap.start_time)} <span className="mx-2">|</span> Fin: {formatCleanDate(lap.end_time)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )})}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};