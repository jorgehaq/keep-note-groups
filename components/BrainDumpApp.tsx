import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Send, Zap, Trash2, Inbox, Archive, History, Sparkles } from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { KanbanSemaphore } from './KanbanSemaphore';
// IMPORTAMOS EL NUEVO EDITOR INTELIGENTE
import { SmartNotesEditor } from '../src/components/editor/SmartNotesEditor';

type DumpStatus = 'main' | 'stash' | 'history';

interface BrainDump {
    id: string;
    title?: string;
    content: string;
    status: DumpStatus;
    created_at: string;
    updated_at?: string;
}

interface BrainDumpAppProps {
    session: Session;
    noteFont?: string;
    noteFontSize?: string;
}

export const BrainDumpApp: React.FC<BrainDumpAppProps> = ({ session, noteFont = 'sans', noteFontSize = 'medium' }) => {
    const [dumps, setDumps] = useState<BrainDump[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(300);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Ref para el debounce de la base de datos
    const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
    
    // MAGIA ANTI-LAG: Ref para mantener siempre la última versión del estado 
    // sin necesidad de leer el DOM con document.getElementById
    const dumpsRef = useRef(dumps);
    useEffect(() => { dumpsRef.current = dumps; }, [dumps]);

    const renderTimestamps = (created: string, updated?: string) => {
        const formatOpts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
        const cDate = new Date(created).toLocaleString('es-ES', formatOpts);
        const uDate = updated ? new Date(updated).toLocaleString('es-ES', formatOpts) : cDate;

        return (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-[9px] font-mono text-zinc-400">
                <span>🌱 Creado: {cDate}</span>
                {updated && updated !== created && <span>✏️ Editado: {uDate}</span>}
            </div>
        );
    };

    const fetchDumps = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('brain_dumps')
                .select('*')
                .eq('user_id', session.user.id)
                .order('updated_at', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;

            let currentDumps = data as BrainDump[];

            // Regla de Oro: Siempre debe existir al menos un volcado 'main'
            const mainExists = currentDumps.some(d => d.status === 'main');
            if (!mainExists) {
                const { data: newMain, error: createError } = await supabase
                    .from('brain_dumps')
                    .insert([{
                        content: '',
                        user_id: session.user.id,
                        status: 'main'
                    }])
                    .select()
                    .single();

                if (createError) throw createError;
                if (newMain) {
                    currentDumps = [newMain as BrainDump, ...currentDumps];
                }
            }
            setDumps(currentDumps);
        } catch (err: any) {
            console.error('Error fetching dumps:', err.message);
        } finally {
            setLoading(false);
        }
    }, [session.user.id]);

    useEffect(() => {
        fetchDumps();
    }, [fetchDumps]);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isTimerRunning && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            const main = dumps.find(d => d.status === 'main');
            if (main) commitToHistory(main.id);
        }
        return () => clearInterval(timer);
    }, [isTimerRunning, timeLeft, dumps]);

    const autoSave = (id: string, updates: { content?: string; title?: string }) => {
        const now = new Date().toISOString();
        // 1. Actualizamos el estado local de React
        setDumps(prev => prev.map(d => d.id === id ? { ...d, ...updates, updated_at: now } : d));
        setSyncStatus('saving');

        // 2. Debounce a la Base de Datos (400ms)
        if (saveTimeoutRef.current[id]) {
            clearTimeout(saveTimeoutRef.current[id]);
        }

        saveTimeoutRef.current[id] = setTimeout(async () => {
            try {
                const { error } = await supabase
                    .from('brain_dumps')
                    .update({ ...updates, updated_at: now })
                    .eq('id', id);
                if (error) throw error;
                setSyncStatus('saved');
                setTimeout(() => setSyncStatus(current => current === 'saved' ? 'idle' : current), 2000);
            } catch (err: any) {
                console.error('Error en autoSave:', err.message);
            } finally {
                delete saveTimeoutRef.current[id];
            }
        }, 400);
    };

    const stashMain = () => {
        // Usamos un pequeño timeout para darle tiempo al editor de hacer su 'blur' y pasar el texto actualizado a React
        setTimeout(async () => {
            const main = dumpsRef.current.find(d => d.status === 'main');
            if (!main || !main.content.trim()) return;

            if (saveTimeoutRef.current[main.id]) {
                clearTimeout(saveTimeoutRef.current[main.id]);
                delete saveTimeoutRef.current[main.id];
            }

            const now = new Date().toISOString();

            try {
                const { error } = await supabase
                    .from('brain_dumps')
                    .update({
                        status: 'stash',
                        content: main.content,
                        updated_at: now
                    })
                    .eq('id', main.id);

                if (error) throw error;
                await fetchDumps();
            } catch (err: any) {
                console.error('Error in stashMain:', err.message);
                alert('Error al guardar borrador: ' + err.message);
            }
        }, 150);
    };

    const commitToHistory = (id: string) => {
        setTimeout(async () => {
            const dump = dumpsRef.current.find(d => d.id === id);
            if (!dump || !dump.content.trim()) return;

            if (saveTimeoutRef.current[id]) {
                clearTimeout(saveTimeoutRef.current[id]);
                delete saveTimeoutRef.current[id];
            }

            const now = new Date().toISOString();

            try {
                const { error } = await supabase
                    .from('brain_dumps')
                    .update({
                        status: 'history',
                        content: dump.content,
                        updated_at: now
                    })
                    .eq('id', id);

                if (error) throw error;

                if (dump.status === 'main') {
                    setIsTimerRunning(false);
                    setTimeLeft(300);
                }
                await fetchDumps();
            } catch (err: any) {
                console.error('Error in commitToHistory:', err.message);
                alert('Error al archivar sesión: ' + err.message);
            }
        }, 150);
    };

    const reviveToMain = (id: string) => {
        setTimeout(async () => {
            const currentDumps = dumpsRef.current;
            const main = currentDumps.find(d => d.status === 'main');

            try {
                // Si la pizarra principal actual tiene texto, la convertimos en stash primero para no perderla
                if (main) {
                    if (main.content.trim()) {
                        await supabase
                            .from('brain_dumps')
                            .update({ status: 'stash', content: main.content, updated_at: new Date().toISOString() })
                            .eq('id', main.id);
                    } else {
                        await supabase.from('brain_dumps').delete().eq('id', main.id);
                    }
                }

                // Revivimos el borrador o historial a principal
                const { error } = await supabase
                    .from('brain_dumps')
                    .update({ status: 'main', updated_at: new Date().toISOString() })
                    .eq('id', id);

                if (error) throw error;
                await fetchDumps();
            } catch (err: any) {
                console.error('Error in reviveToMain:', err.message);
                alert('Error al revivir sesión: ' + err.message);
            }
        }, 150);
    };

    const handleDelete = async (id: string) => {
        const originalDumps = [...dumps];
        setDumps(prev => prev.filter(d => d.id !== id));

        try {
            const { error } = await supabase.from('brain_dumps').delete().eq('id', id);
            if (error) throw error;
        } catch (err: any) {
            console.error('Error in handleDelete:', err.message);
            alert('Error al eliminar borrador: ' + err.message);
            setDumps(originalDumps);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const mainDump = dumps.find(d => d.status === 'main');
    const stashes = dumps.filter(d => d.status === 'stash');
    const history = dumps.filter(d => d.status === 'history');

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 px-4 py-6 md:p-8 overflow-hidden animate-fadeIn">
            <div className="max-w-4xl mx-auto w-full flex flex-col h-full overflow-hidden">

                {/* Header View */}
                <div className="flex items-center gap-2 mb-6 shrink-0">
                    <div className="w-10 h-10 bg-[#1F3760] rounded-xl flex items-center justify-center shadow-lg shadow-[#1F3760]/20">
                        <Zap className="text-amber-400 fill-current" size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 italic leading-tight">El Rayo</h2>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Patio de Recreo mental</p>
                    </div>
                    <div className="ml-auto flex items-center gap-4">
                        {syncStatus === 'saving' && <span className="text-[10px] text-amber-500 font-bold animate-pulse">Guardando...</span>}
                        {syncStatus === 'saved' && <span className="text-[10px] text-emerald-500 font-bold">Guardado</span>}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto hidden-scrollbar pr-1 space-y-10 pb-20">

                    {/* Level 1: PIZARRA PRINCIPAL */}
                    {mainDump && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                                    <Sparkles size={14} className="text-[#1F3760]" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Pizarra Principal</span>
                                </div>
                                {mainDump.content.trim() !== '' && renderTimestamps(mainDump.created_at, mainDump.updated_at)}
                            </div>

                            <input
                                type="text"
                                value={mainDump.title || ''}
                                onChange={(e) => autoSave(mainDump.id, { title: e.target.value })}
                                placeholder="Título del volcado (opcional)..."
                                className="w-full bg-transparent text-xl font-bold text-zinc-800 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-700 border-none outline-none mb-3 px-6"
                            />

                            {/* REEMPLAZO POR EL EDITOR INTELIGENTE */}
                            <div className="bg-white dark:bg-zinc-900 shadow-xl shadow-zinc-200/50 dark:shadow-none rounded-2xl p-6 w-full min-h-[16rem] border border-transparent focus-within:border-[#1F3760]/30 transition-all overflow-visible flex flex-col cursor-text">
                                <SmartNotesEditor
                                    noteId={mainDump.id}
                                    initialContent={mainDump.content}
                                    onChange={(newContent) => autoSave(mainDump.id, { content: newContent })}
                                    noteFont={noteFont}
                                    noteFontSize={noteFontSize}
                                />
                                {mainDump.content.trim() === '' && (
                                    <div className="text-zinc-400 mt-2 pointer-events-none text-sm absolute">Escribe tu volcado mental aquí... se guarda solo.</div>
                                )}
                            </div>

                            <div className="flex items-center justify-between gap-3 bg-white/50 dark:bg-zinc-900/50 p-2 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                                <button
                                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${isTimerRunning
                                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                                        }`}
                                >
                                    {isTimerRunning ? (
                                        <>
                                            <Square size={14} className="fill-current" />
                                            <span className="font-mono">{formatTime(timeLeft)}</span>
                                            <span>Detener</span>
                                        </>
                                    ) : (
                                        <>
                                            <Play size={14} className="fill-current" />
                                            <span>Modo 5 Minutos</span>
                                        </>
                                    )}
                                </button>

                                <div className="flex items-center gap-2">
                                    <div className="flex items-center justify-center p-2.5 bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 mr-2 hover:border-indigo-500/50 transition-colors">
                                        <KanbanSemaphore sourceId={mainDump.id} sourceTitle={mainDump.title || 'Volcado principal'} />
                                    </div>

                                    <button
                                        onClick={stashMain}
                                        disabled={!mainDump.content.trim()}
                                        className="flex items-center gap-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all disabled:opacity-30"
                                        title="Guardar como Borrador"
                                    >
                                        <Inbox size={14} />
                                        <span>Stash</span>
                                    </button>

                                    <button
                                        onClick={() => commitToHistory(mainDump.id)}
                                        disabled={!mainDump.content.trim()}
                                        className="flex items-center gap-2 bg-[#1F3760] text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-[#152643] transition-all disabled:opacity-30 shadow-lg shadow-[#1F3760]/20"
                                    >
                                        <Send size={14} />
                                        <span>Soltar Juguete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Level 2: STASHES */}
                    {stashes.length > 0 && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="flex items-center gap-2 text-zinc-400">
                                <Inbox size={14} />
                                <span className="text-xs font-bold uppercase tracking-wider">Borradores Activos ({stashes.length})</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {stashes.map(stash => (
                                    <div key={stash.id} className="group bg-white dark:bg-zinc-900 p-5 rounded-2xl transition-all duration-500 ease-in-out border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col">

                                        {/* Header Stash */}
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-tighter bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                                                <Inbox size={10} /> Borrador
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <KanbanSemaphore sourceId={stash.id} sourceTitle={stash.title || 'Borrador sin título'} />
                                                <button
                                                    onClick={() => handleDelete(stash.id)}
                                                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Eliminar borrador"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {stash.title && <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 mb-2">{stash.title}</h4>}
                                        
                                        {/* EDITOR PARA LOS BORRADORES */}
                                        <div className="w-full max-h-48 md:max-h-60 overflow-y-auto hidden-scrollbar cursor-text mt-2 mb-4 flex-1">
                                            <SmartNotesEditor
                                                noteId={stash.id}
                                                initialContent={stash.content}
                                                onChange={(newContent) => autoSave(stash.id, { content: newContent })}
                                                noteFont={noteFont}
                                                noteFontSize={noteFontSize}
                                            />
                                        </div>

                                        {/* Footer Stash */}
                                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800/50 w-full">
                                            {renderTimestamps(stash.created_at, stash.updated_at)}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => reviveToMain(stash.id)}
                                                    className="flex items-center gap-1.5 bg-[#1F3760]/10 text-[#1F3760] dark:bg-[#5c7eb1]/20 dark:text-[#5c7eb1] px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase hover:bg-[#1F3760] hover:text-white dark:hover:bg-[#5c7eb1] dark:hover:text-zinc-900 transition-colors"
                                                    title="Mover a la pizarra principal"
                                                >
                                                    <Zap size={10} />
                                                    Revivir
                                                </button>
                                                <button
                                                    onClick={() => commitToHistory(stash.id)}
                                                    className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                                    title="Archivar"
                                                >
                                                    <Send size={10} />
                                                    Archivar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Level 3: HISTORIAL (Modo Lectura Crudo, sin editor para preservar estado) */}
                    <div className="space-y-4 animate-fadeIn">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <History size={14} />
                            <span className="text-xs font-bold uppercase tracking-wider">Historial</span>
                        </div>
                        {history.length === 0 ? (
                            <div className="py-12 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl flex flex-col items-center justify-center text-zinc-400">
                                <Archive size={24} className="mb-2 opacity-20" />
                                <p className="text-[11px] font-medium uppercase tracking-tighter">Sin registros archivados</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {history.map((h) => (
                                    <div
                                        key={h.id}
                                        className="group bg-white dark:bg-zinc-900 p-5 rounded-2xl transition-all duration-500 ease-in-out border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5"
                                    >
                                        {/* Header Historial */}
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-tighter bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                                                <History size={10} /> Archivado
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <KanbanSemaphore sourceId={h.id} sourceTitle={h.title || 'Volcado archivado'} />
                                                <button
                                                    onClick={() => reviveToMain(h.id)}
                                                    className="p-1.5 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                                    title="Revivir a la pizarra"
                                                >
                                                    <Zap size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(h.id)}
                                                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Eliminar permanentemente"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Contenido (Solo Lectura) */}
                                        <div className="max-h-48 overflow-y-auto hidden-scrollbar">
                                            {h.title && <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 mb-2">{h.title}</h4>}
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
                                                {h.content}
                                            </p>
                                        </div>

                                        {/* Footer Historial */}
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/50 w-full transition-opacity">
                                            {renderTimestamps(h.created_at, h.updated_at)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};