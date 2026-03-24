import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Bell, Trash2, Clock, History as HistoryIcon, Wrench, Play, CheckCircle2, Circle, RotateCcw, Repeat, Check, ChevronDown, ChevronUp, Settings2, Archive as ArchiveIcon, MoreVertical } from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { SmartNotesEditor } from '../src/components/editor/SmartNotesEditor';
import { useUIStore } from '../src/lib/store';

// --- TYPES ---
type ReminderStatus = 'main' | 'active' | 'history';
type RecurrenceType = 'none' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'bimonthly'; 

interface ReminderTarget {
    id: string; title: string; due_at: string; is_completed: boolean; recurrence?: RecurrenceType; last_completed_at?: string;
    prev_due_at?: string; prev_completed_at?: string;
}

interface AdvancedReminder {
    id: string; title: string; content: string; status: ReminderStatus; targets: ReminderTarget[]; created_at: string; updated_at: string; user_id: string;
}

const recurrenceLabels: Record<string, string> = {
    none: 'Una vez', hourly: 'Cada hora', daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual', bimonthly: 'Cada 2 meses'
};

const THRESHOLDS_MS: Record<RecurrenceType, number> = {
    none: 0,
    hourly: 0,
    daily: 1000 * 60 * 60 * 4,
    weekly: 1000 * 60 * 60 * 24 * 1,
    monthly: 1000 * 60 * 60 * 24 * 5,
    bimonthly: 1000 * 60 * 60 * 24 * 7
};

function getDerivedReminderState(dueAtIso: string, recurrence: RecurrenceType = 'none', isCompletedDB: boolean) {
    if (recurrence === 'none') {
        return { isVisuallyPending: !isCompletedDB, isSleeping: isCompletedDB };
    }
    const now = Date.now();
    const nextDue = new Date(dueAtIso).getTime();
    if (isNaN(nextDue)) return { isVisuallyPending: true, isSleeping: false };
    const activationThreshold = nextDue - THRESHOLDS_MS[recurrence];
    const isTimeTorenderPending = now >= activationThreshold;

    return {
        isVisuallyPending: isTimeTorenderPending,
        isSleeping: !isTimeTorenderPending 
    };
}

const toLocalDateTimeLocal = (isoString?: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

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

const formatCustomDate = (isoString: string, dateFormat: string, timeFormat: string): string => {
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const datePart = dateFormat === 'mm/dd/yyyy' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;

    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    let ampm = '';
    if (timeFormat === '12h') {
        ampm = hours >= 12 ? ' PM' : ' AM';
        hours = hours % 12 || 12;
    }
    return `${datePart}, ${hours.toString().padStart(2, '0')}:${minutes}${ampm}`;
};

const parseMarkdownPreview = (text: string) => {
    if (!text) return '';
    return text
        .replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\{=([^=}]+)=\}/g, '<mark class="bg-yellow-200/60 dark:bg-yellow-500/40 text-inherit rounded-sm px-1 font-medium">$1</mark>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/_([^_]+)_/g, '<em>$1</em>')
        .replace(/~~([^~]+)~~/g, '<del class="opacity-70">$1</del>')
        .replace(/^&gt;\s+(.*)$/gm, '<span class="border-l-2 border-indigo-400 dark:border-indigo-600 pl-2 ml-1 italic opacity-90 block my-1">$1</span>')
        .replace(/\[\[tr:([^|]+)\|([^\]]+)\]\]/g, '<span class="text-amber-600 dark:text-amber-400 font-bold border-b border-amber-400/50 border-dashed cursor-help" title="$1">$2</span>')
        .replace(/\[\[(ins|idea|op|duda|wow|pat|yo|ruido):[^\|]+\|([^\]]+)\]\]/g, '<span class="font-bold border-b border-zinc-400/50 border-dashed cursor-help">$2</span>')
        .replace(/\n/g, '<span class="mx-1 opacity-30 text-[10px]">&para;</span> ');
};

const getUrgencyColor = (dueAt: string, recurrence?: RecurrenceType) => {
    const now = new Date().getTime();
    const due = new Date(dueAt).getTime();
    const diffMs = due - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

    const FERRARI_RED = "text-[#ff2800] animate-pulse font-black";
    const ORANGE = "text-orange-500 animate-pulse font-bold";
    const YELLOW_PULSE = "text-yellow-400 animate-pulse font-bold";
    const YELLOW_SOLID = "text-yellow-500 font-bold";

    if (diffMs <= 0) return FERRARI_RED;
    if (recurrence === 'hourly' || recurrence === 'daily') {
        if (diffHours <= 2) return FERRARI_RED;       
        if (diffHours <= 6) return ORANGE;            
        if (diffHours <= 12) return YELLOW_PULSE;     
        return YELLOW_SOLID;
    }
    if (recurrence === 'weekly') {
        if (diffDays <= 1) return FERRARI_RED;        
        if (diffDays <= 2) return ORANGE;             
        if (diffDays <= 5) return YELLOW_PULSE;       
        return YELLOW_SOLID;
    }
    if (diffDays <= 1) return FERRARI_RED;            
    if (diffDays <= 5) return ORANGE;                 
    if (diffDays <= 15) return YELLOW_PULSE;          
    return YELLOW_SOLID;                              
};

const getRelativeTimeLeft = (dueAt: string) => {
    const diffMs = new Date(dueAt).getTime() - Date.now();
    const isPast = diffMs < 0;
    const abs = Math.abs(diffMs);
    const m = Math.floor(abs / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    let str = d > 0 ? `${d}d ${h % 24}h` : h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
    return isPast ? `Vencido hace ${str}` : `Faltan ${str}`;
};

const LiveCountdown: React.FC<{ dueAt: string; isSaved: boolean; isCompleted: boolean; recurrence?: RecurrenceType }> = ({ dueAt, isSaved, isCompleted, recurrence }) => {
    const [timeLeft, setTimeLeft] = useState('');
    const [isOverdue, setIsOverdue] = useState(false);

    useEffect(() => {
        if (isCompleted) { setTimeLeft('Completado'); return; }
        const calcTime = () => {
            const diffMs = new Date(dueAt).getTime() - Date.now();
            setIsOverdue(diffMs < 0);
            const absMs = Math.abs(diffMs);
            const mins = Math.floor(absMs / 60000);
            const secs = Math.floor((absMs % 60000) / 1000);
            if (mins > 1440) setTimeLeft(`${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440)/60)}h`);
            else if (mins > 60) setTimeLeft(`${Math.floor(mins / 60)}h ${mins % 60}m`);
            else setTimeLeft(`${mins}m ${secs}s`);
        };
        calcTime();
        const interval = setInterval(calcTime, 1000);
        return () => clearInterval(interval);
    }, [dueAt, isCompleted]);

    if (isCompleted) return <span className="text-zinc-500 line-through text-xs font-mono">{timeLeft}</span>;
    if (!isSaved) return <span className={`text-xs font-mono font-bold animate-pulse ${isOverdue ? 'text-red-500' : 'text-amber-500'}`}>{isOverdue ? '-' : '-'}{timeLeft}</span>;
    return <span className={`text-xs font-mono font-bold flex items-center gap-1 ${isOverdue ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-indigo-600 dark:text-indigo-400'}`}>{isOverdue ? `Vencido hace ${timeLeft}` : `Faltan ${timeLeft}`}</span>;
};

export const RemindersApp: React.FC<{ session: Session, dateFormat?: string, timeFormat?: string }> = ({ session, dateFormat = 'dd/mm/yyyy', timeFormat = '12h' }) => {
    const [reminders, setReminders] = useState<AdvancedReminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedActiveIds, setExpandedActiveIds] = useState<Set<string>>(new Set());
    const [editingActiveIds, setEditingActiveIds] = useState<Set<string>>(new Set());
    const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set()); 
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
    const lastActionTimeRef = useRef<number>(0);
    const { setOverdueRemindersCount, setImminentRemindersCount, showOverdueMarquee, setShowOverdueMarquee, overdueRemindersCount } = useUIStore();

    const fetchReminders = useCallback(async (silent = false) => {
        // Guard: Ignore background re-fetches if we just performed a manual action (2s window)
        if (silent && (Date.now() - lastActionTimeRef.current < 2000)) return;

        if (!silent) setLoading(true);
        try {
            const { data, error } = await supabase.from('reminders').select('*').eq('user_id', session.user.id).order('updated_at', { ascending: false }).order('created_at', { ascending: false });
            if (error) throw error;
            setReminders(data as AdvancedReminder[]);
        } catch (e: any) { console.error(e.message); } finally { if (!silent) setLoading(false); }
    }, [session.user.id]);

    useEffect(() => { 
        fetchReminders(); 
    }, [fetchReminders]);

    useEffect(() => {
        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        let overdueCount = 0; 
        let imminentCount = 0;
        reminders.forEach(r => {
            if (r.status === 'active') { 
                const hasOverdue = r.targets.some(t => !t.is_completed && new Date(t.due_at) <= now);
                const hasImminent = r.targets.some(t => !t.is_completed && new Date(t.due_at) > now && new Date(t.due_at) <= in24h);
                if (hasOverdue) overdueCount++;
                else if (hasImminent) imminentCount++;
            }
        });
        setOverdueRemindersCount(overdueCount);
        setImminentRemindersCount(imminentCount);
    }, [reminders, setOverdueRemindersCount, setImminentRemindersCount]);

    const addTarget = (reminderId: string, minutes: number = 0) => {
        const reminder = reminders.find(r => r.id === reminderId);
        if (!reminder) return;
        const due = new Date(Date.now() + minutes * 60000).toISOString();
        const newTarget: ReminderTarget = { id: crypto.randomUUID(), title: '', due_at: due, is_completed: false, recurrence: 'none' };
        autoSave(reminderId, { targets: [...reminder.targets, newTarget] });
    };

    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        if (activeMenuId) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [activeMenuId]);

    const autoSave = (id: string, updates: Partial<AdvancedReminder>) => {
        setReminders(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
        if (saveTimeoutRef.current[id]) clearTimeout(saveTimeoutRef.current[id]);
        saveTimeoutRef.current[id] = setTimeout(async () => { await supabase.from('reminders').update(updates).eq('id', id); }, 500);
    };

    const createNewDraft = async () => {
        const { data: newMain } = await supabase.from('reminders').insert([{ title: '', content: '', status: 'main', user_id: session.user.id, targets: [], due_at: new Date().toISOString() }]).select().single();
        if (newMain) setReminders(prev => [newMain as AdvancedReminder, ...prev]);
    };

    const changeStatus = async (id: string, newStatus: ReminderStatus) => {
        setReminders(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
        await supabase.from('reminders').update({ status: newStatus }).eq('id', id);
        if (newStatus === 'history') {
            setExpandedActiveIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            setEditingActiveIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        }
    };

    const deleteReminder = async (id: string) => {
        if (!window.confirm('¿Eliminar permanentemente este recordatorio?')) return;
        if (saveTimeoutRef.current[id]) {
            clearTimeout(saveTimeoutRef.current[id]);
            delete saveTimeoutRef.current[id];
        }
        setReminders(prev => prev.filter(r => r.id !== id));
        await supabase.from('reminders').delete().eq('id', id);
    };

    const calculateNextDate = (currentDate: string, recurrence: RecurrenceType): string => {
        let d = new Date(currentDate);
        const now = Date.now();
        
        // Loop to ensure the next calculated date is actually in the future.
        // If a task is severely overdue (e.g., missed 3 days of daily tasks),
        // checking it once will catch it up to the next future occurrence.
        do {
            if (recurrence === 'hourly') d.setHours(d.getHours() + 1);
            else if (recurrence === 'daily') d.setDate(d.getDate() + 1);
            else if (recurrence === 'weekly') d.setDate(d.getDate() + 7);
            else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
            else if (recurrence === 'bimonthly') d.setMonth(d.getMonth() + 2);
        } while (d.getTime() <= now && recurrence !== 'none');
        
        return d.toISOString();
    };

    const calculatePreviousDate = (currentDate: string, recurrence: RecurrenceType): string => {
        const d = new Date(currentDate);
        if (recurrence === 'hourly') d.setHours(d.getHours() - 1);
        else if (recurrence === 'daily') d.setDate(d.getDate() - 1);
        else if (recurrence === 'weekly') d.setDate(d.getDate() - 7);
        else if (recurrence === 'monthly') d.setMonth(d.getMonth() - 1);
        else if (recurrence === 'bimonthly') d.setMonth(d.getMonth() - 2);
        return d.toISOString();
    };

    const toggleTargetComplete = (reminderId: string, targetId: string) => {
        const reminder = reminders.find(r => r.id === reminderId);
        if (!reminder) return;
        window.dispatchEvent(new CustomEvent('reminder-attended', { detail: targetId }));

        const newTargets = reminder.targets.map(t => {
            if (t.id === targetId) {
                const isRecurrent = t.recurrence && t.recurrence !== 'none';
                
                if (isRecurrent) {
                    const { isSleeping } = getDerivedReminderState(t.due_at, t.recurrence, t.is_completed);
                    
                    // UNDO: Si el usuario presiona en periodo de gracia, restauramos el pasado
                    if (isSleeping) {
                        return { 
                            ...t, 
                            due_at: t.prev_due_at || calculatePreviousDate(t.due_at, t.recurrence!), 
                            last_completed_at: t.prev_completed_at || (t.last_completed_at ? calculatePreviousDate(t.last_completed_at, t.recurrence!) : undefined),
                            is_completed: false 
                        };
                    }
                    // CHECK: Proyecta al futuro y guarda la ventana de tiempo en los prev_
                    return { 
                        ...t, 
                        prev_due_at: t.due_at,
                        prev_completed_at: t.last_completed_at,
                        due_at: calculateNextDate(t.due_at, t.recurrence!), 
                        is_completed: false, 
                        last_completed_at: new Date().toISOString() 
                    };
                }
                
                // Tareas únicas normales
                return { ...t, is_completed: !t.is_completed, last_completed_at: !t.is_completed ? new Date().toISOString() : t.last_completed_at };
            }
            return t;
        });
        const allDone = newTargets.every(t => t.is_completed);
        lastActionTimeRef.current = Date.now(); // Set guard timestamp

        if (allDone) {
            setReminders(prev => prev.map(r => r.id === reminderId ? { ...r, targets: newTargets, status: 'history' } : r));
            supabase.from('reminders').update({ targets: newTargets, status: 'history' }).eq('id', reminderId).then();
        } else {
            setReminders(prev => prev.map(r => r.id === reminderId ? { ...r, targets: newTargets } : r));
            supabase.from('reminders').update({ targets: newTargets }).eq('id', reminderId).then();
        }
    };

    const toggleExpandActive = (id: string) => setExpandedActiveIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const toggleEditActive = (id: string) => setEditingActiveIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const toggleExpandHistory = (id: string) => setExpandedHistoryIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

    if (loading) return <div className="p-10 text-center animate-pulse text-zinc-500">Cargando Tiempos...</div>;

    const sortAlpha = (arr: AdvancedReminder[]) => [...arr].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    const drafts = sortAlpha(reminders.filter(r => r.status === 'main'));
    const activeReminders = sortAlpha(reminders.filter(r => r.status === 'active'));
    const history = sortAlpha(reminders.filter(r => r.status === 'history'));

    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-[#13131A] overflow-hidden">
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#13131A]/90 backdrop-blur-md shrink-0 border-b border-zinc-200 dark:border-zinc-800 shadow-sm transition-all">
                <div className="py-[10px] flex flex-col items-center justify-center">
                    <div className="max-w-6xl mx-auto w-full flex flex-row items-center justify-center md:justify-between px-6 gap-4">
                    <h1 className="hidden md:flex text-xl font-bold text-zinc-800 dark:text-[#CCCCCC] items-center gap-3">
                        <div className="hidden md:flex h-9 w-9 items-center justify-center bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/40 rounded-xl shadow-sm shrink-0">
                            <Bell size={20} />
                        </div>
                        <span className="truncate">Recordatorios</span>
                    </h1>
                    
                    <div className="flex items-center justify-center gap-2 sm:gap-3 shrink-0">
                        {/* Botón Toggle Reminder */}
                        <button
                          onClick={() => overdueRemindersCount > 0 && setShowOverdueMarquee(!showOverdueMarquee)}
                          disabled={overdueRemindersCount === 0}
                          className={`hidden md:flex h-9 px-3 rounded-xl transition-all active:scale-95 shrink-0 flex items-center gap-2 border ${
                            showOverdueMarquee 
                              ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/40 shadow-sm shadow-red-600/10' 
                              : overdueRemindersCount > 0
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40'
                                : 'bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-400 opacity-60 cursor-not-allowed'
                          }`}
                          title={overdueRemindersCount === 0 ? "No hay recordatorios vencidos" : showOverdueMarquee ? "Ocultar Recordatorios" : "Mostrar Recordatorios"}
                        >
                          <Bell size={18} className={overdueRemindersCount > 0 ? `animate-pulse ${showOverdueMarquee ? 'text-red-700 dark:text-red-400' : 'text-red-500'}` : ''} />
                          {overdueRemindersCount > 0 && (
                            <span className="text-xs font-bold whitespace-nowrap">
                              {overdueRemindersCount}
                            </span>
                          )}
                        </button>

                        <button onClick={createNewDraft} className="h-9 w-9 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/40 rounded-lg shadow-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all flex items-center justify-center active:scale-95 shrink-0" title="Nuevo recordatorio">
                            <Plus size={18} />
                        </button>
                    </div>
                </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#13131A] px-4 pb-4 pt-5 hidden-scrollbar">
                <div className="max-w-6xl mx-auto flex flex-col space-y-5 pb-20">
                    
                    {/* 1. CREACIÓN */}
                    {drafts.length > 0 && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase tracking-widest text-xs px-2 mb-2">
                                <Wrench size={16} /> Creación ({drafts.length})
                            </div>
                            {drafts.map(draft => (
                                <div key={draft.id} className="bg-white dark:bg-[#1A1A24] rounded-2xl shadow-lg border border-zinc-200 dark:border-[#2D2D42] transition-all duration-300 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 focus-within:ring-2 focus-within:ring-[#1F3760]/50 flex flex-col overflow-hidden animate-fadeIn">
                                    {/* HEADER CON BOTONES ESTILO PIZARRON */}
                                    <div className="flex items-center justify-between p-4 pb-2">
                                        <input 
                                            type="text" 
                                            placeholder="Título general (ej. Servicios Públicos)" 
                                            value={draft.title} 
                                            onChange={e => autoSave(draft.id, { title: e.target.value })} 
                                            className="w-full bg-transparent text-xl font-bold text-zinc-800 dark:text-[#CCCCCC] outline-none placeholder-zinc-400" 
                                        />
                                        
                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* Botón Activar (Play) - Estilo Pizarrón */}
                                            <button 
                                                onClick={() => changeStatus(draft.id, 'active')} 
                                                disabled={draft.targets.length === 0} 
                                                className="h-9 w-9 flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 rounded-xl shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all disabled:opacity-50 active:scale-95"
                                                title="Activar todos"
                                            >
                                                <Play size={13} fill="currentColor" />
                                            </button>

                                            {/* Menú Tres Puntos (Caneca adentro) */}
                                            <div className="relative">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveMenuId(activeMenuId === draft.id ? null : draft.id);
                                                    }}
                                                    className={`h-9 w-9 rounded-xl border transition-all flex items-center justify-center ${activeMenuId === draft.id ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-400 font-bold shadow-sm' : 'text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-indigo-500/30 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10'}`}
                                                >
                                                    <MoreVertical size={13} />
                                                </button>

                                                {activeMenuId === draft.id && (
                                                    <div className="absolute right-0 top-full mt-1 z-50 min-w-[210px] bg-white dark:bg-[#1A1A24] border border-zinc-200 dark:border-[#2D2D42] rounded-lg shadow-xl p-1 flex flex-col gap-0.5 animate-fadeIn">
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm('¿Descartar completamente este borrador?')) {
                                                                    if (saveTimeoutRef.current[draft.id]) {
                                                                        clearTimeout(saveTimeoutRef.current[draft.id]);
                                                                        delete saveTimeoutRef.current[draft.id];
                                                                    }
                                                                    setReminders(prev => prev.filter(r => r.id !== draft.id));
                                                                    supabase.from('reminders').delete().eq('id', draft.id).then();
                                                                    setActiveMenuId(null);
                                                                }
                                                            }}
                                                            className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-bold"
                                                        >
                                                            <Trash2 size={14} /> <span className="flex-1">Descartar Borrador</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* EDITOR */}
                                    <div className="mb-4 bg-zinc-50 dark:bg-[#242432] border border-zinc-200 dark:border-[#2D2D42] rounded-xl p-4 cursor-text min-h-[120px] mx-4">
                                        <SmartNotesEditor noteId={draft.id} initialContent={draft.content} onChange={c => autoSave(draft.id, { content: c })} />
                                    </div>

                                    {/* TIEMPOS */}
                                    <div className="bg-zinc-50 dark:bg-[#13131A] rounded-xl mx-4 mb-4 p-4 border border-zinc-200 dark:border-[#2D2D42]">
                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tiempos:</span>
                                            <div className="flex gap-1.5">
                                                {[1, 10, 30, 60].map(m => (
                                                    <button key={m} onClick={() => addTarget(draft.id, m)} className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-lg border border-indigo-500/20 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30 transition-all">+{m}m</button>
                                                ))}
                                                <button onClick={() => addTarget(draft.id, 0)} className="h-6 w-6 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 transition-all"><Plus size={12}/></button>
                                            </div>
                                        </div>
                                        <div className="space-y-3 mt-4">
                                            {draft.targets.map((target, idx) => (
                                                <div key={target.id} className="flex flex-col group p-3 bg-zinc-50 dark:bg-[#13131A]/30 rounded-xl border border-zinc-200 dark:border-[#2D2D42]/80 hover:border-zinc-200 transition-colors">
                                                    <div className="flex flex-wrap justify-between items-start w-full gap-2">
                                                        <input
                                                            value={target.title}
                                                            onChange={e => { const newT = draft.targets.map((t, i) => i === idx ? { ...t, title: e.target.value } : t); autoSave(draft.id, { targets: newT }); }}
                                                            placeholder="Título del recordatorio"
                                                            className="flex-1 bg-transparent text-sm font-bold text-zinc-800 dark:text-[#CCCCCC] outline-none placeholder-zinc-400 dark:placeholder-zinc-600"
                                                        />
                                                        <div className="flex items-center gap-3 shrink-0 ml-auto">
                                                            <div className="text-[11px] font-bold text-[#7E7E85] flex items-center">
                                                                <LiveCountdown dueAt={target.due_at} isSaved={false} isCompleted={target.is_completed} recurrence={target.recurrence} />
                                                            </div>
                                                            <button onClick={() => { autoSave(draft.id, { targets: draft.targets.filter(t => t.id !== target.id) }); }} className="text-zinc-400 hover:text-red-500 transition-colors" title="Eliminar"><Trash2 size={16}/></button>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[11px] flex-wrap mt-1.5">
                                                        <input type="datetime-local" value={toLocalDateTimeLocal(target.due_at)} onChange={e => { const newT = draft.targets.map((t, i) => i === idx ? { ...t, due_at: new Date(e.target.value).toISOString() } : t); autoSave(draft.id, { targets: newT }); }} className="w-full sm:w-auto bg-white dark:bg-[#1A1A24] border border-zinc-200 dark:border-[#2D2D42] rounded py-1 px-2 text-zinc-800 dark:text-[#CCCCCC] font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                                                        <span className="text-zinc-300 dark:text-zinc-700 font-bold">|</span>
                                                        <select value={target.recurrence || 'none'} onChange={e => { const newT = draft.targets.map((t, i) => i === idx ? { ...t, recurrence: e.target.value as RecurrenceType } : t); autoSave(draft.id, { targets: newT }); }} className="w-full sm:w-auto bg-white dark:bg-[#1A1A24] border border-zinc-200 dark:border-[#2D2D42] rounded py-1 px-2 text-zinc-800 dark:text-[#CCCCCC] font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer">
                                                            {Object.entries(recurrenceLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 2. ACTIVOS */}
                    {activeReminders.length > 0 && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase tracking-widest text-xs px-2 mb-2">
                                <Clock size={16} /> Activos y Corriendo ({activeReminders.length})
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {activeReminders.map(r => {
                                    const isExpanded = expandedActiveIds.has(r.id);
                                    const isEditing = editingActiveIds.has(r.id);

                                    const createdMs = new Date(r.created_at).getTime();
                                    const updatedMs = new Date(r.updated_at).getTime();
                                    const isEdited = (updatedMs - createdMs) > 60000;

                                    return (
                                        /* 🚀 FIX: border-0 removed because we already have overflow-hidden in container if we อยาก edge-to-edge but let's keep the user shadow approach */
                                        <div key={r.id} className="bg-white dark:bg-[#1A1A24] rounded-2xl shadow-lg transition-all duration-300 flex flex-col border border-zinc-200 dark:border-[#2D2D42] hover:border-[#225B49]/50 hover:shadow-xl hover:shadow-[#225B49]/5 focus-within:ring-2 focus-within:ring-[#1F3760]/50 overflow-hidden">
                                            <div className="p-5 pb-4">
                                                {/* HEADER */}
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-3 flex-1">
                                                        {!isEditing && (
                                                            <button onClick={() => toggleExpandActive(r.id)} className="h-9 w-9 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl transition-all active:scale-95 shrink-0" title="Desplegar nota">
                                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                            </button>
                                                        )}
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                placeholder="Título del recordatorio"
                                                                value={r.title}
                                                                onChange={e => autoSave(r.id, { title: e.target.value })}
                                                                className="w-full bg-transparent text-xl font-bold text-zinc-800 dark:text-[#CCCCCC] p-0 outline-none placeholder-zinc-400"
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <h3 className={`font-bold text-lg transition-colors duration-300 ${isExpanded ? 'text-zinc-800 dark:text-[#CCCCCC]' : 'text-[#4D4D54]'}`}>{r.title || 'Recordatorio Activo'}</h3>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {isEditing && (
                                                            <button 
                                                                onClick={() => toggleEditActive(r.id)} 
                                                                className="h-9 w-9 flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 rounded-xl shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all active:scale-95"
                                                                title="Guardar cambios"
                                                            >
                                                                <Check size={18} strokeWidth={3} />
                                                            </button>
                                                        )}
                                                        
                                                        <button 
                                                            onClick={() => toggleEditActive(r.id)} 
                                                            className={`h-9 w-9 flex items-center justify-center transition-all rounded-xl border ${isEditing ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-400 shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-indigo-500/30'}`} 
                                                            title={isEditing ? 'Cerrar Edición' : 'Ajustar recordatorio'}
                                                        >
                                                            <Wrench size={13}/>
                                                        </button>

                                                        {/* Menú Tres Puntos */}
                                                        <div className="relative">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveMenuId(activeMenuId === r.id ? null : r.id);
                                                                }}
                                                                className={`h-9 w-9 rounded-xl border transition-all flex items-center justify-center ${activeMenuId === r.id ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-400 font-bold shadow-sm' : 'text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-indigo-500/30 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10'}`}
                                                                title="Más opciones"
                                                            >
                                                                <MoreVertical size={13} />
                                                            </button>

                                                            {activeMenuId === r.id && (
                                                                <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] bg-white dark:bg-[#1A1A24] border border-zinc-200 dark:border-[#2D2D42] rounded-lg shadow-xl p-1 flex flex-col gap-0.5 animate-fadeIn">
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            changeStatus(r.id, 'history');
                                                                            setActiveMenuId(null);
                                                                        }}
                                                                        className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors font-bold"
                                                                    >
                                                                        <ArchiveIcon size={14} /> <span className="flex-1">Archivar Grupo</span>
                                                                    </button>
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            deleteReminder(r.id);
                                                                            setActiveMenuId(null);
                                                                        }}
                                                                        className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-bold"
                                                                    >
                                                                        <Trash2 size={14} /> <span className="flex-1">Eliminar Permanentemente</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                                             <div className="mt-2">
                                                    <style>{`
                                                        .reminder-content-wrapper.is-collapsed .cm-content,
                                                        .reminder-content-wrapper.is-collapsed .cm-line {
                                                            color: #4D4D54 !important;
                                                        }
                                                        .reminder-editor-view-mode {
                                                            padding-left: 2.75rem;
                                                            margin-bottom: 1rem;
                                                        }
                                                        .reminder-editor-edit-mode {
                                                            margin-bottom: 1rem;
                                                            padding: 1rem;
                                                            border-radius: 0.75rem;
                                                            background-color: rgba(244, 244, 245, 0.5);
                                                            border: 1px solid #e4e4e7;
                                                            min-height: 120px;
                                                        }
                                                        .dark .reminder-editor-edit-mode {
                                                            background-color: rgba(19, 19, 26, 0.5);
                                                            border-color: #2D2D42;
                                                        }
                                                        /* 🚀 KILL Focus Flash */
                                                        .reminder-editor-container .cm-content:focus,
                                                        .reminder-editor-container .cm-editor:focus,
                                                        .reminder-editor-container .cm-content:focus-within,
                                                        .reminder-editor-container .cm-editor:focus-within {
                                                            outline: none !important;
                                                            box-shadow: none !important;
                                                        }
                                                    `}</style>
                                                    
                                                    <div className={`reminder-editor-container ${isEditing ? 'reminder-editor-edit-mode animate-fadeIn' : `reminder-editor-view-mode ${isExpanded ? 'opacity-100' : 'line-clamp-2 max-h-[40px] pointer-events-none is-collapsed'} reminder-content-wrapper`} outline-none ring-0`}>
                                                        <SmartNotesEditor 
                                                            noteId={r.id} 
                                                            initialContent={r.content} 
                                                            onChange={content => isEditing && autoSave(r.id, { content })} 
                                                            readOnly={!isEditing} 
                                                        />
                                                    </div>

                                                    {isEditing && (
                                                        <div className="bg-zinc-50 dark:bg-[#13131A] rounded-xl p-4 border border-zinc-200 dark:border-[#2D2D42]">
                                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                                                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Ajustar Tiempos:</span>
                                                                <div className="flex gap-2">
                                                                    {[1, 10, 30, 60].map(m => (
                                                                        <button key={m} onClick={() => addTarget(r.id, m)} className="text-[10px] font-normal bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-md">+{m}m</button>
                                                                    ))}
                                                                    <button onClick={() => addTarget(r.id, 0)} className="text-[10px] font-normal bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded-md hover:bg-zinc-300"><Plus size={12}/></button>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="space-y-2">
                                                                {r.targets.map((target, idx) => (
                                                                    <div key={target.id} className="flex flex-col gap-2 p-3 bg-white dark:bg-[#1A1A24] rounded-lg border border-zinc-200 dark:border-[#2D2D42]">
                                                                        <div className="flex justify-between items-center">
                                                                            <input 
                                                                                type="text" 
                                                                                value={target.title} 
                                                                                onChange={e => { const newT = r.targets.map((t, i) => i === idx ? { ...t, title: e.target.value } : t); autoSave(r.id, { targets: newT }); }} 
                                                                                className="bg-transparent text-sm font-bold text-zinc-800 dark:text-[#CCCCCC] p-0 outline-none flex-1"
                                                                                placeholder="Tarea del recordatorio..."
                                                                            />
                                                                            <button onClick={() => { autoSave(r.id, { targets: r.targets.filter(t => t.id !== target.id) }); }} className="text-zinc-400 hover:text-red-500 transition-colors" title="Eliminar"><Trash2 size={16}/></button>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 text-[11px] flex-wrap mt-1.5">
                                                                            <input type="datetime-local" value={toLocalDateTimeLocal(target.due_at)} onChange={e => { const newT = r.targets.map((t, i) => i === idx ? { ...t, due_at: new Date(e.target.value).toISOString() } : t); autoSave(r.id, { targets: newT }); }} className="bg-white dark:bg-[#1A1A24] border border-zinc-200 dark:border-[#2D2D42] rounded py-1 px-2 text-zinc-800 dark:text-[#CCCCCC] font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                                                                            <span className="text-zinc-300 dark:text-zinc-700 font-bold">|</span>
                                                                            <select value={target.recurrence || 'none'} onChange={e => { const newT = r.targets.map((t, i) => i === idx ? { ...t, recurrence: e.target.value as RecurrenceType } : t); autoSave(r.id, { targets: newT }); }} className="bg-white dark:bg-[#1A1A24] border border-zinc-200 dark:border-[#2D2D42] rounded py-1 px-2 text-zinc-800 dark:text-[#CCCCCC] font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer">
                                                                                {Object.entries(recurrenceLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                                                                            </select>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {!isEditing && (
                                                        <div className="space-y-3">
                                                            {r.targets.map(t => {
                                                                const { isSleeping } = getDerivedReminderState(t.due_at, t.recurrence, t.is_completed);
                                                                const isRecurrent = t.recurrence && t.recurrence !== 'none';
                                                                const colorClass = getUrgencyColor(t.due_at, t.recurrence);
                                                                const relTime = getRelativeTimeLeft(t.due_at);

                                                                return (
                                                                <div key={t.id} className={`flex flex-col group p-3 bg-zinc-50 dark:bg-[#242432] rounded-xl border border-zinc-200 dark:border-[#2D2D42]/80 hover:border-zinc-200 transition-all ${isSleeping ? 'opacity-60' : 'opacity-100'}`}>
                                                                    <div className="flex justify-between items-start w-full">
                                                                        <div className="flex items-center gap-2">
                                                                            <button onClick={() => toggleTargetComplete(r.id, t.id)} className={`transition-all group/btn flex items-center justify-center w-5 h-5 rounded-full border ${isSleeping ? 'bg-[#1E4037] border-[#1E4037] text-white' : 'border-zinc-300 dark:border-zinc-700 text-zinc-400 hover:border-[#225B49] hover:text-[#225B49]'}`} title={isSleeping ? 'Deshacer completado' : 'Completar'}>
                                                                                {isSleeping ? <Check size={12} strokeWidth={4} /> : <Circle size={14} />}
                                                                            </button>
                                                                            <span className={`font-bold text-sm ${isSleeping ? 'text-zinc-500 line-through' : 'text-zinc-800 dark:text-[#CCCCCC]'}`}>{t.title || 'Sin nombre'}</span>
                                                                        </div>
                                                                        <div className="flex items-center text-[11px] font-bold text-[#7E7E85]">
                                                                            {isRecurrent ? <span className="flex items-center gap-1"><Repeat size={10} /> Ciclo: {recurrenceLabels[t.recurrence!]}</span> : <span>Único</span>}
                                                                            <span className="mx-2 opacity-50">|</span>
                                                                            <span className={isSleeping ? 'text-[#225B49] font-bold' : (relTime.includes('Vencido') ? 'text-[#ff2800] animate-pulse' : 'text-[#7E7E85]')}>{isSleeping && isRecurrent ? 'Descansando' : (isSleeping ? 'Terminado' : relTime)}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-col gap-1 pl-7 mt-1.5">
                                                                        <div className="flex items-center justify-between text-[11px] text-zinc-500">
                                                                            <div className="flex items-center gap-1.5 font-bold">
                                                                                <Clock size={12} />
                                                                                <LiveCountdown dueAt={t.due_at} isSaved={true} isCompleted={isSleeping} recurrence={t.recurrence} />
                                                                            </div>
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
                                })}
                            </div>
                        </div>
                    )}

                    {/* 3. HISTORIAL */}
                    <div className="space-y-4 animate-fadeIn opacity-70">
                        <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase tracking-widest text-xs px-2 mb-2">
                            <ArchiveIcon size={16} /> Archivo ({history.length})
                        </div>
                        {history.length === 0 ? (
                            <div className="text-sm text-center text-zinc-400 p-4">No hay recordatorios finalizados.</div>
                        ) : (
                            <div className="space-y-2">
                                {history.map(r => {
                                    const isExpanded = expandedHistoryIds.has(r.id);
                                    const createdMs = new Date(r.created_at).getTime();
                                    const updatedMs = new Date(r.updated_at).getTime();
                                    const isEdited = (updatedMs - createdMs) > 60000;
                                    
                                    return (
                                    <div key={r.id} className="flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-[#1A1A24]/50 rounded-lg border border-zinc-200 dark:border-[#2D2D42] transition-colors">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <button onClick={() => toggleExpandHistory(r.id)} className="p-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-md text-zinc-500 transition-colors" title="Desplegar grupo completo">
                                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1E4037] text-white shrink-0">
                                                    <Check size={12} strokeWidth={4} />
                                                </div>
                                                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 line-through truncate">{r.title || 'Recordatorio completado'}</span>
                                            </div>
                                            <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto pl-11 md:pl-0">
                                                <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold shrink-0">
                                                    <span>Creado: {formatCustomDate(r.created_at, dateFormat, timeFormat)}</span>
                                                    {isEdited && (<><span className="opacity-50">|</span><span>Editado: {formatCustomDate(r.updated_at, dateFormat, timeFormat)}</span></>)}
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>
                                                    <button onClick={() => changeStatus(r.id, 'active')} className="p-1.5 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors" title="Restaurar a Activos"><RotateCcw size={16}/></button>
                                                    <button onClick={() => deleteReminder(r.id)} className="p-1.5 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors" title="Eliminar para siempre"><Trash2 size={16}/></button>
                                                </div>
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-[#2D2D42] animate-fadeIn space-y-4">
                                                {r.content && (
                                                    <div className="bg-zinc-100/50 dark:bg-[#242432] border border-zinc-200 dark:border-[#2D2D42] rounded-xl p-4 opacity-70">
                                                        <div className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed" dangerouslySetInnerHTML={{__html: parseMarkdownPreview(r.content)}} />
                                                    </div>
                                                )}
                                                <div className="space-y-2">
                                                    {r.targets.map(t => {
                                                        const isRecurrent = t.recurrence && t.recurrence !== 'none';
                                                        return (
                                                        <div key={t.id} className="flex flex-col group p-3 bg-zinc-100/50 dark:bg-[#13131A]/30 rounded-xl border border-zinc-200 dark:border-[#2D2D42]/50 opacity-60">
                                                            <div className="flex justify-between items-start w-full">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1E4037] text-white shrink-0">
                                                                        <Check size={12} strokeWidth={4} />
                                                                    </div>
                                                                    <span className="font-bold text-sm text-zinc-500 line-through">{t.title || 'Sin nombre'}</span>
                                                                </div>
                                                                    <div className="flex items-center text-[11px] font-bold text-[#225B49]">
                                                                        {isRecurrent ? <span className="flex items-center gap-1"><Repeat size={10} /> Ciclo: {recurrenceLabels[t.recurrence!]}</span> : <span>Único</span>}
                                                                        <span className="mx-2 opacity-50">|</span><span>Terminado</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center text-[11px] pl-7 text-[#225B49] font-bold mt-1.5">✓ Última atención: {formatCustomDate(t.last_completed_at || t.due_at, dateFormat, timeFormat)}</div>
                                                        </div>
                                                    )})}
                                                </div>
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
    </div>
    );
};