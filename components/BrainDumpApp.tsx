import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus, Trash2, Archive as ArchiveIcon, Zap, Play, RotateCcw, PenTool, ChevronDown, ChevronUp, Maximize2, Minimize2, Bell, Grid, ChevronsDownUp, Pin, MoreVertical, ListTodo, CheckSquare, Square, GripVertical, Search, X, ChevronLeft, ChevronRight, ArrowUpRight, Download, ArrowUpDown, Calendar, Type, Check, Wind, Sparkles, PenLine, FileText, GitBranch, Loader2, CloudCheck, KanbanSquare, ListPlus, Hash, Clock, History, Columns, Rows } from 'lucide-react';

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { KanbanSemaphore } from './KanbanSemaphore';
import { PizarronLinkerModal } from './PizarronLinkerModal';
import { supabase } from '../src/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { BrainDump, Group, NoteFont, Summary } from '../types';
import { SmartNotesEditor, SmartNotesEditorRef } from '../src/components/editor/SmartNotesEditor';
import { ChecklistEditor, ChecklistEditorRef, parseMarkdownToChecklist, serializeChecklistToMarkdown, serializeChecklistToPlainMarkdown } from '../src/components/editor/ChecklistEditor';
import { useUIStore } from '../src/lib/store';
import { useBrainDumpTree } from '../src/lib/useBrainDumpTree';
import { useBrainDumpSummaries } from '../src/lib/useBrainDumpSummaries';
import { BrainDumpAIPanel } from './BrainDumpAIPanel';
import { BrainDumpBreadcrumb } from './BrainDumpBreadcrumb';

// --- UTILS ---
const formatCleanDate = (isoString?: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? ' PM' : ' AM';
    hours = hours % 12 || 12;
    return (
        <span className="text-[9px] sm:text-[10px] text-center sm:text-left block sm:inline font-medium whitespace-nowrap">
            {day}/{month}/{year}, {hours.toString().padStart(2, '0')}:{minutes} {ampm}
        </span>
    );
};

const highlightText = (text: string, highlight?: string): React.ReactNode => {
    if (!highlight || !highlight.trim()) return text;
    const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, index) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={index} className="bg-yellow-200 dark:bg-yellow-500/40 text-yellow-900 dark:text-yellow-100 px-0.5 font-medium">
                {part}
            </mark>
        ) : (
            part
        )
    );
};

// ─── SUMMARY TAB CONTENT ─────────────────────────────────────────────────────
const SummaryTabContent: React.FC<{
    summary: Summary;
    noteFont?: string;
    noteFontSize?: string;
    noteLineHeight?: string;
    searchQuery?: string;
    onDelete: (id: string) => void;
    updateScratchpad: (id: string, text: string) => void;
    updateContent: (id: string, text: string) => void;
    showScratch: boolean;
    setShowScratch: (val: boolean | ((v: boolean) => boolean)) => void;
    showLineNumbers?: boolean;
    triggerScrollToActive: () => void;
    splitRatio: number;
    onDividerMouseDown: (e: React.MouseEvent) => void;
}> = ({ summary, noteFont, noteFontSize, noteLineHeight, searchQuery, onDelete, updateScratchpad, updateContent, showScratch, setShowScratch, showLineNumbers, triggerScrollToActive, splitRatio, onDividerMouseDown }) => {
    const scratchRef = useRef<SmartNotesEditorRef>(null);
    const [localScratch, setLocalScratch] = useState(summary.scratchpad || '');
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const forcedOrientation = useUIStore(s => s.forcedPizarronOrientation);
    const layoutCol = forcedOrientation ? forcedOrientation === 'horizontal' : isMobile;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    const handleScratchChange = (text: string) => {
        setLocalScratch(text);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => updateScratchpad(summary.id, text), 1200);
    };

    return (
        <div
            onFocusCapture={triggerScrollToActive}
            onClickCapture={triggerScrollToActive}
            className={`flex-1 flex min-h-0 ${layoutCol ? 'flex-col' : 'flex-row'} gap-3`}
        >
            {/* Main content editor */}
            <div className={`flex-1 flex flex-col min-h-0 bg-violet-50 dark:bg-[#131314] rounded-2xl border focus-within:border-violet-400 dark:focus-within:border-violet-500/60 transition-colors ${searchQuery?.trim() && (summary.content?.toLowerCase().includes(searchQuery.trim().toLowerCase()) || summary.target_objective?.toLowerCase().includes(searchQuery.trim().toLowerCase())) ? 'border-amber-500' : 'border-violet-300 dark:border-violet-500/30'} overflow-hidden`}
                style={showScratch
                    ? (layoutCol
                        ? { height: `${splitRatio * 100}%`, flex: 'none' }
                        : { width: `${splitRatio * 100}%`, flex: 'none' })
                    : { flex: '1' }
                }
            >
                <div className="flex items-center justify-between px-4 py-2.5 bg-violet-100/60 dark:bg-violet-500/5 border-b border-violet-200 dark:border-violet-500/10">
                    <div className="flex items-center gap-2 min-w-0">
                        <Sparkles size={12} className="text-violet-400 shrink-0" />
                        <span className="text-[11px] font-bold text-violet-600 dark:text-violet-300 truncate">
                            {summary.target_objective || 'Análisis AI'}
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-600 shrink-0">
                            {new Date(summary.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Toggle pizarrón (mobile) */}
                        <button
                            className="md:hidden p-1.5 rounded-lg text-zinc-500 hover:text-violet-300 hover:bg-violet-500/10 transition-colors flex items-center gap-1.5"
                            onClick={() => setShowScratch(v => !v)}
                            title={showScratch ? "Ver Resumen" : "Ver Pizarrón"}
                        >
                            {showScratch ? <Sparkles size={14} /> : <PenLine size={14} />}
                        </button>
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                                className={`p-1.5 rounded-lg transition-colors ${isMenuOpen ? 'bg-violet-500/20 text-violet-300' : 'text-zinc-500 hover:text-violet-300 hover:bg-violet-500/10'}`}
                                title="Opciones del Análisis"
                            >
                                <MoreVertical size={14} />
                            </button>
                            {isMenuOpen && (
                                <div className="absolute right-0 top-full mt-1 min-w-[180px] bg-white dark:bg-[#1A1A24] rounded-lg shadow-xl border border-zinc-200 dark:border-[#2D2D42] p-1 z-50 overflow-hidden animate-fadeIn">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(summary.id); setIsMenuOpen(false); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                    >
                                        <Trash2 size={14} /> Eliminar Análisis
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div
                    className="flex-1 px-8 py-6 overflow-y-auto cursor-text note-editor-scroll"
                >
                    <SmartNotesEditor
                        noteId={`summary_${summary.id}`}
                        initialContent={summary.content || ''}
                        onChange={(text) => updateContent(summary.id, text)}
                        noteFont={noteFont as any}
                        noteFontSize={noteFontSize}
                        noteLineHeight={noteLineHeight}
                        showLineNumbers={showLineNumbers}
                        searchQuery={searchQuery}
                    />
                </div>
            </div>

            {showScratch && (
                <div
                    onMouseDown={onDividerMouseDown}
                    className={`shrink-0 flex items-center justify-center rounded-full select-none hover:bg-violet-400/20 transition-colors ${layoutCol ? 'h-2 w-full cursor-row-resize' : 'w-2 h-full cursor-col-resize'}`}
                    title="Arrastrar para redimensionar"
                >
                    <div className={`rounded-full bg-violet-400/30 ${layoutCol ? 'h-1 w-8' : 'w-1 h-8'}`} />
                </div>
            )}

            {/* Pizarrón del resumen */}
            <div
                className={`flex flex-col flex-1 min-h-0 rounded-xl border border-violet-200 dark:border-[#291B46] focus-within:border-violet-400 dark:focus-within:border-[#4E3884] bg-white dark:bg-[#1A1A24] animate-fadeIn overflow-hidden transition-colors ${!showScratch ? 'hidden md:flex' : 'flex'}`}
                style={showScratch && !layoutCol ? { width: `${(1 - splitRatio) * 100}%`, flex: 'none' } : { flex: 1 }}
            >
                <div className="relative flex items-center justify-center gap-2 px-3 py-2 border-b border-violet-200/20 shrink-0">
                    <div className="flex items-center gap-2">
                        <PenLine size={11} className="text-violet-400" />
                        <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Pizarrón</span>
                    </div>
                    <div className="absolute right-2 flex items-center">
                        <button
                            onClick={() => {
                                const cur = useUIStore.getState().forcedPizarronOrientation;
                                const next = cur === 'vertical' ? 'horizontal' : 'vertical';
                                useUIStore.getState().setForcedPizarronOrientation(next);
                            }}
                            className="p-1 hover:bg-violet-400/10 rounded-lg text-violet-400 transition-colors"
                        >
                            {useUIStore.getState().forcedPizarronOrientation === 'horizontal' ? <Columns size={12} /> : <Rows size={12} />}
                        </button>
                    </div>
                </div>
                <div
                    onClick={() => scratchRef.current?.focus()}
                    className={`note-editor-scroll flex-1 ${showLineNumbers ? 'pt-8 pr-6 pb-[5px] pl-[7px]' : 'px-8 py-6'} overflow-y-scroll min-h-[120px]`}
                >
                    <SmartNotesEditor
                        ref={scratchRef}
                        noteId={`scratch_${summary.id}`}
                        initialContent={localScratch}
                        onChange={handleScratchChange}
                        noteFont={noteFont as any}
                        noteFontSize={noteFontSize}
                        noteLineHeight={noteLineHeight}
                        showLineNumbers={showLineNumbers}
                        searchQuery={searchQuery}
                    />
                </div>
            </div>
        </div>
    );
};

// ─── SUBNOTE TITLE ────────────────────────────────────────────────────────────
const SubnoteTitle: React.FC<{
    child: BrainDump;
    isActive: boolean;
    searchQuery?: string;
    onRename: (id: string, title: string) => void;
    isEditing: boolean;
    setIsEditing: (val: boolean) => void;
}> = ({ child, isActive, searchQuery, onRename, isEditing, setIsEditing }) => {
    const isJustCreated = !child.title && (Date.now() - new Date(child.created_at || 0).getTime() < 3000);
    const [val, setVal] = useState(child.title || '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setVal(child.title || ''); }, [child.title]);

    useEffect(() => {
        if (isJustCreated) setIsEditing(true);
    }, [isJustCreated, setIsEditing]);

    const save = () => {
        setIsEditing(false);
        const trimmed = val.trim();
        if (trimmed !== (child.title || '')) onRename(child.id, trimmed);
        else setVal(child.title || '');
    };

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                value={val}
                autoFocus
                onChange={e => setVal(e.target.value)}
                onBlur={save}
                onKeyDown={e => {
                    if (e.key === 'Enter') save();
                    if (e.key === 'Escape') { setIsEditing(false); setVal(child.title || ''); }
                    e.stopPropagation();
                }}
                onClick={e => e.stopPropagation()}
                className="bg-zinc-800 text-white border-emerald-500 border rounded px-1.5 py-0.5 outline-none text-[14px] max-w-[280px] shadow-inner text-left"
                placeholder="Título..."
            />
        );
    }

    return (
        <span
            className="truncate max-w-[100px] cursor-pointer"
            onDoubleClick={e => { e.stopPropagation(); if (isActive) setIsEditing(true); }}
            title={isActive ? 'Doble clic para renombrar' : child.title || ''}
        >
            {searchQuery?.trim() ? highlightText(child.title || 'Sin título', searchQuery.trim()) : (child.title || 'Sin título')}
        </span>
    );
};

// ─── SUMMARY TITLE ────────────────────────────────────────────────────────────
const SummaryTitle: React.FC<{
    summary: Summary;
    isActive: boolean;
    searchQuery?: string;
    onRename: (id: string, newObjective: string) => void;
    isEditing: boolean;
    setIsEditing: (editing: boolean) => void;
}> = ({ summary, isActive, searchQuery, onRename, isEditing, setIsEditing }) => {
    const [val, setVal] = useState(summary.target_objective || '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setVal(summary.target_objective || ''); }, [summary.target_objective]);

    const save = () => {
        setIsEditing(false);
        const trimmed = val.trim();
        if (trimmed && trimmed !== summary.target_objective) onRename(summary.id, trimmed);
        else setVal(summary.target_objective || '');
    };

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(0, 0);
            inputRef.current.scrollLeft = 0;
        }
    }, [isEditing]);

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                value={val}
                autoFocus
                onChange={e => setVal(e.target.value)}
                onBlur={save}
                onKeyDown={e => {
                    if (e.key === 'Enter') save();
                    if (e.key === 'Escape') { setIsEditing(false); setVal(summary.target_objective || ''); }
                    e.stopPropagation();
                }}
                onClick={e => e.stopPropagation()}
                className="bg-black text-white border-violet-500 border rounded px-1.5 py-0.5 outline-none text-[14px] max-w-[280px] shadow-inner text-left"
                placeholder="Título..."
            />
        );
    }

    return (
        <span
            className="truncate max-w-[120px] cursor-pointer"
            onDoubleClick={e => { e.stopPropagation(); if (isActive) setIsEditing(true); }}
            title={isActive ? 'Doble clic para renombrar' : summary.target_objective || ''}
        >
            {searchQuery?.trim() ? highlightText(summary.target_objective || 'Resumen', searchQuery.trim()) : (summary.target_objective || 'Resumen')}
        </span>
    );
};

// ─── SUBNOTE TAB CONTENT ──────────────────────────────────────────────────────
const SubnoteTabContent: React.FC<{
    dump: BrainDump;
    showScratch: boolean;
    onUpdate: (id: string, updates: Partial<BrainDump>) => void;
    splitRatio: number;
    onDividerMouseDown: (e: React.MouseEvent) => void;
    splitContainerRef: React.RefObject<HTMLDivElement>;
    noteFont: string;
    noteFontSize: string;
    noteLineHeight: string;
    searchQuery?: string;
    showLineNumbers?: boolean;
    triggerScrollToActive: () => void;
    isSubpizarron?: boolean;
}> = ({
    dump,
    showScratch,
    splitRatio,
    onDividerMouseDown,
    splitContainerRef,
    noteFont,
    noteFontSize,
    noteLineHeight,
    searchQuery,
    showLineNumbers,
    onUpdate,
    triggerScrollToActive,
    isSubpizarron = false,
}) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const forcedOrientation = useUIStore(s => s.forcedPizarronOrientation);
    const layoutCol = forcedOrientation ? forcedOrientation === 'horizontal' : isMobile;

    const editorRef = useRef<SmartNotesEditorRef>(null);
    const scratchRef = useRef<SmartNotesEditorRef>(null);

    // Border: emerald for sub-pizarrones, amber for main
    const mainBorderClass = isSubpizarron
        ? 'border-emerald-200 dark:border-emerald-900/30 focus-within:border-emerald-400 dark:focus-within:border-emerald-500/60'
        : 'border-amber-200 dark:border-amber-900/30 focus-within:border-amber-400 dark:focus-within:border-amber-500/60';

    return (
        <div
            ref={splitContainerRef}
            onFocusCapture={triggerScrollToActive}
            onClickCapture={triggerScrollToActive}
            className={`flex-1 flex min-h-0 ${layoutCol ? 'flex-col' : 'flex-row'} gap-2 pt-0`}
        >
            {/* Main editor */}
            <div
                className={`min-h-0 overflow-hidden flex flex-col rounded-xl border ${mainBorderClass} bg-zinc-50 dark:bg-[#131314]`}
                style={showScratch
                    ? (layoutCol
                        ? { height: `${splitRatio * 100}%`, flex: 'none' }
                        : { width: `${splitRatio * 100}%`, flex: 'none' })
                    : { flex: '1' }
                }
            >
                {/* Metadata header */}
                <div className="flex items-center justify-center gap-6 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#1A1A24] shrink-0">
                    <div className="flex items-center gap-1.5 opacity-60">
                        <Clock size={11} className="text-zinc-500" />
                        <span className="text-[9px] font-bold uppercase tracking-tighter text-zinc-500">Creación:</span>
                        {formatCleanDate(dump.created_at)}
                    </div>
                    <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-800" />
                    <div className="flex items-center gap-1.5 opacity-60">
                        <History size={11} className="text-zinc-500" />
                        <span className="text-[9px] font-bold uppercase tracking-tighter text-zinc-500">Edición:</span>
                        {formatCleanDate(dump.updated_at)}
                    </div>
                </div>

                {dump.is_checklist ? (
                    <div className={`${showLineNumbers ? 'pt-8 pr-6 pb-[5px] pl-[7px]' : 'px-8 py-6'} h-full overflow-y-auto note-editor-scroll`}>
                        <ChecklistEditor
                            idPrefix={dump.id}
                            initialContent={dump.content || ''}
                            onUpdate={c => onUpdate(dump.id, { content: c })}
                        />
                    </div>
                ) : (
                    <div
                        onClick={(e) => {
                            if ((e.target as HTMLElement).closest('.cm-panel, .cm-search')) return;
                            editorRef.current?.focus();
                        }}
                        className={`${showLineNumbers ? 'pt-8 pr-6 pb-[5px] pl-[7px]' : 'px-8 py-6'} h-full overflow-y-auto cursor-text note-editor-scroll`}
                    >
                        <SmartNotesEditor
                            key={dump.id}
                            ref={editorRef}
                            noteId={dump.id}
                            initialContent={dump.content || ''}
                            searchQuery={searchQuery}
                            showLineNumbers={showLineNumbers}
                            onChange={c => onUpdate(dump.id, { content: c })}
                            noteFont={noteFont as any}
                            noteFontSize={noteFontSize}
                            noteLineHeight={noteLineHeight}
                        />
                    </div>
                )}
            </div>

            {showScratch && (
                <div
                    onMouseDown={onDividerMouseDown}
                    className={`shrink-0 flex items-center justify-center rounded-full select-none hover:bg-amber-400/20 transition-colors ${layoutCol ? 'h-2 w-full cursor-row-resize' : 'w-2 h-full cursor-col-resize'}`}
                    title="Arrastrar para redimensionar"
                >
                    <div className={`rounded-full bg-amber-400/30 ${layoutCol ? 'h-1 w-8' : 'w-1 h-8'}`} />
                </div>
            )}

            {showScratch && (
                <div
                    onFocusCapture={triggerScrollToActive}
                    className="min-h-0 overflow-hidden flex flex-col rounded-xl border border-amber-200 dark:border-[#2E1F0F] focus-within:border-amber-400 dark:focus-within:border-amber-600/50 bg-white dark:bg-[#1A1A24] animate-fadeIn transition-colors"
                    style={{ flex: 1 }}
                >
                    <div className="relative flex items-center justify-center gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#1A1A24] shrink-0">
                        <div className="flex items-center gap-2">
                            <PenLine size={11} className="text-amber-500" />
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Pizarrón</span>
                        </div>
                        <div className="absolute right-2 flex items-center">
                            <button
                                onClick={() => {
                                    const curr = useUIStore.getState().forcedPizarronOrientation;
                                    const next = curr === 'vertical' ? 'horizontal' : 'vertical';
                                    useUIStore.getState().setForcedPizarronOrientation(next);
                                }}
                                title={useUIStore.getState().forcedPizarronOrientation === 'horizontal' ? "Cambiar a Vertical" : "Cambiar a Horizontal"}
                                className="p-1 hover:bg-amber-400/10 rounded-lg text-amber-500 transition-colors"
                            >
                                {useUIStore.getState().forcedPizarronOrientation === 'horizontal' ? <Columns size={12} /> : <Rows size={12} />}
                            </button>
                        </div>
                    </div>
                    <div
                        onClick={(e) => {
                            if ((e.target as HTMLElement).closest('.cm-panel, .cm-search')) return;
                            scratchRef.current?.focus();
                        }}
                        className={`flex-1 ${showLineNumbers ? 'pt-8 pr-6 pb-[5px] pl-[7px]' : 'px-8 py-6'} overflow-y-auto cursor-text note-editor-scroll`}
                    >
                        <SmartNotesEditor
                            key={`scratch_dump_${dump.id}`}
                            ref={scratchRef}
                            noteId={`scratch_dump_${dump.id}`}
                            initialContent={dump.scratchpad || ''}
                            onChange={c => onUpdate(dump.id, { scratchpad: c })}
                            noteFont={noteFont as any}
                            noteFontSize={noteFontSize}
                            noteLineHeight={noteLineHeight}
                            showLineNumbers={showLineNumbers}
                            searchQuery={searchQuery}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---

export const BrainDumpApp: React.FC<{
    session: Session;
    noteFont?: string;
    noteFontSize?: string;
    noteLineHeight?: string;
    searchQuery?: string;
    allSummaries?: Summary[];
    groups?: Group[];
    onOpenNote?: (groupId: string, noteId: string) => void;
    setSearchQuery?: (query: string) => void;
    showLineNumbers?: boolean;
    onToggleLineNumbers?: () => void;
}> = ({ session, noteFont = 'sans', noteFontSize = 'medium', noteLineHeight = 'standard', searchQuery, allSummaries = [], groups = [], onOpenNote, setSearchQuery, showLineNumbers = false, onToggleLineNumbers }) => {

    // --- STORE & HOOKS ---
    const [scrollToActiveCount, setScrollToActiveCount] = useState(0);
    const triggerScrollToActive = () => setScrollToActiveCount(prev => prev + 1);

    const {
        isBraindumpMaximized, setIsBraindumpMaximized,
        brainDumps: dumps, setBrainDumps: setDumps,
        showOverdueMarquee, setShowOverdueMarquee,
        overdueRemindersCount, globalTasks,
        focusedDumpId, setFocusedDumpId,
        isDumpTrayOpen, setIsDumpTrayOpen,
        isZenModeByApp, toggleZenMode,
        aiPanelOpenByBrainDump, activeTabByBrainDump,
        setAiPanelOpenByBrainDump, setActiveTabByBrainDump,
        isBraindumpPizarronOpen, setIsBraindumpPizarronOpen,
        isArchiveOpenByApp, setArchiveOpenByApp
    } = useUIStore();

    const checkPizarronSearchMatch = useCallback((dump: BrainDump, query: string, allDumps: BrainDump[], summaries: Summary[]): boolean => {
        if (!query) return false;
        const q = query.toLowerCase();
        if ((dump.title || '').toLowerCase().includes(q) || (dump.content || '').toLowerCase().includes(q)) return true;
        if ((dump.scratchpad || '').toLowerCase().includes(q)) return true;
        const dumpSummaries = summaries.filter(s => s.brain_dump_id === dump.id);
        if (dumpSummaries.some(s =>
            (s.content || '').toLowerCase().includes(q) ||
            (s.target_objective || '').toLowerCase().includes(q) ||
            (s.scratchpad || '').toLowerCase().includes(q)
        )) return true;
        const children = allDumps.filter(d => d.parent_id === dump.id);
        return children.some(child => checkPizarronSearchMatch(child, query, allDumps, summaries));
    }, []);

    const tabBarRef = useRef<HTMLDivElement>(null);

    const { activeDumpId, activeDump, breadcrumbPath, navigate } = useBrainDumpTree(focusedDumpId);
    const isRootLevel = !activeDumpId || activeDumpId === focusedDumpId;

    const displayDump = isRootLevel ? (dumps.find(d => d.id === focusedDumpId)) : activeDump;
    const currentDumpId = displayDump?.id || focusedDumpId;
    const isInKanban = displayDump ? globalTasks?.some(t => t.id === displayDump.id || t.linked_board_id === displayDump.id) : false;

    const showAIPanel = currentDumpId ? (aiPanelOpenByBrainDump[currentDumpId] || false) : false;
    const activeTab = currentDumpId ? (activeTabByBrainDump[currentDumpId] || 'original') : 'original';

    const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
    const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);
    const [hasSearchMatchTabsLeft, setHasSearchMatchTabsLeft] = useState(false);
    const [hasSearchMatchTabsRight, setHasSearchMatchTabsRight] = useState(false);

    const checkTabsScroll = useCallback(() => {
        if (tabBarRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = tabBarRef.current;
            setCanScrollTabsLeft(scrollLeft > 5);
            setCanScrollTabsRight(scrollLeft + clientWidth < scrollWidth - 5);

            const query = searchQuery?.trim();
            if (!query) { setHasSearchMatchTabsLeft(false); setHasSearchMatchTabsRight(false); return; }

            let matchLeft = false;
            let matchRight = false;
            const tabs = tabBarRef.current.querySelectorAll('button[data-is-match="true"]');
            tabs.forEach(tab => {
                const t = tab as HTMLElement;
                const tabStart = t.offsetLeft;
                const tabEnd = tabStart + t.offsetWidth;
                if (tabStart < scrollLeft + 35) matchLeft = true;
                if (tabEnd > scrollLeft + clientWidth - 35) matchRight = true;
            });
            setHasSearchMatchTabsLeft(matchLeft);
            setHasSearchMatchTabsRight(matchRight);
        }
    }, [tabBarRef, searchQuery]);

    const scrollTabsHorizontally = (direction: 'left' | 'right') => {
        if (tabBarRef.current) {
            tabBarRef.current.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        const container = tabBarRef.current;
        if (container) {
            checkTabsScroll();
            container.addEventListener('scroll', checkTabsScroll);
            window.addEventListener('resize', checkTabsScroll);
            return () => {
                container.removeEventListener('scroll', checkTabsScroll);
                window.removeEventListener('resize', checkTabsScroll);
            };
        }
    }, [checkTabsScroll, tabBarRef]);

    useEffect(() => {
        if (!tabBarRef.current || !activeTab) return;
        const timer = setTimeout(() => {
            const activeBtn = tabBarRef.current?.querySelector('[data-active-tab="true"]');
            if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }, 100);
        return () => clearTimeout(timer);
    }, [activeTab, scrollToActiveCount]);

    const {
        summaries: aiSummaries, deleteSummary, updateScratchpad,
        updateSummaryContent, updateSummaryMetadata, loading: summariesLoading
    } = useBrainDumpSummaries(currentDumpId);

    const completedSummaries = aiSummaries.filter(s => s.status === 'completed');
    const manualChildren = useMemo(() => {
        return dumps
            .filter(d => d.parent_id === currentDumpId)
            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    }, [dumps, currentDumpId]);

    const unifiedTabs = useMemo(() => {
        const items = [
            ...manualChildren.map(c => ({ id: `sub_${c.id}`, type: 'sub' as const, order_index: c.order_index || 0, data: c })),
            ...aiSummaries.map(s => ({ id: s.id, type: 'summary' as const, order_index: s.order_index || 0, data: s }))
        ];
        return items.sort((a, b) => a.order_index - b.order_index);
    }, [manualChildren, aiSummaries]);

    useEffect(() => { checkTabsScroll(); }, [unifiedTabs, checkTabsScroll]);

    const getNewOrderIndex = useCallback(() => {
        if (activeTab === 'original') {
            const first = unifiedTabs[0];
            if (!first) return 1;
            return first.order_index / 2;
        }
        const activeIndex = unifiedTabs.findIndex(t => t.id === activeTab);
        if (activeIndex === -1) {
            const last = unifiedTabs[unifiedTabs.length - 1];
            return last ? last.order_index + 1 : 1;
        }
        const current = unifiedTabs[activeIndex];
        const next = unifiedTabs[activeIndex + 1];
        if (!next) return current.order_index + 1;
        return (current.order_index + next.order_index) / 2;
    }, [activeTab, unifiedTabs]);

    // --- LOCAL UI STATE ---
    const [isZenMode, setIsZenMode] = useState(isZenModeByApp['braindump']);
    const [dumpSaveStatus, setDumpSaveStatus] = useState<Record<string, 'saved' | 'saving' | 'error' | 'idle'>>({});
    useEffect(() => { setIsZenMode(isZenModeByApp['braindump']); }, [isZenModeByApp]);

    const [sortMode, setSortMode] = useState<'date-desc' | 'date-asc' | 'created-desc' | 'created-asc' | 'alpha-asc' | 'alpha-desc'>(() => {
        return (localStorage.getItem('braindump-sort-mode') as any) || 'created-asc';
    });
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [splitRatio, setSplitRatio] = useState(0.5);
    const [showAIInput, setShowAIInput] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [linkingPizarron, setLinkingPizarron] = useState<BrainDump | null>(null);
    const [editingTabId, setEditingTabId] = useState<string | null>(null);
    const [tempTitle, setTempTitle] = useState('');
    useEffect(() => {
        if (displayDump) setTempTitle(displayDump.title || '');
    }, [displayDump?.id]);

    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [hasSearchMatchLeft, setHasSearchMatchLeft] = useState(false);
    const [hasSearchMatchRight, setHasSearchMatchRight] = useState(false);

    const menuRef = useRef<HTMLDivElement>(null);
    const sortMenuRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const splitContainerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
            if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setIsSortMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const setActiveTab = (tabId: string) => {
        if (currentDumpId) setActiveTabByBrainDump(currentDumpId, tabId);
    };

    // --- SCROLL (main tray) ---
    const checkScroll = useCallback(() => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
            setCanScrollLeft(scrollLeft > 5);
            setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 5);
            const query = searchQuery?.trim();
            if (!query) { setHasSearchMatchLeft(false); setHasSearchMatchRight(false); return; }
            let matchLeft = false;
            let matchRight = false;
            const tabs = scrollContainerRef.current.querySelectorAll('button[data-is-match="true"]');
            tabs.forEach(tab => {
                const t = tab as HTMLElement;
                const tabStart = t.offsetLeft;
                const tabEnd = tabStart + t.offsetWidth;
                if (tabStart < scrollLeft + 35) matchLeft = true;
                if (tabEnd > scrollLeft + clientWidth - 35) matchRight = true;
            });
            setHasSearchMatchLeft(matchLeft);
            setHasSearchMatchRight(matchRight);
        }
    }, [searchQuery]);

    const scrollTabs = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: direction === 'left' ? -350 : 350, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (container) {
            checkScroll();
            const timer = setTimeout(checkScroll, 300);
            container.addEventListener('scroll', checkScroll);
            window.addEventListener('resize', checkScroll);
            const ro = new ResizeObserver(checkScroll);
            ro.observe(container);
            return () => {
                clearTimeout(timer);
                container.removeEventListener('scroll', checkScroll);
                window.removeEventListener('resize', checkScroll);
                ro.disconnect();
            };
        }
    }, [dumps.length, checkScroll, searchQuery, isDumpTrayOpen]);

    useEffect(() => {
        if (!scrollContainerRef.current || !focusedDumpId || !isDumpTrayOpen) return;
        const timer = setTimeout(() => {
            const container = scrollContainerRef.current;
            if (!container) return;
            const activeBtn = container.querySelector('[data-active-tab="true"]');
            if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }, 150);
        return () => clearTimeout(timer);
    }, [focusedDumpId, isDumpTrayOpen, scrollToActiveCount]);

    // --- HANDLERS ---
    const autoSave = (id: string, updates: Partial<BrainDump>) => {
        setDumps(prev => prev.map(d => d.id === id ? { ...d, ...updates, updated_at: new Date().toISOString() } : d));
        setDumpSaveStatus(prev => ({ ...prev, [id]: 'saving' }));
        if (saveTimeoutRef.current[id]) clearTimeout(saveTimeoutRef.current[id]);
        saveTimeoutRef.current[id] = setTimeout(async () => {
            const { error } = await supabase.from('brain_dumps').update(updates).eq('id', id);
            setDumpSaveStatus(prev => ({ ...prev, [id]: error ? 'error' : 'saved' }));
        }, 800);
    };

    const createNewDraft = async () => {
        const { data: newMain } = await supabase.from('brain_dumps')
            .insert([{ title: '', content: '', status: 'main', user_id: session.user.id }])
            .select().single();
        if (newMain) {
            setDumps(prev => [newMain, ...prev]);
            setFocusedDumpId(newMain.id);
        }
    };

    const handleCreateSubpizarron = async () => {
        if (!currentDumpId) return;
        const orderIndex = getNewOrderIndex();
        const { data, error } = await supabase.from('brain_dumps').insert([{
            title: '',
            content: '',
            status: 'main',
            user_id: session.user.id,
            parent_id: currentDumpId,
            generation_level: (displayDump?.generation_level || 0) + 1,
            order_index: orderIndex
        }]).select().single();
        if (error) {
            console.error('Error creating subpizarron:', error);
            alert(`Error al crear subpizarrón: ${error.message}`);
            return;
        }
        if (data) {
            setDumps(prev => [...prev, data]);
            setActiveTab(`sub_${data.id}`);
        }
    };

    const handleAddToKanban = async () => {
        if (!displayDump || isInKanban) return;
        const { error } = await supabase.from('tasks').insert([{
            title: displayDump.title || 'Pizarrón sin título',
            content: displayDump.content || '',
            status: 'backlog',
            user_id: session.user.id,
            linked_board_id: displayDump.id
        }]);
        if (error) { console.error('Error linking to Kanban:', error); return; }
        setOpenMenuId(null);
        window.dispatchEvent(new CustomEvent('kanban-updated'));
    };

    const changeStatus = async (id: string, newStatus: any) => {
        setDumps(dumps.map(d => d.id === id ? { ...d, status: newStatus } : d));
        await supabase.from('brain_dumps').update({ status: newStatus }).eq('id', id);
    };

    const deleteDump = async (id: string) => {
        if (!window.confirm('¿Eliminar permanentemente este pizarrón?')) return;
        setDumps(dumps.filter(d => d.id !== id));
        await supabase.from('brain_dumps').delete().eq('id', id);
        if (focusedDumpId === id) setFocusedDumpId(null);
        setActiveTab('original');
    };

    const handleDividerMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        const container = splitContainerRef.current;
        if (!container) return;
        const onMove = (ev: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const rect = container.getBoundingClientRect();
            const isMobile = window.innerWidth < 768;
            const forcedOrientation = useUIStore.getState().forcedPizarronOrientation;
            const layoutCol = forcedOrientation ? forcedOrientation === 'horizontal' : isMobile;
            if (layoutCol) {
                const ratio = (ev.clientY - rect.top) / rect.height;
                setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
            } else {
                const ratio = (ev.clientX - rect.left) / rect.width;
                setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
            }
        };
        const onUp = () => {
            isDraggingRef.current = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    // --- FILTERING & SORTING ---
    const rootPizarrones = useMemo(() => {
        let result = dumps.filter(d => d.status !== 'history' && !d.parent_id);
        result.sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            switch (sortMode) {
                case 'date-desc': return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
                case 'date-asc': return new Date(a.updated_at || a.created_at || 0).getTime() - new Date(b.updated_at || b.created_at || 0).getTime();
                case 'created-desc': return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                case 'created-asc': return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                case 'alpha-asc': return (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
                case 'alpha-desc': return (b.title || '').toLowerCase().localeCompare((a.title || '').toLowerCase());
                default: return 0;
            }
        });
        return result;
    }, [dumps, sortMode]);

    const filteredPizarrones = useMemo(() => {
        if (!searchQuery?.trim()) return rootPizarrones;
        return rootPizarrones.filter(p => checkPizarronSearchMatch(p, searchQuery.trim(), dumps, allSummaries));
    }, [rootPizarrones, searchQuery, dumps, allSummaries]);

    const archivo = dumps.filter(d => d.status === 'history');

    // --- RENDER ---
    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-[#13131A] overflow-hidden">

            {/* ── TOPBAR ──────────────────────────────────────────────────────── */}
            {!isZenMode && (
                <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#13131A]/90 backdrop-blur-md shrink-0 border-b border-zinc-200 dark:border-zinc-800 shadow-sm transition-all">
                    <div className="py-[10px] flex flex-col items-center justify-center">
                        <div className="max-w-6xl mx-auto w-full flex flex-row items-center justify-center md:justify-between px-6 gap-4">
                            <h1 className="hidden md:flex text-xl font-bold text-zinc-800 dark:text-[#CCCCCC] flex items-center gap-3">
                                <div className="hidden md:flex h-9 w-9 items-center justify-center bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/40 rounded-xl shadow-sm shrink-0">
                                    <PenTool size={20} />
                                </div>
                                <span className="truncate">Pizarrón</span>
                            </h1>

                            <div className="flex items-center justify-center gap-2 sm:gap-3 shrink-0">
                                {/* Search */}
                                <div className="relative flex items-center group">
                                    <Search size={15} className={`absolute left-3 transition-colors ${searchQuery?.trim() ? 'text-[#FFD700]' : 'text-zinc-500'}`} />
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        value={searchQuery || ''}
                                        onChange={e => setSearchQuery?.(e.target.value)}
                                        className={`h-9 pl-9 pr-8 rounded-xl border transition-all outline-none text-xs font-medium w-32 md:w-32 lg:w-40 ${searchQuery?.trim() ? 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 placeholder-amber-700/50 dark:placeholder-amber-400/50 font-semibold' : 'bg-zinc-200/50 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500 hover:border-zinc-400 dark:hover:border-zinc-700 focus:border-[#FFD700]/50'}`}
                                    />
                                    {searchQuery?.trim() && (
                                        <button onClick={() => setSearchQuery?.('')} className="absolute right-2 p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-zinc-300/80 dark:bg-zinc-800/80 rounded-full transition-colors">
                                            <X size={10} />
                                        </button>
                                    )}
                                </div>

                                {/* Bell */}
                                <button
                                    onClick={() => overdueRemindersCount > 0 && setShowOverdueMarquee(!showOverdueMarquee)}
                                    disabled={overdueRemindersCount === 0}
                                    className={`hidden md:flex h-9 px-3 rounded-xl transition-all active:scale-95 shrink-0 flex items-center gap-2 border ${showOverdueMarquee ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/40 shadow-sm shadow-red-600/10' : overdueRemindersCount > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40' : 'bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-400 opacity-60 cursor-not-allowed'}`}
                                >
                                    <Bell size={18} className={overdueRemindersCount > 0 ? `animate-pulse ${showOverdueMarquee ? 'text-red-700 dark:text-red-400' : 'text-red-500'}` : ''} />
                                    {overdueRemindersCount > 0 && <span className="text-xs font-bold">{overdueRemindersCount}</span>}
                                </button>

                                {/* Tray Toggle */}
                                <button
                                    onClick={() => setIsDumpTrayOpen(!isDumpTrayOpen)}
                                    className={`h-9 px-3 rounded-xl transition-all border flex items-center gap-2 active:scale-95 shrink-0 ${isDumpTrayOpen ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400 font-bold shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-amber-500/50 hover:text-amber-500'}`}
                                    title={isDumpTrayOpen ? "Ocultar bandeja" : "Mostrar bandeja"}
                                >
                                    <ChevronsDownUp size={18} className={`transition-transform duration-300 ${isDumpTrayOpen ? 'rotate-180' : ''}`} />
                                    <span className="text-sm font-bold">{rootPizarrones.length}</span>
                                </button>

                                {/* Sort */}
                                <div className="relative" ref={sortMenuRef}>
                                    <button
                                        onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                                        className="h-9 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-400 transition-all flex items-center justify-center active:scale-95"
                                        title="Ordenar"
                                    >
                                        <ArrowUpDown size={16} />
                                    </button>
                                    {isSortMenuOpen && (
                                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1A1A24] border border-zinc-200 dark:border-[#2D2D42] rounded-xl shadow-2xl z-50 py-1 overflow-hidden animate-fadeIn">
                                            {[
                                                { id: 'date-desc', label: 'Fecha (Recientes)', icon: <Calendar size={14} /> },
                                                { id: 'date-asc', label: 'Fecha (Antiguos)', icon: <Calendar size={14} /> },
                                                { id: 'created-desc', label: 'Creación (reciente)', icon: <Calendar size={14} /> },
                                                { id: 'created-asc', label: 'Creación (antigua)', icon: <Calendar size={14} /> },
                                                { id: 'alpha-asc', label: 'Nombre (A-Z)', icon: <Type size={14} /> },
                                                { id: 'alpha-desc', label: 'Nombre (Z-A)', icon: <Type size={14} /> },
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => { setSortMode(opt.id as any); localStorage.setItem('pizarronSortMode', opt.id); setIsSortMenuOpen(false); }}
                                                    className={`w-full px-4 py-2 text-left text-xs flex items-center gap-2 hover:bg-zinc-800 transition-colors ${sortMode === opt.id ? 'text-[#FFD700] font-bold bg-[#FFD700]/5' : 'text-zinc-400 font-medium'}`}
                                                >
                                                    {opt.icon} {opt.label}
                                                    {sortMode === opt.id && <Check size={14} className="ml-auto" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={createNewDraft}
                                    className="h-9 w-9 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/40 rounded-xl shadow-sm hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all flex items-center justify-center active:scale-95 shrink-0"
                                    title="Nuevo Pizarrón"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── DUMP TRAY ────────────────────────────────────────────────────── */}
            {!isZenMode && isDumpTrayOpen && (
                <div className="bg-[#FAFAFA] dark:bg-[#13131A] shrink-0 animate-slideDown group/tray border-b border-zinc-200 dark:border-transparent">
                    <div className="max-w-6xl mx-auto relative px-0">
                        <div className={`absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#FAFAFA] dark:from-[#13131A] to-transparent z-10 flex items-center justify-start pointer-events-none transition-opacity duration-150 ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`}>
                            <button
                                onClick={() => scrollTabs('left')}
                                className={`p-1 rounded-full bg-zinc-200 dark:bg-zinc-800 shadow-md text-zinc-600 dark:text-zinc-400 hover:text-amber-600 transition-all active:scale-95 border ${hasSearchMatchLeft ? 'border-amber-500 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,192,45,0.4)] scale-110' : 'border-zinc-300 dark:border-zinc-700'} ml-1 ${canScrollLeft ? 'pointer-events-auto' : 'pointer-events-none'}`}
                            >
                                <ChevronLeft size={14} />
                            </button>
                        </div>
                        <div
                            ref={scrollContainerRef}
                            onScroll={checkScroll}
                            className={`flex flex-nowrap items-center gap-4 overflow-x-auto hidden-scrollbar scroll-smooth py-3 px-10 transition-all ${(!canScrollLeft && !canScrollRight) ? 'justify-center' : 'justify-start'}`}
                        >
                            {rootPizarrones.length === 0 ? (
                                <div className="text-xs text-zinc-600 italic">No hay pizarrones activos</div>
                            ) : (
                                rootPizarrones.map(p => {
                                    const isMatch = searchQuery?.trim() && checkPizarronSearchMatch(p, searchQuery.trim(), dumps, allSummaries);
                                    return (
                                        <button
                                            key={p.id}
                                            data-is-match={isMatch}
                                            data-active-tab={focusedDumpId === p.id}
                                            onClick={() => {
                                                if (focusedDumpId === p.id) setFocusedDumpId(null);
                                                else setFocusedDumpId(p.id);
                                            }}
                                            className={`relative flex items-center justify-start gap-3 px-4 py-2 rounded-xl text-xs font-medium transition-all border shrink-0 active:scale-95 ${focusedDumpId === p.id
                                                ? `bg-amber-50/80 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 shadow-sm ${isMatch ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-[#13131A] shadow-[0_0_15px_rgba(251,192,45,0.4)]' : ''}`
                                                : isMatch
                                                    ? 'bg-amber-100/80 dark:bg-amber-900/30 border-amber-500 text-amber-700 dark:text-amber-300 shadow-[0_0_10px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                                                    : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <PenTool size={14} className={focusedDumpId === p.id ? 'text-amber-600 dark:text-amber-300 shrink-0' : 'shrink-0'} />
                                                <span className="max-w-[150px] truncate">
                                                    {searchQuery?.trim() ? highlightText(p.title || 'Sin Título', searchQuery.trim()) : (p.title || 'Sin Título')}
                                                    {(() => {
                                                        const subDumpsCount = dumps.filter(d => d.parent_id === p.id).length || 0;
                                                        const summariesCount = allSummaries.filter(s => s.brain_dump_id === p.id).length || 0;
                                                        const total = 1 + subDumpsCount + summariesCount;
                                                        return total > 1 ? ` (${total})` : '';
                                                    })()}
                                                </span>
                                            </div>
                                            {p.is_pinned && (
                                                <span className="flex items-center ml-1">
                                                    <Pin size={9} className={`fill-current ${focusedDumpId === p.id ? 'text-amber-700' : 'text-[#85858C]'}`} />
                                                </span>
                                            )}
                                            {globalTasks?.some(t => t.id === p.id || t.linked_board_id === p.id) && (
                                                <div className="absolute -top-1.5 -right-1.5"><KanbanSemaphore sourceType="board" sourceId={p.id} sourceTitle={p.title || ''} /></div>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                        <div className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#FAFAFA] dark:from-[#13131A] to-transparent z-10 flex items-center justify-end pointer-events-none transition-opacity duration-150 ${canScrollRight ? 'opacity-100' : 'opacity-0'}`}>
                            <button
                                onClick={() => scrollTabs('right')}
                                className={`p-1 rounded-full bg-zinc-200 dark:bg-zinc-800 shadow-md text-zinc-600 dark:text-zinc-400 hover:text-amber-600 transition-all active:scale-95 border ${hasSearchMatchRight ? 'border-amber-500 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,192,45,0.4)] scale-110' : 'border-zinc-300 dark:border-zinc-700'} mr-1 ${canScrollRight ? 'pointer-events-auto' : 'pointer-events-none'}`}
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MAIN AREA ────────────────────────────────────────────────────── */}
            <div className={`flex-1 ${focusedDumpId ? 'overflow-hidden px-4' : 'overflow-y-auto px-0'} bg-zinc-50 dark:bg-[#13131A] pb-4 ${!isZenMode && isDumpTrayOpen ? 'pt-[2px]' : 'pt-5'} hidden-scrollbar flex flex-col`}>
                <div className={`${isBraindumpMaximized ? 'max-w-full' : 'max-w-full md:max-w-6xl'} mx-auto flex flex-col ${focusedDumpId ? 'gap-0 pb-0 flex-1 w-full min-h-0' : 'gap-12 pb-20 w-full px-4 md:px-10'}`}>

                    {/* ── FOCUSED DUMP CARD ─────────────────────────────────────── */}
                    {focusedDumpId && displayDump && (() => {
                        const isDisplayDumpMatch = searchQuery?.trim() && checkPizarronSearchMatch(displayDump, searchQuery.trim(), dumps, allSummaries);
                        return (
                            <div
                                onClickCapture={triggerScrollToActive}
                                className={`flex-1 flex flex-col min-h-0 bg-white dark:bg-[#1A1A24] rounded-2xl border overflow-hidden animate-fadeIn transition-all duration-300 ${isDisplayDumpMatch
                                    ? 'border-amber-500'
                                    : 'border-zinc-200 dark:border-[#2D2D42] focus-within:border-amber-400 dark:focus-within:border-amber-500/60'
                                    }`}
                            >
                                {/* ══ HEADER ══════════════════════════════════════════ */}
                                <div className="flex flex-col px-4 pt-4 pb-0 transition-colors min-w-0 shrink-0">

                                    {/* ROW 1: TITLE */}
                                    <div className="flex items-center justify-between gap-2 min-w-0">
                                        <div className="flex items-center gap-3 flex-1 overflow-hidden pl-1 min-w-0">
                                            <div className="flex flex-col min-w-0 justify-center w-full">
                                                <div className="relative flex w-full">
                                                    {/* Ghost highlight layer */}
                                                    <div className="absolute inset-0 w-full pointer-events-none text-lg font-bold p-0 min-h-[1.5em] flex items-center overflow-hidden whitespace-nowrap">
                                                        <span className="truncate">
                                                            {searchQuery ? highlightText(tempTitle, searchQuery) : ""}
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={tempTitle}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setTempTitle(val);
                                                            if (saveTimeoutRef.current[`title_${displayDump.id}`]) clearTimeout(saveTimeoutRef.current[`title_${displayDump.id}`]);
                                                            saveTimeoutRef.current[`title_${displayDump.id}`] = setTimeout(() => {
                                                                autoSave(displayDump.id, { title: val });
                                                            }, 800);
                                                        }}
                                                        onBlur={() => {
                                                            if (tempTitle !== (displayDump?.title || '')) {
                                                                autoSave(displayDump.id, { title: tempTitle });
                                                            }
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') e.currentTarget.blur();
                                                            if (e.key === 'Escape') {
                                                                setTempTitle(displayDump?.title || '');
                                                                e.currentTarget.blur();
                                                            }
                                                        }}
                                                        placeholder="Nombre del pizarrón..."
                                                        className={`w-full bg-transparent border-none outline-none text-lg font-bold placeholder:text-zinc-400 p-0 truncate transition-colors ${searchQuery && tempTitle.toLowerCase().includes(searchQuery.toLowerCase()) ? 'text-transparent caret-zinc-800 dark:caret-[#CCCCCC]' : 'text-zinc-800 dark:text-zinc-100'}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 pr-1">
                                            {(() => {
                                                const currentStatus = dumpSaveStatus[displayDump.id] || 'idle';
                                                return (
                                                    <div className="mr-0.5 flex items-center justify-center w-6 h-6" title={currentStatus === 'saving' ? 'Sincronizando...' : 'Sincronizado'}>
                                                        {currentStatus === 'saving' ? (
                                                            <Loader2 size={13} className="animate-spin text-amber-500" />
                                                        ) : (
                                                            <CloudCheck size={13} className={currentStatus === 'saved' ? "text-emerald-500" : "text-zinc-300 dark:text-zinc-600"} />
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {isInKanban && (
                                                <div className="flex-shrink-0 animate-fadeIn">
                                                    <KanbanSemaphore sourceType="board" sourceId={displayDump.id} sourceTitle={displayDump.title || 'Sin título'} />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="h-3 shrink-0" />

                                    {/* ROW 2: ACTION BUTTONS */}
                                    <div className="flex items-center justify-between gap-1.5 flex-wrap pl-1">
                                        {/* LEFT GROUP: Utilidades principales */}
                                        <div className="flex items-center gap-1.5">
                                            {/* + Sub-pizarrón */}
                                            <button
                                                onClick={handleCreateSubpizarron}
                                                title="Nuevo sub-pizarrón"
                                                className="flex items-center justify-center px-3 h-[32.5px] rounded-xl text-[13px] font-bold border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all active:scale-95"
                                            >
                                                <ListPlus size={13} className="mr-1.5" />
                                                <span>+</span>
                                            </button>

                                            {/* AI */}
                                            <button
                                                onClick={() => setShowAIInput(v => !v)}
                                                title={showAIInput ? 'Ocultar panel AI' : 'Abrir panel AI'}
                                                className={`flex items-center px-3 h-[32.5px] rounded-xl text-[13px] font-medium border transition-all ${showAIInput
                                                    ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/40 shadow-sm'
                                                    : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-violet-500/50 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-400'
                                                    }`}
                                            >
                                                <Sparkles size={13} />
                                            </button>

                                            {/* Pizarrón */}
                                            <button
                                                onClick={() => setIsBraindumpPizarronOpen(!isBraindumpPizarronOpen)}
                                                title={isBraindumpPizarronOpen ? 'Ocultar pizarrón' : 'Abrir pizarrón'}
                                                className={`flex items-center px-3 h-[32.5px] rounded-xl text-[13px] font-medium border transition-all ${isBraindumpPizarronOpen
                                                    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/40 shadow-sm'
                                                    : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-amber-500/50 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-400'
                                                    }`}
                                            >
                                                <PenLine size={13} />
                                            </button>

                                            {/* Hash (line numbers) */}
                                            {showLineNumbers && onToggleLineNumbers && (
                                                <button
                                                    onClick={onToggleLineNumbers}
                                                    className="flex items-center px-3 h-[32.5px] rounded-lg text-[13px] font-medium border border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 transition-all shadow-sm"
                                                    title="Ocultar números de línea"
                                                >
                                                    <Hash size={13} />
                                                </button>
                                            )}

                                            {/* Pin (only when pinned) */}
                                            {displayDump.is_pinned && (
                                                <button
                                                    onClick={() => autoSave(displayDump.id, { is_pinned: false })}
                                                    className="flex items-center px-3 h-[32.5px] rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 transition-all shadow-sm"
                                                    title="Desfijar Pizarrón"
                                                >
                                                    <Pin size={13} className="fill-current" />
                                                </button>
                                            )}
                                        </div>

                                        {/* RIGHT GROUP: Zen, Maximize, More */}
                                        <div className="flex items-center gap-1.5">
                                            {/* Zen */}
                                            <button
                                                onClick={() => toggleZenMode('braindump')}
                                                className={`p-2 rounded-xl border transition-all ${isZenMode
                                                    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500 shadow-sm'
                                                    : 'text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400'
                                                    }`}
                                                title={isZenMode ? "Salir de Modo Zen" : "Entrar a Modo Zen"}
                                            >
                                                <Wind size={13} />
                                            </button>

                                            {/* Maximize */}
                                            <button
                                                onClick={() => setIsBraindumpMaximized(!isBraindumpMaximized)}
                                                className={`hidden md:flex p-2 rounded-xl border transition-all ${isBraindumpMaximized
                                                    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500 shadow-sm'
                                                    : 'text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400'
                                                    }`}
                                                title={isBraindumpMaximized ? "Minimizar" : "Maximizar"}
                                            >
                                                {isBraindumpMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                                            </button>

                                            {/* More menu */}
                                            <div className="relative shrink-0 flex items-center" ref={openMenuId === displayDump.id ? menuRef : undefined}>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === displayDump.id ? null : displayDump.id); }}
                                                    className={`p-2 rounded-xl border transition-all ${openMenuId === displayDump.id
                                                        ? 'bg-[#4940D9] border-[#4940D9]/80 text-white font-bold shadow-lg shadow-[#4940D9]/20'
                                                        : 'text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400/60 dark:hover:border-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700/60 hover:text-zinc-700 dark:hover:text-zinc-300'
                                                        }`}
                                                    title="Más opciones"
                                                >
                                                    <MoreVertical size={13} />
                                                </button>

                                                {openMenuId === displayDump.id && (
                                                    <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-[#1A1A24] shadow-xl rounded-lg border border-zinc-200 dark:border-[#2D2D42] p-1 flex flex-col gap-0.5 min-w-[200px] animate-fadeIn">
                                                        {onToggleLineNumbers && (
                                                            <>
                                                                <button onClick={(e) => { e.stopPropagation(); onToggleLineNumbers(); setOpenMenuId(null); }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${showLineNumbers ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42]"}`}>
                                                                    <Hash size={14} /> {showLineNumbers ? "Ocultar números" : "Mostrar números"}
                                                                </button>
                                                            </>
                                                        )}
                                                        <button onClick={(e) => { e.stopPropagation(); autoSave(displayDump.id, { is_pinned: !displayDump.is_pinned }); setOpenMenuId(null); }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${displayDump.is_pinned ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42]'}`}>
                                                            <Pin size={14} className={displayDump.is_pinned ? "fill-current" : ""} /> {displayDump.is_pinned ? 'Desfijar Pizarrón' : 'Fijar Pizarrón'}
                                                        </button>
                                                        <div className="border-t border-zinc-100 dark:border-[#2D2D42] my-0.5" />

                                                        <button onClick={() => {
                                                            const willBeChecklist = !displayDump.is_checklist;
                                                            let contentToSave = displayDump.content;
                                                            if (willBeChecklist) {
                                                                contentToSave = serializeChecklistToMarkdown(parseMarkdownToChecklist(displayDump.content));
                                                            } else {
                                                                contentToSave = serializeChecklistToPlainMarkdown(parseMarkdownToChecklist(displayDump.content));
                                                            }
                                                            autoSave(displayDump.id, { is_checklist: willBeChecklist, content: contentToSave });
                                                            setOpenMenuId(null);
                                                        }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${displayDump.is_checklist ? 'text-[#1F3760] dark:text-blue-400 bg-blue-50 dark:bg-[#1F3760]/20' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42]'}`}>
                                                            <ListTodo size={14} />{displayDump.is_checklist ? 'Quitar Checklist' : 'Hacer Checklist'}
                                                        </button>

                                                        {!isInKanban && (
                                                            <button onClick={handleAddToKanban} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42] transition-colors">
                                                                <CheckSquare size={14} /> Añadir a Kanban
                                                            </button>
                                                        )}

                                                        <div className="border-t border-zinc-100 dark:border-[#2D2D42] my-0.5" />

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setLinkingPizarron(displayDump);
                                                                setIsLinkModalOpen(true);
                                                                setOpenMenuId(null);
                                                            }}
                                                            className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 transition-colors font-bold"
                                                        >
                                                            <ArrowUpRight size={14} /> Convertir a Nota
                                                        </button>

                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                const getAllTreeIds = (id: string): string[] => {
                                                                    const kids = dumps.filter(d => d.parent_id === id);
                                                                    return [id, ...kids.flatMap(k => getAllTreeIds(k.id))];
                                                                };
                                                                if (!displayDump) return;
                                                                const treeIds = getAllTreeIds(displayDump.id);
                                                                const { data: treeSummaries } = await supabase.from('summaries').select('*').in('brain_dump_id', treeIds);
                                                                const getRecursiveContent = (dumpId: string, depth: number): string => {
                                                                    const target = dumps.find(d => d.id === dumpId);
                                                                    if (!target) return "";
                                                                    let md = `${"#".repeat(depth)} ${target.title || 'Sin Título'}\n\n`;
                                                                    if (target.content) md += `${target.content}\n\n`;
                                                                    if (target.scratchpad?.trim()) {
                                                                        md += `${"#".repeat(depth + 1)} Pizarrón de: ${target.title || 'Sin Título'}\n\n${target.scratchpad}\n\n`;
                                                                    }
                                                                    const dumpSums = (treeSummaries || []).filter(s => s.brain_dump_id === dumpId);
                                                                    if (dumpSums.length > 0) {
                                                                        md += `${"#".repeat(depth + 1)} Análisis AI (${dumpSums.length})\n\n`;
                                                                        for (const s of dumpSums) {
                                                                            md += `${"#".repeat(depth + 2)} ${s.target_objective || 'Análisis'}\n\n${s.content || ''}\n\n`;
                                                                        }
                                                                    }
                                                                    const kids = dumps.filter(d => d.parent_id === dumpId);
                                                                    for (const kid of kids) {
                                                                        md += getRecursiveContent(kid.id, depth + 1);
                                                                    }
                                                                    return md;
                                                                };
                                                                const fullMarkdown = getRecursiveContent(displayDump.id, 1);
                                                                const element = document.createElement("a");
                                                                const file = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8;' });
                                                                element.href = URL.createObjectURL(file);
                                                                element.download = `${(displayDump.title || 'pizarron_completo').replace(/\s+/g, '_')}.md`;
                                                                document.body.appendChild(element);
                                                                element.click();
                                                                document.body.removeChild(element);
                                                                setOpenMenuId(null);
                                                            }}
                                                            className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42] transition-colors font-bold"
                                                        >
                                                            <Download size={14} /> Exportar (.md)
                                                        </button>

                                                        <div className="border-t border-zinc-100 dark:border-[#2D2D42] my-0.5" />
                                                        <button onClick={() => { changeStatus(displayDump.id, 'history'); setOpenMenuId(null); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors font-bold">
                                                            <ArchiveIcon size={14} /> Archivar Pizarrón
                                                        </button>
                                                        <button onClick={() => { deleteDump(displayDump.id); setOpenMenuId(null); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-bold">
                                                            <Trash2 size={14} /> Eliminar Permanentemente
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-[5px]" />

                                    {/* ROW 3: BREADCRUMB + TABS */}
                                    <div className="flex flex-col gap-2 w-full">
                                        <BrainDumpBreadcrumb
                                            path={breadcrumbPath}
                                            activeDumpId={displayDump.id}
                                            onNavigate={navigate}
                                        />

                                        {/* Tab bar */}
                                        <div className="relative group/tabbar shrink-0">
                                            {/* Arrow Left */}
                                            <div className={`absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white dark:from-[#1A1A24] to-transparent z-10 flex items-center justify-start pointer-events-none transition-opacity duration-150 ${canScrollTabsLeft ? 'opacity-100' : 'opacity-0'}`}>
                                                <button
                                                    onClick={() => scrollTabsHorizontally('left')}
                                                    className={`p-1 rounded-full bg-white dark:bg-zinc-800 shadow-md text-zinc-400 hover:text-amber-500 transition-all active:scale-95 border ${hasSearchMatchTabsLeft ? 'border-amber-500 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,192,45,0.4)] scale-110' : 'border-zinc-200 dark:border-zinc-700'} ml-1 ${canScrollTabsLeft ? 'pointer-events-auto' : 'pointer-events-none'}`}
                                                >
                                                    <ChevronLeft size={14} />
                                                </button>
                                            </div>

                                            <div ref={tabBarRef} className={`flex items-center gap-1.5 overflow-x-auto pt-2 pb-1 shrink-0 min-w-0 hidden-scrollbar px-10 transition-all ${(!canScrollTabsLeft && !canScrollTabsRight) ? 'justify-center' : 'justify-start'}`}>

                                                {/* Tab: Original (amber) */}
                                                {(() => {
                                                    const originalIsMatch = Boolean(searchQuery?.trim() && (
                                                        displayDump.title?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                                                        displayDump.content?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                                                        displayDump.scratchpad?.toLowerCase().includes(searchQuery.trim().toLowerCase())
                                                    ));
                                                    return (
                                                        <button
                                                            onClick={() => setActiveTab('original')}
                                                            data-active-tab={activeTab === 'original' || undefined}
                                                            data-is-match={originalIsMatch}
                                                            className={`relative flex items-center justify-center gap-1.5 px-4 h-[32.5px] rounded-xl text-[13px] font-medium whitespace-nowrap border shrink-0 transition-all active:scale-95 ${activeTab === 'original'
                                                                ? `bg-amber-50/80 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 shadow-sm ${originalIsMatch ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-[#1A1A24] shadow-[0_0_15px_rgba(251,192,45,0.4)]' : ''}`
                                                                : originalIsMatch
                                                                    ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-100 shadow-[0_0_8px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                                                                    : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-amber-500/50 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 transition-all'
                                                                }`}
                                                        >
                                                            {globalTasks?.some(t => t.id === focusedDumpId || t.linked_board_id === focusedDumpId) && (
                                                                <div className="absolute -top-1.5 -right-1.5 z-10">
                                                                    <KanbanSemaphore sourceType="board" sourceId={focusedDumpId!} sourceTitle="Pizarrón Original" />
                                                                </div>
                                                            )}
                                                            <PenTool size={12} className={activeTab === 'original' ? 'text-amber-600 dark:text-amber-300 shrink-0' : 'shrink-0'} />
                                                        </button>
                                                    );
                                                })()}

                                                {/* Unified tabs (sub-pizarrones + summaries) */}
                                                {unifiedTabs.map((tab) => {
                                                    if (tab.type === 'sub') {
                                                        const child = tab.data as BrainDump;
                                                        const isActive = activeTab === `sub_${child.id}`;
                                                        const isMatch = Boolean(searchQuery?.trim() && checkPizarronSearchMatch(child, searchQuery.trim(), dumps, allSummaries));

                                                        return (
                                                            <div key={child.id} className="relative shrink-0 flex items-center group">
                                                                <button
                                                                    onClick={() => setActiveTab(`sub_${child.id}`)}
                                                                    data-active-tab={isActive || undefined}
                                                                    data-is-match={isMatch}
                                                                    className={`flex items-center ${editingTabId === child.id ? 'gap-0' : 'gap-1.5'} px-3 h-[32.5px] rounded-xl text-[13px] font-medium whitespace-nowrap border transition-all active:scale-95 max-w-[320px] ${isActive
                                                                        ? `bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 shadow-sm ${isMatch ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-[#1A1A24] shadow-[0_0_15px_rgba(251,192,45,0.4)]' : ''}`
                                                                        : isMatch
                                                                            ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-100 shadow-[0_0_8px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                                                                            : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all'
                                                                        }`}
                                                                >
                                                                    {globalTasks?.some(t => t.id === child.id || t.linked_board_id === child.id) && (
                                                                        <div className="absolute -top-1.5 -right-1.5 z-10">
                                                                            <KanbanSemaphore sourceType="board" sourceId={child.id} sourceTitle={child.title || ''} />
                                                                        </div>
                                                                    )}
                                                                    {editingTabId !== child.id && (
                                                                        <span
                                                                            onClick={(e) => { e.stopPropagation(); navigate(child.id); }}
                                                                            className="p-0.5 -ml-1 hover:bg-emerald-500/20 rounded-md transition-colors cursor-pointer shrink-0"
                                                                            title="Entrar a este sub-pizarrón"
                                                                        >
                                                                            <GitBranch size={10} />
                                                                        </span>
                                                                    )}
                                                                    <SubnoteTitle
                                                                        child={child}
                                                                        isActive={isActive}
                                                                        searchQuery={searchQuery}
                                                                        onRename={(id, title) => autoSave(id, { title })}
                                                                        isEditing={editingTabId === child.id}
                                                                        setIsEditing={(val) => setEditingTabId(val ? child.id : null)}
                                                                    />
                                                                    {isActive && editingTabId !== child.id && (
                                                                        <span
                                                                            onClick={(e) => { e.stopPropagation(); deleteDump(child.id); }}
                                                                            className="ml-1 p-1 rounded-lg border border-transparent hover:border-white/20 hover:bg-black/20 transition-all text-white/70 hover:text-white active:scale-90"
                                                                            title="Borrar sub-pizarrón"
                                                                        >
                                                                            <Trash2 size={10} />
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        );
                                                    } else {
                                                        const s = tab.data as Summary;
                                                        const isProcessing = s.status === 'pending' || s.status === 'processing';
                                                        const isMatch = !isProcessing && Boolean(searchQuery?.trim() && (
                                                            s.content?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                                                            s.target_objective?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                                                            s.scratchpad?.toLowerCase().includes(searchQuery.trim().toLowerCase())
                                                        ));

                                                        if (isProcessing) {
                                                            return (
                                                                <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border shrink-0 max-w-[150px] bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-400 animate-pulse">
                                                                    <Loader2 size={10} className="animate-spin shrink-0" />
                                                                    <span className="truncate">{s.target_objective || 'Analizando...'}</span>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <button
                                                                key={s.id}
                                                                onClick={() => setActiveTab(activeTab === s.id ? 'original' : s.id)}
                                                                data-active-tab={activeTab === s.id || undefined}
                                                                data-is-match={isMatch}
                                                                className={`flex items-center ${editingTabId === s.id ? 'gap-0' : 'gap-1.5'} px-3 h-[32.5px] rounded-xl text-[13px] font-medium whitespace-nowrap border shrink-0 transition-all active:scale-95 max-w-[320px] ${activeTab === s.id
                                                                    ? `bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/40 shadow-sm ${isMatch ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-[#1A1A24] shadow-[0_0_15px_rgba(251,192,45,0.4)]' : ''}`
                                                                    : isMatch
                                                                        ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-100 shadow-[0_0_8px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                                                                        : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-violet-500/50 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-400 transition-all'
                                                                    }`}
                                                            >
                                                                {editingTabId !== s.id && <Sparkles size={10} className="shrink-0" />}
                                                                <span className="truncate">
                                                                    <SummaryTitle
                                                                        summary={s}
                                                                        isActive={activeTab === s.id}
                                                                        searchQuery={searchQuery}
                                                                        onRename={(id, newObj) => updateSummaryMetadata(id, { target_objective: newObj })}
                                                                        isEditing={editingTabId === s.id}
                                                                        setIsEditing={(val) => setEditingTabId(val ? s.id : null)}
                                                                    />
                                                                </span>
                                                            </button>
                                                        );
                                                    }
                                                })}
                                            </div>

                                            {/* Arrow Right */}
                                            <div className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white dark:from-[#1A1A24] to-transparent z-10 flex items-center justify-end pointer-events-none transition-opacity duration-150 ${canScrollTabsRight ? 'opacity-100' : 'opacity-0'}`}>
                                                <button
                                                    onClick={() => scrollTabsHorizontally('right')}
                                                    className={`p-1 rounded-full bg-white dark:bg-zinc-800 shadow-md text-zinc-400 hover:text-amber-500 transition-all active:scale-95 border ${hasSearchMatchTabsRight ? 'border-amber-500 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,192,45,0.4)] scale-110' : 'border-zinc-200 dark:border-zinc-700'} mr-1 ${canScrollTabsRight ? 'pointer-events-auto' : 'pointer-events-none'}`}
                                                >
                                                    <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ══ SPACER ══════════════════════════════════════════ */}
                                <div className="h-5 shrink-0" />

                                {/* ══ CONTENT ═════════════════════════════════════════ */}
                                <div className="px-[5px] pb-[5px] pt-0 w-full flex-1 flex flex-col min-h-0 gap-[10px]">

                                    {/* AI Input Panel */}
                                    {showAIInput && (
                                        <div className="shrink-0 mb-2">
                                            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 dark:bg-[#1A1A2E]/60 p-3 animate-fadeIn">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[11px] font-bold text-violet-400 flex items-center gap-1.5">
                                                        <Sparkles size={11} /> Consultar con IA
                                                    </span>
                                                    <button onClick={() => setShowAIInput(false)} className="text-zinc-400 hover:text-zinc-300 p-0.5">
                                                        <X size={13} />
                                                    </button>
                                                </div>
                                                <BrainDumpAIPanel
                                                    dumpId={currentDumpId!}
                                                    onGenerate={() => setShowAIInput(false)}
                                                    getNewOrderIndex={getNewOrderIndex}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Active tab content */}
                                    {(() => {
                                        const activeSubId = activeTab.startsWith('sub_') ? activeTab.replace('sub_', '') : null;
                                        const activeSub = activeSubId ? manualChildren.find(c => c.id === activeSubId) : null;
                                        const activeSummary = !activeSubId && activeTab !== 'original'
                                            ? completedSummaries.find(s => s.id === activeTab)
                                            : null;
                                        const showScratch = isBraindumpPizarronOpen;

                                        if (activeSummary) {
                                            return (
                                                <div className="flex-1 flex flex-col min-h-0 animate-fadeIn">
                                                    <SummaryTabContent
                                                        key={activeSummary.id}
                                                        summary={activeSummary}
                                                        noteFont={noteFont}
                                                        noteFontSize={noteFontSize}
                                                        noteLineHeight={noteLineHeight}
                                                        onDelete={(id) => { deleteSummary(id); setActiveTab('original'); }}
                                                        updateScratchpad={updateScratchpad}
                                                        updateContent={updateSummaryContent}
                                                        searchQuery={searchQuery}
                                                        showScratch={showScratch}
                                                        setShowScratch={(val) => {
                                                            const next = typeof val === 'function' ? val(showScratch) : val;
                                                            setIsBraindumpPizarronOpen(next);
                                                        }}
                                                        showLineNumbers={showLineNumbers}
                                                        triggerScrollToActive={triggerScrollToActive}
                                                        splitRatio={splitRatio}
                                                        onDividerMouseDown={handleDividerMouseDown}
                                                    />
                                                </div>
                                            );
                                        }

                                        const currentDump = activeSub || displayDump;
                                        return (
                                            <div className="flex-1 flex flex-col min-h-0 animate-fadeIn">
                                                <SubnoteTabContent
                                                    key={currentDump!.id}
                                                    dump={currentDump!}
                                                    showScratch={showScratch}
                                                    onUpdate={autoSave}
                                                    splitRatio={splitRatio}
                                                    onDividerMouseDown={handleDividerMouseDown}
                                                    splitContainerRef={splitContainerRef}
                                                    noteFont={noteFont}
                                                    noteFontSize={noteFontSize}
                                                    noteLineHeight={noteLineHeight}
                                                    searchQuery={searchQuery}
                                                    showLineNumbers={showLineNumbers}
                                                    triggerScrollToActive={triggerScrollToActive}
                                                    isSubpizarron={!!activeSub}
                                                />
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        );
                    })()}

                    {/* ── GRID LIST (no focused dump) ───────────────────────────── */}
                    {!focusedDumpId && (
                        <div className={`${isBraindumpMaximized ? 'max-w-full' : 'max-w-full md:max-w-6xl'} mx-auto w-full px-4 md:px-10 animate-fadeIn space-y-5 pb-10`}>
                            <div className={`grid ${isBraindumpMaximized ? 'grid-cols-[repeat(auto-fit,340px)] w-full max-w-[2160px]' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl'} gap-4 justify-center mx-auto`}>
                                {rootPizarrones.map(p => {
                                    const isMatch = searchQuery?.trim() && checkPizarronSearchMatch(p, searchQuery.trim(), dumps, allSummaries);
                                    return (
                                            <div
                                                key={p.id}
                                                onClick={() => setFocusedDumpId(p.id)}
                                                className={`group bg-white dark:bg-[#1A1A24] border rounded-2xl p-5 hover:shadow-xl transition-all cursor-pointer flex flex-col gap-3 relative animate-fadeIn active:scale-[0.98] ${isMatch
                                                    ? 'border-amber-500 shadow-[0_0_20px_rgba(251,192,45,0.2)]'
                                                    : 'border-zinc-200 dark:border-zinc-800 hover:border-amber-500/50 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                                                    }`}
                                            >
                                            <div className="flex items-center justify-between gap-2">
                                                <h3 className="font-bold text-zinc-800 dark:text-[#CCCCCC] truncate flex-1">
                                                    {searchQuery?.trim() ? highlightText(p.title || 'Sin Título', searchQuery.trim()) : (p.title || 'Sin Título')}
                                                </h3>
                                                <div className={`${globalTasks?.some(t => t.id === p.id || t.linked_board_id === p.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                                    <KanbanSemaphore sourceType="board" sourceId={p.id} sourceTitle={p.title || ''} onInteract={() => setFocusedDumpId(p.id)} />
                                                </div>
                                            </div>
                                            <div className="text-xs text-zinc-500 line-clamp-3 leading-relaxed min-h-[4.5em] overflow-hidden">
                                                {searchQuery?.trim() ? highlightText(p.content || '', searchQuery.trim()) : (p.content || <span className="italic opacity-40">Pizarrón vacío...</span>)}
                                            </div>
                                            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/60 mt-auto">
                                                <span className="text-[10px] font-bold text-zinc-400">{formatCleanDate(p.updated_at || p.created_at)}</span>
                                                <div className="flex items-center gap-2">
                                                    {p.is_checklist && <ListTodo size={12} className="text-amber-500/60" />}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); autoSave(p.id, { is_pinned: !p.is_pinned }); }}
                                                        className={`p-1.5 rounded-xl border transition-all active:scale-95 ${p.is_pinned ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500/40 text-amber-600 dark:text-amber-400' : 'bg-transparent border-transparent hover:bg-amber-50 dark:hover:bg-amber-900/20 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/30'}`}
                                                        title={p.is_pinned ? 'Quitar fijado' : 'Fijar pizarrón'}
                                                    >
                                                        <Pin size={14} className={p.is_pinned ? 'fill-current' : ''} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); changeStatus(p.id, 'history'); }}
                                                        className="p-1 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                        title="Archivar"
                                                    >
                                                        <ArchiveIcon size={14} />
                                                    </button>
                                                    <div className="w-6 h-6 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-400 group-hover:bg-[#4940D9] group-hover:text-white transition-all">
                                                        <ChevronRight size={14} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Archive */}
                            {archivo.length > 0 && (
                                <div className={`mt-5 space-y-4 animate-fadeIn ${isArchiveOpenByApp['braindump'] ? 'pb-20' : 'pb-10'}`}>
                                    <button
                                        onClick={() => setArchiveOpenByApp('braindump', !isArchiveOpenByApp['braindump'])}
                                        className="flex items-center gap-3 text-zinc-400 font-bold uppercase tracking-widest text-xs px-2 hover:text-amber-600 transition-colors group/archheader"
                                    >
                                        <ArchiveIcon size={16} className="text-zinc-500/50 group-hover/archheader:text-amber-500/50 transition-colors" />
                                        <span>Archivo ({archivo.length})</span>
                                        <ChevronDown size={14} className={`transition-transform duration-300 ${isArchiveOpenByApp['braindump'] ? '' : '-rotate-90'}`} />
                                    </button>

                                    {isArchiveOpenByApp['braindump'] && (
                                        <div className={`grid ${isBraindumpMaximized ? 'grid-cols-[repeat(auto-fit,340px)] w-full max-w-[2160px]' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl'} gap-4 justify-center mx-auto`}>
                                            {archivo.map(a => (
                                                <div key={a.id} className="p-4 bg-white dark:bg-[#1A1A24]/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-between group hover:border-amber-500/50 hover:bg-amber-50/50 dark:hover:bg-amber-500/10 hover:shadow-xl transition-all active:scale-[0.98]">
                                                    <div className="flex items-center gap-3 truncate">
                                                        <div className="w-8 h-8 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-400">
                                                            <ArchiveIcon size={16} />
                                                        </div>
                                                        <div className="flex flex-col truncate">
                                                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 truncate">{a.title || 'Sin Título'}</span>
                                                            <span className="text-[10px] text-zinc-400 font-medium">{formatCleanDate(a.updated_at || a.created_at)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button
                                                            onClick={() => changeStatus(a.id, 'main')}
                                                            className="p-2 rounded-xl border border-transparent hover:border-amber-500/30 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all active:scale-95"
                                                            title="Restaurar"
                                                        >
                                                            <RotateCcw size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteDump(a.id)}
                                                            className="p-2 rounded-xl border border-transparent hover:border-red-500/30 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {isLinkModalOpen && linkingPizarron && (
                <PizarronLinkerModal
                    pizarron={linkingPizarron}
                    groups={groups}
                    onClose={() => setIsLinkModalOpen(false)}
                    onSuccess={(groupId, noteId) => { setIsLinkModalOpen(false); onOpenNote?.(groupId, noteId); }}
                />
            )}
        </div>
    );
};