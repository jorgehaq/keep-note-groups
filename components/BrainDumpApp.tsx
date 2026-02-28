import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, Archive as ArchiveIcon, Zap, Play, RotateCcw, PenTool, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { SmartNotesEditor } from '../src/components/editor/SmartNotesEditor';

// --- TYPES ---
type BrainDumpStatus = 'main' | 'active' | 'history';

interface BrainDump {
    id: string;
    title?: string;
    content: string;
    status: BrainDumpStatus;
    user_id: string;
    created_at: string;
    updated_at: string;
}

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

// --- PARSER DE MARKDOWN PARA VISTA PREVIA (OBSIDIAN + CUSTOM) ---
const parseMarkdownPreview = (text: string) => {
    if (!text) return '';
    return text
        .replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\{=([^=}]+)=\}/g, '<mark class="bg-yellow-200/60 dark:bg-yellow-500/40 text-inherit rounded-sm px-1 font-medium">$1</mark>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/_([^_]+)_/g, '<em>$1</em>')
        .replace(/~~([^~]+)~~/g, '<del class="opacity-70">$1</del>')
        .replace(/^&gt;\s+(.*)$/gm, '<span class="border-l-2 border-indigo-400 dark:border-indigo-600 pl-2 ml-1 italic opacity-90 block my-1">$1</span>')
        .replace(/\[\[tr:([^|]+)\|([^\]]+)\]\]/g, '<span class="text-indigo-600 dark:text-indigo-400 font-bold border-b border-indigo-400/50 border-dashed cursor-help" title="$1">$2</span>')
        .replace(/\n/g, '<span class="mx-1 opacity-30 text-[10px]">&para;</span> ');
};

export const BrainDumpApp: React.FC<{ session: Session; noteFont?: string; noteFontSize?: string }> = ({ session, noteFont, noteFontSize }) => {
    const [dumps, setDumps] = useState<BrainDump[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Memoria para expansiones en el Archivo
    const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());
    const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

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
            setDumps(data as BrainDump[]);
        } catch (error: any) {
            console.error("Error cargando Pizarrón:", error.message);
        } finally {
            setLoading(false);
        }
    }, [session.user.id]);

    useEffect(() => { fetchDumps(); }, [fetchDumps]);

    const autoSave = (id: string, updates: Partial<BrainDump>) => {
        setDumps(prev => prev.map(d => d.id === id ? { ...d, ...updates, updated_at: new Date().toISOString() } : d));
        if (saveTimeoutRef.current[id]) clearTimeout(saveTimeoutRef.current[id]);
        saveTimeoutRef.current[id] = setTimeout(async () => {
            await supabase.from('brain_dumps').update(updates).eq('id', id);
        }, 500);
    };

    const createNewDraft = async () => {
        const { data: newMain } = await supabase.from('brain_dumps')
            .insert([{ title: '', content: '', status: 'main', user_id: session.user.id }])
            .select().single();
        if (newMain) setDumps(prev => [newMain as BrainDump, ...prev]);
    };

    const changeStatus = async (id: string, newStatus: BrainDumpStatus) => {
        setDumps(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d));
        await supabase.from('brain_dumps').update({ status: newStatus }).eq('id', id);
    };

    const deleteDump = async (id: string) => {
        if (!window.confirm('¿Eliminar permanentemente este pizarrón?')) return;
        setDumps(prev => prev.filter(d => d.id !== id));
        await supabase.from('brain_dumps').delete().eq('id', id);
    };

    const toggleExpandHistory = (id: string) => setExpandedHistoryIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

    if (loading) return <div className="p-10 text-center animate-pulse text-zinc-500">Cargando Pizarrón...</div>;

    // 🚀 FIX: Fusión lógica. Todo lo que no está en el archivo, es un Pizarrón activo.
    const pizarrones = dumps.filter(d => d.status !== 'history');
    const archivo = dumps.filter(d => d.status === 'history');

    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
                <div className="flex items-center justify-between px-4 md:px-6 py-4">
                    <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-3">
                        <div className="p-2 bg-[#FFD700] rounded-lg text-amber-900 shadow-lg shadow-amber-500/20">
                            <PenTool size={20} />
                        </div>
                        Pizarrón
                    </h1>
                    <button onClick={createNewDraft} className="bg-[#FFD700] hover:bg-[#E5C100] text-amber-950 p-2 rounded-xl shadow-lg shadow-amber-500/20 transition-colors flex items-center gap-2">
                        <Plus size={20} /> <span className="text-sm font-bold hidden sm:inline pr-2">Nuevo Pizarrón</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8 hidden-scrollbar">
                <div className="max-w-4xl mx-auto space-y-12 pb-20">
                    
                    {/* 1. PIZARRONES (PERSISTENTES) */}
                    {pizarrones.length > 0 && (
                        <div className="space-y-6 animate-fadeIn">
                            {pizarrones.map(pizarron => {
                                const createdMs = new Date(pizarron.created_at).getTime();
                                const updatedMs = new Date(pizarron.updated_at).getTime();
                                const isEdited = (updatedMs - createdMs) > 60000;

                                return (
                                <div key={pizarron.id} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 transition-all duration-300 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 focus-within:ring-2 focus-within:ring-indigo-500/50 flex flex-col">
                                    
                                    {/* Título */}
                                    <div className="flex items-center justify-between pr-4">
                                        <input 
                                            type="text" 
                                            placeholder="Título del pizarrón (opcional)" 
                                            value={pizarron.title || ''} 
                                            onChange={e => autoSave(pizarron.id, { title: e.target.value })} 
                                            className="w-full bg-transparent text-xl font-bold text-zinc-800 dark:text-zinc-100 p-4 pb-3 outline-none placeholder-zinc-400" 
                                        />
                                    </div>
                                    <div className="h-px bg-zinc-100 dark:bg-zinc-800/80 mx-4 mb-2" />
                                    
                                    {/* Editor de Notas */}
                                    <div className="mx-4 mb-4 p-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-text min-h-[150px]">
                                        <SmartNotesEditor noteId={pizarron.id} initialContent={pizarron.content} onChange={c => autoSave(pizarron.id, { content: c })} noteFont={noteFont} noteFontSize={noteFontSize} />
                                    </div>
                                    
                                    {/* Footer: Fechas y Acciones */}
                                    <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-2xl border-t border-zinc-200 dark:border-zinc-800">
                                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-zinc-400 pl-2">
                                            <span>Creado: {formatCleanDate(pizarron.created_at)}</span>
                                            {isEdited && (
                                                <>
                                                    <span className="opacity-50">|</span>
                                                    <span>Editado: {formatCleanDate(pizarron.updated_at)}</span>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button onClick={() => deleteDump(pizarron.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors" title="Eliminar permanentemente">
                                                <Trash2 size={18} />
                                            </button>
                                            <button onClick={() => changeStatus(pizarron.id, 'history')} className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-amber-950 bg-[#FFD700] hover:bg-[#E5C100] rounded-xl shadow-lg shadow-amber-500/20 transition-all" title="Archivar pizarrón">
                                                <ArchiveIcon size={14} /> Archivar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}

                    {/* 2. ARCHIVO (HISTORIAL) */}
                    <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/50 opacity-70">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <ArchiveIcon size={16} /> <span className="text-xs font-bold uppercase tracking-widest">Archivo ({archivo.length})</span>
                        </div>
                        {archivo.length === 0 ? (
                            <div className="text-sm text-center text-zinc-400 p-4">El archivo está limpio.</div>
                        ) : (
                            <div className="space-y-2">
                                {archivo.map(a => {
                                    const isExpanded = expandedHistoryIds.has(a.id);
                                    const createdMs = new Date(a.created_at).getTime();
                                    const updatedMs = new Date(a.updated_at).getTime();
                                    const isEdited = (updatedMs - createdMs) > 60000;
                                    
                                    return (
                                    <div key={a.id} className="flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800 transition-colors">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                            
                                            {/* Título y Botón Expandir */}
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <button onClick={() => toggleExpandHistory(a.id)} className="p-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-md text-zinc-500 transition-colors" title="Desplegar pizarrón">
                                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                                <ArchiveIcon size={16} className="text-zinc-400 shrink-0" />
                                                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 line-through truncate">
                                                    {a.title || 'Pizarrón sin título'}
                                                </span>
                                            </div>

                                            {/* Fechas y Acciones en el Archivo */}
                                            <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto pl-11 md:pl-0">
                                                <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold shrink-0">
                                                    <span>Creado: {formatCleanDate(a.created_at)}</span>
                                                    {isEdited && (
                                                        <>
                                                            <span className="opacity-50">|</span>
                                                            <span>Editado: {formatCleanDate(a.updated_at)}</span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>
                                                    <button onClick={() => changeStatus(a.id, 'main')} className="p-1.5 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors" title="Restaurar Pizarrón"><RotateCcw size={16}/></button>
                                                    <button onClick={() => deleteDump(a.id)} className="p-1.5 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors" title="Eliminar para siempre"><Trash2 size={16}/></button>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Vista expandida del Archivo (Opaca) */}
                                        {isExpanded && (
                                            <div className="mt-2 bg-zinc-100/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 opacity-70 animate-fadeIn">
                                                <div className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed" dangerouslySetInnerHTML={{__html: parseMarkdownPreview(a.content)}} />
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