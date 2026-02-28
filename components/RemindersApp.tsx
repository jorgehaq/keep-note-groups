import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Bell, Trash2, Clock, History as HistoryIcon, Wrench, Play, CheckCircle2, Circle, RotateCcw, Repeat, ChevronDown, ChevronUp, Settings2, Archive } from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { SmartNotesEditor } from '../src/components/editor/SmartNotesEditor';
import { useUIStore } from '../src/lib/store';

// --- TYPES ---
type ReminderStatus = 'main' | 'active' | 'history';
type RecurrenceType = 'none' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'bimonthly'; 

interface ReminderTarget {
    id: string; title: string; due_at: string; is_completed: boolean; recurrence?: RecurrenceType; last_completed_at?: string;
}

interface AdvancedReminder {
    id: string; title: string; content: string; status: ReminderStatus; targets: ReminderTarget[]; created_at: string; updated_at: string; user_id: string;
}

const recurrenceLabels: Record<string, string> = {
    none: 'Una vez', hourly: 'Cada hora', daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual', bimonthly: 'Cada 2 meses'
};

const toLocalDateTimeLocal = (isoString?: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
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
        .replace(/==([^=]+)==/g, '<mark class="bg-yellow-200/60 dark:bg-yellow-500/40 text-inherit rounded-sm px-1 font-medium">$1</mark>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/_([^_]+)_/g, '<em>$1</em>')
        .replace(/~~([^~]+)~~/g, '<del class="opacity-70">$1</del>')
        .replace(/^&gt;\s+(.*)$/gm, '<span class="border-l-2 border-indigo-400 dark:border-indigo-600 pl-2 ml-1 italic opacity-90 block my-1">$1</span>')
        .replace(/\[\[tr:([^|]+)\|([^\]]+)\]\]/g, '<span class="text-indigo-600 dark:text-indigo-400 font-bold border-b border-indigo-400/50 border-dashed cursor-help" title="$1">$2</span>')
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
    const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
    const { setOverdueRemindersCount, setImminentRemindersCount } = useUIStore();

    const fetchReminders = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('reminders').select('*').eq('user_id', session.user.id).order('updated_at', { ascending: false }).order('created_at', { ascending: false });
            if (error) throw error;
            setReminders(data as AdvancedReminder[]);
        } catch (e: any) { console.error(e.message); } finally { setLoading(false); }
    }, [session.user.id]);

    useEffect(() => { fetchReminders(); }, [fetchReminders]);

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
        setReminders(prev => prev.filter(r => r.id !== id));
        await supabase.from('reminders').delete().eq('id', id);
    };

    const calculateNextDate = (currentDate: string, recurrence: RecurrenceType): string => {
        const d = new Date(currentDate);
        if (recurrence === 'hourly') d.setHours(d.getHours() + 1);
        else if (recurrence === 'daily') d.setDate(d.getDate() + 1);
        else if (recurrence === 'weekly') d.setDate(d.getDate() + 7);
        else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
        else if (recurrence === 'bimonthly') d.setMonth(d.getMonth() + 2);
        return d.toISOString();
    };

    const toggleTargetComplete = (reminderId: string, targetId: string) => {
        const reminder = reminders.find(r => r.id === reminderId);
        if (!reminder) return;
        window.dispatchEvent(new CustomEvent('reminder-attended', { detail: targetId }));

        const newTargets = reminder.targets.map(t => {
            if (t.id === targetId) {
                if (!t.is_completed && t.recurrence && t.recurrence !== 'none') {
                    return { ...t, due_at: calculateNextDate(t.due_at, t.recurrence), is_completed: false, last_completed_at: new Date().toISOString() };
                }
                return { ...t, is_completed: !t.is_completed, last_completed_at: !t.is_completed ? new Date().toISOString() : t.last_completed_at };
            }
            return t;
        });
        const allDone = newTargets.every(t => t.is_completed);
        if (allDone) changeStatus(reminderId, 'history');
        autoSave(reminderId, { targets: newTargets });
    };

    const toggleExpandActive = (id: string) => setExpandedActiveIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const toggleEditActive = (id: string) => setEditingActiveIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const toggleExpandHistory = (id: string) => setExpandedHistoryIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

    if (loading) return <div className="p-10 text-center animate-pulse text-zinc-500">Cargando Tiempos...</div>;

    const drafts = reminders.filter(r => r.status === 'main');
    const activeReminders = reminders.filter(r => r.status === 'active');
    const history = reminders.filter(r => r.status === 'history');

    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
                <div className="flex items-center justify-between px-4 md:px-6 py-4">
                    <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-3">
                        <div className="p-2 bg-[#1F3760] rounded-lg text-white shadow-lg shadow-[#1F3760]/20">
                            <Bell size={20} />
                        </div>
                        Recordatorios
                    </h1>
                    <button onClick={createNewDraft} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl shadow-lg transition-colors flex items-center gap-2">
                        <Plus size={20} /> <span className="text-sm font-bold hidden sm:inline pr-2">Nuevo</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8 hidden-scrollbar">
                <div className="max-w-4xl mx-auto space-y-12 pb-20">
                    
                    {/* 1. CREACIÓN */}
                    {drafts.length > 0 && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="flex items-center gap-2 text-indigo-500">
                                <Wrench size={18} />
                                <span className="text-sm font-bold uppercase tracking-widest">Creación de recordatorio</span>
                            </div>
                            {drafts.map(draft => (
                                /* 🚀 FIX: focus-within:ring-2 para iluminación exterior */
                                <div key={draft.id} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-indigo-500/30 p-1 transition-all focus-within:ring-2 focus-within:ring-indigo-500/50">
                                    <div className="flex items-center justify-between pr-4">
                                        <input type="text" placeholder="Título general (ej. Servicios Públicos)" value={draft.title} onChange={e => autoSave(draft.id, { title: e.target.value })} className="w-full bg-transparent text-xl font-bold text-zinc-800 dark:text-zinc-100 p-4 pb-3 outline-none placeholder-zinc-400" />
                                        <button onClick={() => { setReminders(prev => prev.filter(r => r.id !== draft.id)); supabase.from('reminders').delete().eq('id', draft.id); }} className="p-2 text-zinc-400 hover:text-red-500 transition-colors" title="Descartar"><Trash2 size={18}/></button>
                                    </div>
                                    <div className="h-px bg-zinc-100 dark:bg-zinc-800/80 mx-4 mb-2" />
                                    
                                    <div className="mb-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 cursor-text min-h-[120px] mx-4">
                                        <SmartNotesEditor noteId={draft.id} initialContent={draft.content} onChange={c => autoSave(draft.id, { content: c })} />
                                    </div>

                                    <div className="bg-zinc-50 dark:bg-[#1B1B1E] rounded-xl m-4 p-4 border border-zinc-200 dark:border-zinc-800">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tiempos:</span>
                                            <div className="flex gap-2">
                                                {[1, 10, 30, 60].map(m => (
                                                    <button key={m} onClick={() => addTarget(draft.id, m)} className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-md hover:bg-indigo-200 transition-colors">+{m}m</button>
                                                ))}
                                                <button onClick={() => addTarget(draft.id, 0)} className="text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded-md hover:bg-zinc-300 transition-colors"><Plus size={12}/></button>
                                            </div>
                                        </div>
                                        <div className="space-y-3 mt-4">
                                            {draft.targets.map((target, idx) => (
                                                <div key={target.id} className="flex flex-col group p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-100 dark:border-zinc-800/80 hover:border-zinc-200 transition-colors">
                                                    <div className="flex justify-between items-start w-full gap-4">
                                                        <input 
                                                            value={target.title} 
                                                            onChange={e => { const newT = draft.targets.map((t, i) => i === idx ? { ...t, title: e.target.value } : t); autoSave(draft.id, { targets: newT }); }} 
                                                            placeholder="Título del recordatorio" 
                                                            className="flex-1 bg-transparent text-sm font-bold text-zinc-800 dark:text-zinc-200 outline-none placeholder-zinc-400 dark:placeholder-zinc-600" 
                                                        />
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <div className="text-[11px] font-bold text-[#7E7E85] flex items-center">
                                                                <LiveCountdown dueAt={target.due_at} isSaved={false} isCompleted={target.is_completed} recurrence={target.recurrence} />
                                                            </div>
                                                            <button onClick={() => { autoSave(draft.id, { targets: draft.targets.filter(t => t.id !== target.id) }); }} className="text-zinc-400 hover:text-red-500 transition-colors" title="Eliminar"><Trash2 size={16}/></button>
                                                        </div>
                                                    </div>
                                                    <div className="border-t border-zinc-200 dark:border-zinc-700/50 w-full my-2"></div>
                                                    <div className="flex items-center gap-2 text-[11px] flex-wrap sm:flex-nowrap">
                                                        <input type="datetime-local" value={toLocalDateTimeLocal(target.due_at)} onChange={e => { const newT = draft.targets.map((t, i) => i === idx ? { ...t, due_at: new Date(e.target.value).toISOString() } : t); autoSave(draft.id, { targets: newT }); }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded py-1 px-2 text-zinc-800 dark:text-zinc-200 font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                                                        <span className="text-zinc-300 dark:text-zinc-700 font-bold">|</span>
                                                        <select value={target.recurrence || 'none'} onChange={e => { const newT = draft.targets.map((t, i) => i === idx ? { ...t, recurrence: e.target.value as RecurrenceType } : t); autoSave(draft.id, { targets: newT }); }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded py-1 px-2 text-zinc-800 dark:text-zinc-200 font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer">
                                                            {Object.entries(recurrenceLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex justify-end p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-2xl border-t border-zinc-200 dark:border-zinc-800">
                                        <button onClick={() => changeStatus(draft.id, 'active')} disabled={draft.targets.length === 0} className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"><Play size={14}/> Activar Todos</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 2. ACTIVOS */}
                    {activeReminders.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-emerald-500">
                                <Clock size={16} /> <span className="text-xs font-bold uppercase tracking-widest">Activos y Corriendo</span>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4">
                                {activeReminders.map(r => {
                                    const isExpanded = expandedActiveIds.has(r.id);
                                    const isEditing = editingActiveIds.has(r.id);

                                    return (
                                        /* 🚀 FIX: Uso de ring-2 en lugar de border-2 para evitar layout shift, y focus-within incorporado */
                                        <div key={r.id} className={`bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-lg transition-all flex flex-col border border-zinc-200 dark:border-zinc-800 ${isEditing || isExpanded ? 'ring-2 ring-indigo-500/50 shadow-indigo-500/5' : 'hover:border-emerald-500/50 focus-within:ring-2 focus-within:ring-indigo-500/50'}`}>
                                            
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <button onClick={() => toggleExpandActive(r.id)} className="p-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-400 transition-colors" title="Desplegar nota">
                                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                    </button>
                                                    <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-100">{r.title || 'Recordatorio Activo'}</h3>
                                                </div>
                                                <button onClick={() => toggleEditActive(r.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isEditing ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400'}`}>
                                                    <Settings2 size={14}/> <span className="hidden sm:inline">{isEditing ? 'Cerrar Edición' : 'Ajustar'}</span>
                                                </button>
                                            </div>
                                            
                                            {isEditing ? (
                                                <div className="mt-4 space-y-4 animate-fadeIn">
                                                    <input type="text" value={r.title} onChange={e => autoSave(r.id, { title: e.target.value })} className="w-full bg-zinc-50 dark:bg-zinc-950 text-sm font-bold p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 outline-none" />
                                                    
                                                    <div className="mb-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 cursor-text min-h-[120px]">
                                                        <SmartNotesEditor noteId={r.id} initialContent={r.content} onChange={content => autoSave(r.id, { content })} />
                                                    </div>

                                                    <div className="bg-zinc-50 dark:bg-[#1B1B1E] rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Ajustar Tiempos:</span>
                                                            <div className="flex gap-2">
                                                                {[1, 10, 30, 60].map(m => (
                                                                    <button key={m} onClick={() => addTarget(r.id, m)} className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-md">+{m}m</button>
                                                                ))}
                                                                <button onClick={() => addTarget(r.id, 0)} className="text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded-md hover:bg-zinc-300"><Plus size={12}/></button>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-3 mt-4">
                                                            {r.targets.map((target, idx) => (
                                                                <div key={target.id} className="flex flex-col group p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-100 dark:border-zinc-800/80 hover:border-zinc-200 transition-colors">
                                                                    <div className="flex justify-between items-start w-full gap-4">
                                                                        <input value={target.title} onChange={e => { const newT = r.targets.map((t, i) => i === idx ? { ...t, title: e.target.value } : t); autoSave(r.id, { targets: newT }); }} placeholder="Título del recordatorio" className="flex-1 bg-transparent text-sm font-bold text-zinc-800 dark:text-zinc-200 outline-none placeholder-zinc-400 dark:placeholder-zinc-600" />
                                                                        <div className="flex items-center gap-3 shrink-0">
                                                                            <div className="text-[11px] font-bold text-[#7E7E85] flex items-center">
                                                                                <LiveCountdown dueAt={target.due_at} isSaved={true} isCompleted={target.is_completed} recurrence={target.recurrence} />
                                                                            </div>
                                                                            <button onClick={() => { autoSave(r.id, { targets: r.targets.filter(t => t.id !== target.id) }); }} className="text-zinc-400 hover:text-red-500 transition-colors" title="Eliminar"><Trash2 size={16}/></button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="border-t border-zinc-200 dark:border-zinc-700/50 w-full my-2"></div>
                                                                    <div className="flex items-center gap-2 text-[11px] flex-wrap sm:flex-nowrap">
                                                                        <input type="datetime-local" value={toLocalDateTimeLocal(target.due_at)} onChange={e => { const newT = r.targets.map((t, i) => i === idx ? { ...t, due_at: new Date(e.target.value).toISOString() } : t); autoSave(r.id, { targets: newT }); }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded py-1 px-2 text-zinc-800 dark:text-zinc-200 font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                                                                        <span className="text-zinc-300 dark:text-zinc-700 font-bold">|</span>
                                                                        <select value={target.recurrence || 'none'} onChange={e => { const newT = r.targets.map((t, i) => i === idx ? { ...t, recurrence: e.target.value as RecurrenceType } : t); autoSave(r.id, { targets: newT }); }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded py-1 px-2 text-zinc-800 dark:text-zinc-200 font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer">
                                                                            {Object.entries(recurrenceLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 mt-2">
                                                        <button onClick={() => deleteReminder(r.id)} className="text-xs font-bold text-zinc-400 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2">
                                                            <Trash2 size={14} /> Eliminar
                                                        </button>
                                                        <button onClick={() => changeStatus(r.id, 'history')} className="text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 px-3 py-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center gap-2">
                                                            <Archive size={14} /> Desactivar Grupo
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {isExpanded ? (
                                                        <div className="mb-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 cursor-text animate-fadeIn min-h-[120px] mt-4">
                                                            <SmartNotesEditor noteId={r.id} initialContent={r.content} onChange={content => autoSave(r.id, { content })} />
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-2 opacity-80 pl-11 leading-relaxed mt-1" dangerouslySetInnerHTML={{__html: parseMarkdownPreview(r.content)}} />
                                                    )}
                                                    
                                                    <div className="space-y-3 pt-2 mt-auto">
                                                        {r.targets.map(t => {
                                                            const isDone = t.is_completed;
                                                            const isRecurrent = t.recurrence && t.recurrence !== 'none';
                                                            const colorClass = getUrgencyColor(t.due_at, t.recurrence);
                                                            const relTime = getRelativeTimeLeft(t.due_at);

                                                            return (
                                                            <div key={t.id} className="flex flex-col group p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-100 dark:border-zinc-800/80 hover:border-zinc-200 transition-colors">
                                                                <div className="flex justify-between items-start w-full">
                                                                    <div className="flex items-center gap-2">
                                                                        <button onClick={() => toggleTargetComplete(r.id, t.id)} className={`text-zinc-400 hover:text-emerald-500 transition-colors ${isDone ? 'text-emerald-500' : ''}`} title="Completar"><CheckCircle2 size={18}/></button>
                                                                        <span className={`font-bold text-sm ${isDone ? 'text-zinc-400 line-through' : 'text-zinc-800 dark:text-zinc-200'}`}>{t.title || 'Sin nombre'}</span>
                                                                    </div>
                                                                    <div className="flex items-center text-[11px] font-bold text-[#7E7E85]">
                                                                        {isRecurrent ? <span className="flex items-center gap-1"><Repeat size={10} /> Ciclo: {recurrenceLabels[t.recurrence!]}</span> : <span>Único</span>}
                                                                        <span className="mx-2 opacity-50">|</span>
                                                                        <span className={isDone ? 'text-[#7E7E85]' : (relTime.includes('Vencido') ? 'text-[#ff2800] animate-pulse' : 'text-[#7E7E85]')}>{isDone && !isRecurrent ? 'Terminado' : relTime}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="border-t border-zinc-200 dark:border-zinc-700/50 w-full my-2"></div>
                                                                <div className="flex items-center text-[11px] pl-7">
                                                                    {t.last_completed_at && (
                                                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ Última atención: {formatCustomDate(t.last_completed_at, dateFormat, timeFormat)}<span className="mx-1 text-zinc-300 dark:text-zinc-600">,</span></span>
                                                                    )}
                                                                    <span className={isDone ? 'text-zinc-400' : colorClass}>Próximo recordatorio: {formatCustomDate(t.due_at, dateFormat, timeFormat)}</span>
                                                                </div>
                                                            </div>
                                                        )})}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 3. HISTORIAL */}
                    <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/50 opacity-70">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <HistoryIcon size={16} /> <span className="text-xs font-bold uppercase tracking-widest">Historial ({history.length})</span>
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
                                    <div key={r.id} className="flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 transition-colors">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <button onClick={() => toggleExpandHistory(r.id)} className="p-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-md text-zinc-500 transition-colors" title="Desplegar grupo completo">
                                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
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
                                            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 animate-fadeIn space-y-4">
                                                {r.content && (
                                                    <div className="bg-zinc-100/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 opacity-70">
                                                        <div className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed" dangerouslySetInnerHTML={{__html: parseMarkdownPreview(r.content)}} />
                                                    </div>
                                                )}
                                                <div className="space-y-2">
                                                    {r.targets.map(t => {
                                                        const isRecurrent = t.recurrence && t.recurrence !== 'none';
                                                        return (
                                                        <div key={t.id} className="flex flex-col group p-3 bg-zinc-100/50 dark:bg-zinc-800/30 rounded-xl border border-zinc-100 dark:border-zinc-800/50 opacity-60">
                                                            <div className="flex justify-between items-start w-full">
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2 size={18} className="text-zinc-400" />
                                                                    <span className="font-bold text-sm text-zinc-500 line-through">{t.title || 'Sin nombre'}</span>
                                                                </div>
                                                                <div className="flex items-center text-[11px] font-bold text-zinc-500">
                                                                    {isRecurrent ? <span className="flex items-center gap-1"><Repeat size={10} /> Ciclo: {recurrenceLabels[t.recurrence!]}</span> : <span>Único</span>}
                                                                    <span className="mx-2 opacity-50">|</span><span>Terminado</span>
                                                                </div>
                                                            </div>
                                                            <div className="border-t border-zinc-200 dark:border-zinc-700/50 w-full my-2"></div>
                                                            <div className="flex items-center text-[11px] pl-7 text-zinc-500 font-bold">✓ Última atención: {formatCustomDate(t.last_completed_at || t.due_at, dateFormat, timeFormat)}</div>
                                                        </div>
                                                    )})}
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