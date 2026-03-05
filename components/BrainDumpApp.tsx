import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, Archive as ArchiveIcon, Zap, Play, RotateCcw, PenTool, ChevronDown, ChevronUp, Maximize2, Minimize2, Bell, Grid, ChevronsDownUp, MoreVertical, ListTodo, CheckSquare, Square, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { KanbanSemaphore } from './KanbanSemaphore';
import { supabase } from '../src/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { SmartNotesEditor } from '../src/components/editor/SmartNotesEditor';
import { ChecklistEditor, parseMarkdownToChecklist, serializeChecklistToMarkdown } from '../src/components/editor/ChecklistEditor';
import { useUIStore } from '../src/lib/store';

// --- TYPES ---
type BrainDumpStatus = 'main' | 'active' | 'history';

interface BrainDump {
    id: string;
    title?: string;
    content: string;
    is_checklist?: boolean;
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
    const { isBraindumpMaximized, setIsBraindumpMaximized, brainDumps: dumps, setBrainDumps: setDumps, showOverdueMarquee, setShowOverdueMarquee, overdueRemindersCount, globalTasks, focusedDumpId, setFocusedDumpId, isDumpTrayOpen, setIsDumpTrayOpen } = useUIStore();
    const [loading, setLoading] = useState(false);
    
    const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
    const hasLoadedOnce = useRef(false);

    // Floating sticky banner refs
    const pizarronHeaderRef = useRef<HTMLDivElement>(null);
    const pizarronContentRef = useRef<HTMLDivElement>(null);
    const [showStickyPizarronTitle, setShowStickyPizarronTitle] = useState(false);

    const PizarronTitleInput = ({ pizarron, onSave }: { pizarron: BrainDump, onSave: (title: string) => void }) => {
        const [tempTitle, setTempTitle] = useState(pizarron.title || '');
        const inputRef = useRef<HTMLInputElement>(null);
        
        useEffect(() => {
            if (document.activeElement !== inputRef.current) {
                setTempTitle(pizarron.title || '');
            }
        }, [pizarron.title]);

        const handleSave = () => {
            if (tempTitle !== (pizarron.title || '')) {
                onSave(tempTitle);
            }
        };

        return (
            <input
                ref={inputRef}
                type="text"
                placeholder="Título del pizarrón (opcional)"
                value={tempTitle}
                onChange={e => setTempTitle(e.target.value)}
                onBlur={handleSave}
                onKeyDown={e => {
                    if (e.key === 'Enter') {
                        handleSave();
                        inputRef.current?.blur();
                    }
                    if (e.key === 'Escape') {
                        setTempTitle(pizarron.title || '');
                        inputRef.current?.blur();
                    }
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        // Find the editor container in the same pizarron card
                        const card = inputRef.current?.closest('div.rounded-2xl');
                        if (card) {
                            const focusable = card.querySelector('.cm-content, input[type="text"]:not([placeholder*="Título"])') as HTMLElement;
                            if (focusable) focusable.focus();
                        }
                    }
                }}
                onClick={e => e.stopPropagation()}
                className="w-full bg-transparent text-xl font-bold text-zinc-800 dark:text-[#C4C7C5] outline-none placeholder-zinc-400 transition-colors p-4 pb-3"
            />
        );
    };




    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Determines if the data is actually rendered so the refs exist
    const hasFocusedPizarron = focusedDumpId !== null && dumps.some(d => d.id === focusedDumpId);

    useEffect(() => {
        const headerEl = pizarronHeaderRef.current;
        const contentEl = pizarronContentRef.current;
        if (!headerEl || !contentEl) return;
        let isHeaderVisible = true;
        let isContentVisible = true;
        const checkVisibility = () => {
            setShowStickyPizarronTitle(!isHeaderVisible && isContentVisible);
        };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.target === headerEl) isHeaderVisible = entry.isIntersecting;
                if (entry.target === contentEl) isContentVisible = entry.isIntersecting;
            });
            checkVisibility();
        }, { root: scrollContainerRef.current, threshold: 0, rootMargin: '0px 0px 0px 0px' });
        observer.observe(headerEl);
        observer.observe(contentEl);
        return () => observer.disconnect();
    }, [focusedDumpId, hasFocusedPizarron]);

    // Close menu on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Cargamos pizarras al montar si el store está vacío
    useEffect(() => {
        if (dumps.length === 0) {
            window.dispatchEvent(new CustomEvent('reload-app-data'));
        } else {
            hasLoadedOnce.current = true;
        }
    }, [dumps.length]);

    // Removed validation effect to prevent focus resets on app switch.
    // Deletion explicitly clears focusedDumpId inside deleteDump.

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
        if (newMain) {
            setFocusedDumpId(newMain.id);
            // El resto de la lista se actualizará vía Realtime
        }
    };

    const changeStatus = async (id: string, newStatus: BrainDumpStatus) => {
        await supabase.from('brain_dumps').update({ status: newStatus }).eq('id', id);
    };

    const deleteDump = async (id: string) => {
        if (!window.confirm('¿Eliminar permanentemente este pizarrón?')) return;
        await supabase.from('brain_dumps').delete().eq('id', id);
        if (focusedDumpId === id) setFocusedDumpId(null);
    };

    const toggleExpandHistory = (id: string) => setExpandedHistoryIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

    if (loading) return <div className="p-10 text-center animate-pulse text-zinc-500">Cargando Pizarrón...</div>;

    // 🚀 FIX: Fusión lógica. Todo lo que no está en el archivo, es un Pizarrón activo.
    const pizarrones = dumps.filter(d => d.status !== 'history');
    const archivo = dumps.filter(d => d.status === 'history');

    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
            <div className={`sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md shrink-0 ${isDumpTrayOpen ? '' : 'border-b border-zinc-200 dark:border-zinc-800 shadow-sm'}`}>
                <div className={`h-[72px] flex items-center justify-between px-4 md:px-6 py-4 ${isDumpTrayOpen ? 'border-b border-zinc-200 dark:border-zinc-800 shadow-sm' : ''}`}>
                    <h1 className="text-xl font-bold text-zinc-800 dark:text-[#C4C7C5] flex items-center gap-3">
                        <div className="h-9 p-2 bg-[#FFD700] rounded-lg text-amber-900 shadow-lg shadow-amber-500/20">
                            <PenTool size={20} />
                        </div>
                        Pizarrón
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

                    {/* Botón Toggle Bandeja de Pizarrones */}
                    {pizarrones.length > 0 && (
                        <button
                            onClick={() => setIsDumpTrayOpen(!isDumpTrayOpen)}
                            className={`h-9 p-2 rounded-xl transition-all active:scale-95 shrink-0 flex items-center gap-2 border ${
                                isDumpTrayOpen 
                                  ? 'bg-[#FFD700] border-[#E5C100] text-amber-950 shadow-md shadow-[#FFD700]/20' 
                                  : 'bg-amber-50 dark:bg-[#FFD700]/10 border-amber-200 dark:border-[#FFD700]/30 text-amber-600 dark:text-[#FFD700] hover:bg-amber-100 dark:hover:bg-[#FFD700]/20'
                            }`}
                            title={isDumpTrayOpen ? "Ocultar Pizarrones" : "Mostrar Pizarrones"}
                        >
                            <ChevronsDownUp size={18} className={`transition-transform duration-300 ${isDumpTrayOpen ? 'rotate-180' : ''}`} />
                             <span className={`text-xs font-bold ${isDumpTrayOpen ? '' : 'text-amber-600 dark:text-[#FFD700]'}`}>{pizarrones.length}</span>
                        </button>
                    )}

                    <button
                      onClick={() => setIsBraindumpMaximized(!isBraindumpMaximized)}
                      className="h-9 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-400 transition-all active:scale-95 shrink-0"
                      title={isBraindumpMaximized ? "Minimizar" : "Maximizar"}
                    >
                      {isBraindumpMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    <button onClick={createNewDraft} className="h-9 bg-[#FFD700] hover:bg-[#E5C100] text-amber-950 px-4 py-2 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 active:scale-95 shrink-0">
                        <Plus size={20} /> <span className="text-sm font-bold hidden sm:inline pr-2 text-amber-950">Nuevo Pizarrón</span>
                    </button>
                </div>
                </div>

                {/* FRANJA DE PIZARRONES (ACCESOS DIRECTOS) */}
                {isDumpTrayOpen && pizarrones.length > 0 && (
                    <div className="pt-4 px-4 pb-4 bg-[#09090B] dark:bg-[#09090B]">
                        <div className="flex flex-wrap justify-center gap-2.5">
                             {pizarrones.map(p => {
                                 const isFocused = focusedDumpId === p.id;
                                 const linkedTask = globalTasks?.find(t => t.id === p.id);
                                 let dotColorClass = null;
                                 if (linkedTask) {
                                     switch (linkedTask.status) {
                                         case 'backlog': dotColorClass = 'bg-[#9E9E9E]'; break;
                                         case 'todo': dotColorClass = 'bg-[#FBC02D]'; break;
                                         case 'in_progress': dotColorClass = 'bg-[#1E88E5]'; break;
                                         case 'done': dotColorClass = 'bg-[#43A047]'; break;
                                     }
                                 }

                                 return (
                                     <button
                                         key={p.id}
                                         onClick={() => setFocusedDumpId(isFocused ? null : p.id)}
                                         className={`relative flex items-center justify-center px-4 py-2 text-[11px] font-medium rounded-xl transition-all shrink-0 ${
                                             isFocused
                                                 ? 'bg-[#FFD700] text-amber-950 shadow-md shadow-amber-500/20 scale-[1.02]'
                                                 : 'bg-white/10 dark:bg-white/10 text-[#A1A1AA] hover:text-white hover:bg-white/20'
                                         }`}
                                     >
                                         <span className="whitespace-nowrap">{p.title || 'Pizarrón Sin Título'}</span>
                                         {dotColorClass && (
                                             <div 
                                               className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border border-[#9F9FA8]/50 z-10 shadow-sm transition-transform hover:scale-110 ${dotColorClass}`} 
                                               title={`Estado Kanban`}
                                             />
                                         )}
                                     </button>
                                 );
                             })}
                        </div>
                    </div>
                )}
            </div>

            <div ref={scrollContainerRef} className={`flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 px-4 pb-4 ${isDumpTrayOpen && pizarrones.length > 0 ? 'pt-0' : 'pt-4'} hidden-scrollbar`}>
                <div className={`${isBraindumpMaximized ? 'max-w-full' : 'max-w-4xl'} mx-auto flex flex-col gap-12 pb-20`}>
                    
                    {/* 1. PIZARRONES (PERSISTENTES - FILTRADO POR FOCO) */}
                    {focusedDumpId && pizarrones.some(p => p.id === focusedDumpId) && (
                        <div className="space-y-6 animate-fadeIn">
                            {pizarrones.filter(p => p.id === focusedDumpId).map(pizarron => {
                                const createdMs = new Date(pizarron.created_at).getTime();
                                const updatedMs = new Date(pizarron.updated_at).getTime();
                                const isEdited = (updatedMs - createdMs) > 60000;

                                return (
                                <div key={pizarron.id} className="m-1 bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 transition-all duration-300 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 focus-within:ring-2 focus-within:ring-indigo-500/50 flex flex-col">
                                    
                                    {/* Pizarron header: title + action buttons */}
                                    <div ref={pizarronHeaderRef} className="flex items-center justify-between pr-3 pt-1">
                                        <div className="flex flex-col min-w-0 justify-center w-full flex-1">
                                            <div className="relative flex w-full">
                                                <PizarronTitleInput pizarron={pizarron} onSave={(title) => autoSave(pizarron.id, { title })} />
                                            </div>
                                        </div>
                                        {/* Action buttons: Kanban always visible, rest in 3-dot */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            <KanbanSemaphore sourceId={pizarron.id} sourceTitle={pizarron.title || 'Pizarrón sin título'} />
                                            <div className="relative" ref={openMenuId === pizarron.id ? menuRef : undefined}>
                                                <button
                                                    onClick={() => setOpenMenuId(openMenuId === pizarron.id ? null : pizarron.id)}
                                                    className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                                ><MoreVertical size={16} /></button>
                                                {openMenuId === pizarron.id && (
                                                    <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-zinc-800 shadow-xl rounded-lg border border-zinc-200 dark:border-zinc-700 p-1 flex flex-col gap-0.5 min-w-[180px] animate-fadeIn">
                                                        <button onClick={() => { 
                                                            const willBeChecklist = !pizarron.is_checklist;
                                                            let contentToSave = pizarron.content;
                                                            if (willBeChecklist) {
                                                                contentToSave = serializeChecklistToMarkdown(parseMarkdownToChecklist(pizarron.content));
                                                            }
                                                            autoSave(pizarron.id, { is_checklist: willBeChecklist, content: contentToSave }); 
                                                            setOpenMenuId(null); 
                                                        }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${pizarron.is_checklist ? 'text-[#1F3760] dark:text-blue-400 bg-blue-50 dark:bg-[#1F3760]/20' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}><ListTodo size={14} />{pizarron.is_checklist ? 'Quitar Checklist' : 'Hacer Checklist'}</button>
                                                        <div className="border-t border-zinc-100 dark:border-zinc-700 my-0.5" />
                                                        <button onClick={() => { changeStatus(pizarron.id, 'history'); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><ArchiveIcon size={14} />Archivar</button>
                                                        <button onClick={() => { deleteDump(pizarron.id); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 text-sm w-full text-left rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={14} />Eliminar</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Floating sticky title banner */}
                                    <div ref={pizarronContentRef} className="relative">
                                        {showStickyPizarronTitle && (
                                            <div className={`sticky ${isDumpTrayOpen && pizarrones.length > 0 ? 'top-4' : 'top-0'} left-0 right-0 z-[40] flex justify-center pointer-events-none animate-fadeIn px-4 pt-0`}>
                                                <div onClick={(e) => { e.stopPropagation(); pizarronHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="bg-white/95 dark:bg-zinc-100/95 backdrop-blur-md text-zinc-900 dark:text-zinc-900 px-5 py-1.5 rounded-full shadow-lg shadow-black/10 text-[13px] font-bold flex items-center gap-2 pointer-events-auto cursor-pointer active:scale-95 transition-all border border-zinc-200/50 dark:border-zinc-300 w-auto max-w-[90%] sm:max-w-[400px] hover:shadow-xl"><span className="truncate">{pizarron.title || 'Pizarrón sin título'}</span><ChevronUp size={14} className="opacity-70 shrink-0" /></div>
                                            </div>
                                        )}

                                        <div className="mx-4 mb-4 p-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-text min-h-[150px]">
                                            {pizarron.is_checklist ? (
                                                <ChecklistEditor idPrefix={pizarron.id} initialContent={pizarron.content} onUpdate={(c) => autoSave(pizarron.id, { content: c })} />
                                            ) : (
                                                <SmartNotesEditor noteId={pizarron.id} initialContent={pizarron.content} onChange={c => autoSave(pizarron.id, { content: c })} noteFont={noteFont} noteFontSize={noteFontSize} />
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Footer: Fechas */}
                                    <div className="flex items-center pl-3 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-2xl border-t border-zinc-200 dark:border-zinc-800">
                                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-zinc-400 pl-2">
                                            <span>Creado: {formatCleanDate(pizarron.created_at)}</span>
                                            {isEdited && (
                                                <>
                                                    <span className="opacity-50">|</span>
                                                    <span>Editado: {formatCleanDate(pizarron.updated_at)}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}

                    {/* 2. ARCHIVO (HISTORIAL) */}
                    <div className="space-y-4 opacity-70">
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