import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Send, Zap, Trash2, Clock, Inbox, Archive, History, Sparkles } from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';

type DumpStatus = 'main' | 'stash' | 'history';

interface BrainDump {
    id: string;
    content: string;
    status: DumpStatus;
    created_at: string;
    updated_at?: string;
}

interface BrainDumpAppProps {
    session: Session;
}

export const BrainDumpApp: React.FC<BrainDumpAppProps> = ({ session }) => {
    const [dumps, setDumps] = useState<BrainDump[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(300);
    const [isTimerRunning, setIsTimerRunning] = useState(false);

    // For debounced autosave
    const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
    // For Tab key cursor restoration
    const cursorRef = useRef<{ id: string, position: number } | null>(null);

    const autoExpand = (el: HTMLTextAreaElement) => {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    };

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

            // Rule of Gold: Maintain exactly one 'main' dump
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

    // Restore cursor position after Tab key insertion
    useEffect(() => {
        if (cursorRef.current) {
            const { id, position } = cursorRef.current;
            const el = document.getElementById(`textarea-${id}`) as HTMLTextAreaElement;
            if (el) {
                el.setSelectionRange(position, position);
                el.focus();
            }
            cursorRef.current = null;
        }
    }, [dumps]);

    useEffect(() => {
        // Initial expansion for all visible textareas
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(ta => autoExpand(ta as HTMLTextAreaElement));
    }, [dumps, loading]);

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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, id: string) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const end = target.selectionEnd;

            const dump = dumps.find(d => d.id === id);
            if (!dump) return;

            const newValue = dump.content.substring(0, start) + "\t" + dump.content.substring(end);

            cursorRef.current = { id, position: start + 1 };
            autoSave(id, newValue);
        }
    };

    const autoSave = (id: string, newContent: string) => {
        const now = new Date().toISOString();
        // 1. Update local state immediately for UI responsiveness
        setDumps(prev => prev.map(d => d.id === id ? { ...d, content: newContent, updated_at: now } : d));

        // 2. Debounce the DB update
        if (saveTimeoutRef.current[id]) {
            clearTimeout(saveTimeoutRef.current[id]);
        }

        saveTimeoutRef.current[id] = setTimeout(async () => {
            try {
                const { error } = await supabase
                    .from('brain_dumps')
                    .update({ content: newContent, updated_at: now })
                    .eq('id', id);
                if (error) throw error;
            } catch (err: any) {
                console.error('Error in autoSave:', err.message);
            } finally {
                delete saveTimeoutRef.current[id];
            }
        }, 400);
    };

    const stashMain = async () => {
        const main = dumps.find(d => d.status === 'main');
        if (!main) return;

        // EMERGENCY: Read directly from DOM to avoid state race conditions
        const textarea = document.getElementById(`textarea-${main.id}`) as HTMLTextAreaElement;
        const currentContent = textarea ? textarea.value : main.content;

        if (!currentContent.trim()) return;

        // Clear any pending autosave for this ID to avoid race conditions
        if (saveTimeoutRef.current[main.id]) {
            clearTimeout(saveTimeoutRef.current[main.id]);
            delete saveTimeoutRef.current[main.id];
        }

        const now = new Date().toISOString();

        try {
            // 1. Convert main to stash and ensure content is updated
            const { error } = await supabase
                .from('brain_dumps')
                .update({
                    status: 'stash',
                    content: currentContent,
                    updated_at: now
                })
                .eq('id', main.id);

            if (error) throw error;

            // 2. Re-trigger fetch to create new main and update list
            await fetchDumps();
        } catch (err: any) {
            console.error('Error in stashMain:', err.message);
            alert('Error al guardar borrador: ' + err.message);
        }
    };

    const commitToHistory = async (id: string) => {
        const dump = dumps.find(d => d.id === id);
        if (!dump) return;

        // EMERGENCY: Read directly from DOM to avoid state race conditions
        const textarea = document.getElementById(`textarea-${id}`) as HTMLTextAreaElement;
        const currentContent = textarea ? textarea.value : dump.content;

        if (!currentContent.trim()) return;

        // Clear any pending autosave for this ID
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
                    content: currentContent,
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
    };

    const reviveFromHistory = async (historyId: string) => {
        const main = dumps.find(d => d.status === 'main');

        try {
            // 1. If main has content, stash it first so we don't lose it
            if (main) {
                const mainTextarea = document.getElementById(`textarea-${main.id}`) as HTMLTextAreaElement;
                const mainContent = mainTextarea ? mainTextarea.value : main.content;

                if (mainContent.trim()) {
                    await supabase
                        .from('brain_dumps')
                        .update({ status: 'stash', content: mainContent, updated_at: new Date().toISOString() })
                        .eq('id', main.id);
                } else {
                    await supabase.from('brain_dumps').delete().eq('id', main.id);
                }
            }

            // 2. Revive history item to main
            const { error } = await supabase
                .from('brain_dumps')
                .update({ status: 'main', updated_at: new Date().toISOString() })
                .eq('id', historyId);

            if (error) throw error;
            await fetchDumps();
        } catch (err: any) {
            console.error('Error in reviveFromHistory:', err.message);
            alert('Error al revivir sesión: ' + err.message);
        }
    };

    const handleDelete = async (id: string) => {
        const originalDumps = [...dumps];
        // Optimistic update
        setDumps(prev => prev.filter(d => d.id !== id));

        try {
            const { error } = await supabase
                .from('brain_dumps')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (err: any) {
            console.error('Error in handleDelete:', err.message);
            alert('Error al eliminar borrador: ' + err.message);
            // Revert on error
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
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Patio de Recreomental</p>
                    </div>
                    <div className="ml-auto flex items-center gap-4">
                        {Object.keys(saveTimeoutRef.current).length > 0 && (
                            <span className="text-[10px] text-amber-500 font-bold animate-pulse">Guardando...</span>
                        )}
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

                            <textarea
                                key={mainDump.id}
                                id={`textarea-${mainDump.id}`}
                                autoFocus
                                value={mainDump.content}
                                onChange={(e) => {
                                    autoSave(mainDump.id, e.target.value);
                                    autoExpand(e.target);
                                }}
                                onKeyDown={(e) => handleKeyDown(e, mainDump.id)}
                                placeholder="Escribe tu volcado mental aquí... se guarda solo."
                                className="bg-white dark:bg-zinc-900 shadow-xl shadow-zinc-200/50 dark:shadow-none rounded-2xl p-6 w-full min-h-[16rem] resize-none outline-none text-lg text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 border border-transparent focus:border-[#1F3760]/30 transition-all font-sans leading-relaxed overflow-hidden"
                                style={{ height: 'auto' }}
                            />

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
                                    <div key={stash.id} className="flex flex-col gap-2 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 transition-all hover:shadow-md">
                                        <textarea
                                            key={stash.id}
                                            id={`textarea-${stash.id}`}
                                            value={stash.content}
                                            onChange={(e) => {
                                                autoSave(stash.id, e.target.value);
                                                autoExpand(e.target);
                                            }}
                                            onKeyDown={(e) => handleKeyDown(e, stash.id)}
                                            className="w-full max-h-48 bg-transparent md:max-h-60 resize-none outline-none text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 p-0 overflow-y-auto hidden-scrollbar"
                                            placeholder="Borrador vacío..."
                                            style={{ height: 'auto' }}
                                        />
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-50 dark:border-zinc-800/50">
                                            {renderTimestamps(stash.created_at, stash.updated_at)}
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleDelete(stash.id)}
                                                    className="p-1 text-zinc-300 hover:text-red-500 transition-colors"
                                                    title="Eliminar borrador"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => commitToHistory(stash.id)}
                                                    className="flex items-center gap-1.5 text-[#1F3760] dark:text-[#5c7eb1] font-bold text-[10px] uppercase hover:underline"
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

                    {/* Level 3: HISTORIAL */}
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
                            <div className="space-y-3">
                                {history.map((h) => (
                                    <div
                                        key={h.id}
                                        className="group relative bg-zinc-100 dark:bg-zinc-900/30 p-5 rounded-2xl border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 hover:-translate-y-1 hover:shadow-lg hover:shadow-zinc-200/50 dark:hover:shadow-black/50 transition-all duration-300"
                                    >
                                        <div className="max-h-48 overflow-y-auto hidden-scrollbar">
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
                                                {h.content}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-200/50 dark:border-zinc-800/30 transition-opacity">
                                            {renderTimestamps(h.created_at, h.updated_at)}
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => reviveFromHistory(h.id)}
                                                    className="flex items-center gap-1.5 bg-[#1F3760]/10 text-[#1F3760] dark:bg-[#5c7eb1]/20 dark:text-[#5c7eb1] px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase hover:bg-[#1F3760] hover:text-white dark:hover:bg-[#5c7eb1] dark:hover:text-zinc-900 transition-colors"
                                                >
                                                    <Zap size={10} />
                                                    Revivir
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(h.id)}
                                                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Eliminar permanentemente"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
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

