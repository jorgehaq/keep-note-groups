import React, { useState, useEffect, useMemo } from 'react';
import { Languages, ArrowRightLeft, Save, Trash2, Clock, Type, Zap, Loader2 } from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { KanbanSemaphore } from './KanbanSemaphore';

// --- HELPER PARA RESALTAR TEXTO ---
const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase()
            ? <mark key={i} className="bg-amber-200 dark:bg-amber-500/40 text-amber-900 dark:text-amber-100 rounded-sm px-0.5 font-bold transition-colors">{part}</mark>
            : part
    );
};

interface Translation {
    id: string;
    user_id: string;
    source_text: string;
    translated_text: string;
    source_lang: string;
    target_lang: string;
    created_at: string;
}

interface TranslatorAppProps {
    session: Session;
}

export const TranslatorApp: React.FC<TranslatorAppProps> = ({ session }) => {
    // --- STATES ---
    const [sourceLang, setSourceLang] = useState<'en' | 'es'>('en');
    const [targetLang, setTargetLang] = useState<'en' | 'es'>('es');
    const [inputText, setInputText] = useState('');
    const [translatedText, setTranslatedText] = useState('');
    const [isTranslating, setIsTranslating] = useState(false);
    const [history, setHistory] = useState<Translation[]>([]);
    const [sortMode, setSortMode] = useState<'date-desc' | 'date-asc' | 'alpha-asc' | 'alpha-desc'>('date-desc');

    // NUEVO ESTADO: Para el filtrado diferido (solo actualiza cuando pedimos traducción)
    const [searchTerm, setSearchTerm] = useState('');

    // --- PERSISTENCE: LOAD HISTORY ---
    const fetchHistory = async () => {
        try {
            const { data, error } = await supabase
                .from('translations')
                .select('*')
                .eq('user_id', session.user.id);

            if (error) throw error;
            setHistory(data || []);
        } catch (error: any) {
            console.error('Error fetching history:', error.message);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [session.user.id]);

    // --- GEMINI AI INTEGRATION (DEBOUNCE) ---
    useEffect(() => {
        if (!inputText.trim()) {
            setTranslatedText('');
            setSearchTerm(''); // Limpiar búsqueda si borramos todo
            return;
        }

        const timer = setTimeout(async () => {
            setIsTranslating(true);
            setSearchTerm(inputText); // ¡MAGIA! Solo aplicamos el filtro cuando disparamos la IA

            try {
                const { data, error } = await supabase.functions.invoke('translateMyAppNotes', {
                    body: { sourceLang, targetLang, text: inputText },
                    headers: {
                        Authorization: `Bearer ${session.access_token}`
                    }
                });

                if (error) {
                let realErrorMessage = error.message;
                try {
                    // Extraemos el JSON real del error 400
                    const errorResponse = await error.context.json();
                    if (errorResponse && errorResponse.error) {
                        realErrorMessage = errorResponse.error;
                    }
                } catch (e) { /* ignorar */ }
    
    console.error("Detalle del Error 400:", realErrorMessage);
    alert('Fallo al traducir: ' + realErrorMessage);
    throw new Error(realErrorMessage);
}
                setTranslatedText(data.translation);
            } catch (error) {
                console.error('Translation error:', error);
                setTranslatedText('Error al traducir. Verifica la conexión.');
            } finally {
                setIsTranslating(false);
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, [inputText, sourceLang, targetLang]);

    // --- HANDLERS ---
    const handleSwapLanguages = () => {
        setSourceLang(targetLang);
        setTargetLang(sourceLang);
        setInputText(translatedText);
        setTranslatedText(inputText);
    };

    const handleSave = async () => {
        if (!inputText || !translatedText) return;

        try {
            const { error } = await supabase.from('translations').insert([{
                user_id: session.user.id,
                source_text: inputText,
                translated_text: translatedText,
                source_lang: sourceLang,
                target_lang: targetLang
            }]);

            if (error) throw error;

            setInputText('');
            setTranslatedText('');
            setSearchTerm('');
            fetchHistory();
        } catch (error: any) {
            alert('Error saving translation: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase.from('translations').delete().eq('id', id);
            if (error) throw error;
            setHistory(prev => prev.filter(h => h.id !== id));
        } catch (error: any) {
            alert('Error deleting: ' + error.message);
        }
    };

    const handleRevive = (h: Translation) => {
        setInputText(h.source_text);
        setSourceLang(h.source_lang as 'en' | 'es');
        setTargetLang(h.target_lang as 'en' | 'es');
    };

    // --- SORTED HISTORY (No desaparece, solo reordena y resalta) ---
    const sortedHistory = useMemo(() => {
        let list = [...history];
        const query = searchTerm.toLowerCase();

        list.sort((a, b) => {
            // 1. Prioridad absoluta: Si hay búsqueda, los que coinciden van arriba
            if (query) {
                const aMatches = a.source_text.toLowerCase().includes(query) || a.translated_text.toLowerCase().includes(query);
                const bMatches = b.source_text.toLowerCase().includes(query) || b.translated_text.toLowerCase().includes(query);

                if (aMatches && !bMatches) return -1;
                if (!aMatches && bMatches) return 1;
            }

            // 2. Ordenamiento secundario (por fecha o alfabético)
            switch (sortMode) {
                case 'date-desc': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case 'date-asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'alpha-asc': return a.source_text.localeCompare(b.source_text);
                case 'alpha-desc': return b.source_text.localeCompare(a.source_text);
                default: return 0;
            }
        });

        return list;
    }, [history, searchTerm, sortMode]);

    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500 rounded-lg text-white shadow-lg shadow-indigo-500/20">
                            <Languages size={24} />
                        </div>
                        <h1 className="text-xl font-bold text-zinc-800 dark:text-white">Traductor AI</h1>
                    </div>

                    {/* BOTÓN SWAP MEJORADO */}
                    <button
                        onClick={handleSwapLanguages}
                        className="flex items-center gap-3 px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full transition-all font-bold border border-indigo-200 dark:border-indigo-800/50 active:scale-95 shadow-md hover:shadow-indigo-500/20 group"
                    >
                        <span className="uppercase text-[11px] tracking-widest">{sourceLang}</span>
                        <ArrowRightLeft size={16} className="text-indigo-500 group-hover:rotate-180 transition-transform duration-300" />
                        <span className="uppercase text-[11px] tracking-widest">{targetLang}</span>
                    </button>
                </div>
            </header>

            {/* Main Translation Area */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-5xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Source Column */}
                        <div className="relative group">
                            <div className="absolute top-3 left-3 flex items-center gap-1.5 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                                <Type size={12} /> {sourceLang === 'en' ? 'Inglés' : 'Español'}
                            </div>
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Escribe algo para traducir..."
                                className="w-full h-48 md:h-64 p-10 pt-12 text-lg bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all resize-none shadow-sm dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-700"
                            />
                            {inputText && (
                                <button
                                    onClick={() => { setInputText(''); setSearchTerm(''); }}
                                    className="absolute bottom-4 right-4 p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>

                        {/* Target Column */}
                        <div className="relative">
                            <div className="absolute top-3 left-3 flex items-center gap-1.5 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                                <Type size={12} /> {targetLang === 'en' ? 'Inglés' : 'Español'}
                                {isTranslating && (
                                    <div className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full animate-pulse ml-2">
                                        <Loader2 size={10} className="animate-spin" />
                                        Traduciendo...
                                    </div>
                                )}
                            </div>
                            <textarea
                                value={translatedText}
                                readOnly
                                placeholder="Traducción..."
                                className={`w-full h-48 md:h-64 p-10 pt-12 text-lg rounded-2xl border-2 outline-none transition-all resize-none shadow-sm
                  ${isTranslating
                                        ? 'bg-indigo-50/10 border-indigo-200/30'
                                        : 'bg-zinc-100/50 dark:bg-zinc-900/50 border-zinc-200/50 dark:border-zinc-800/50 text-zinc-600 dark:text-zinc-300'
                                    }`}
                            />
                            {translatedText && !isTranslating && (
                                <button
                                    onClick={handleSave}
                                    className="absolute bottom-4 right-4 flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/20 transition-all font-bold active:scale-95 animate-fadeIn"
                                >
                                    <Save size={18} />
                                    Guardar en Diccionario
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Dictionary/History Section */}
                    <div className="mt-12 border-t border-zinc-200 dark:border-zinc-800 pt-10 px-2 md:px-0">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                                    <Clock size={20} />
                                </div>
                                <h2 className="text-xl font-bold text-zinc-800 dark:text-white">Diccionario Personal</h2>
                                <span className="text-xs bg-zinc-200 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full font-mono">
                                    {sortedHistory.length}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                                <button
                                    onClick={() => setSortMode(sortMode === 'date-desc' ? 'date-asc' : 'date-desc')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap
                    ${sortMode.includes('date') ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'}
                  `}
                                >
                                    <Clock size={14} />
                                    {sortMode === 'date-desc' ? 'Más recientes' : 'Más antiguos'}
                                </button>
                                <button
                                    onClick={() => setSortMode(sortMode === 'alpha-asc' ? 'alpha-desc' : 'alpha-asc')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap
                    ${sortMode.includes('alpha') ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'}
                  `}
                                >
                                    <Type size={14} />
                                    {sortMode === 'alpha-asc' ? 'A-Z' : 'Z-A'}
                                </button>
                            </div>
                        </div>

                        {sortedHistory.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-zinc-400 text-center animate-fadeIn">
                                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                                    <Languages size={32} className="opacity-20" />
                                </div>
                                <p className="max-w-xs mx-auto">
                                    Tu diccionario personal está vacío. Traduce algo y guárdalo para que aparezca aquí.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {sortedHistory.map(h => {
                                    // Verificamos si esta tarjeta es una coincidencia de búsqueda
                                    const isMatch = searchTerm && (h.source_text.toLowerCase().includes(searchTerm.toLowerCase()) || h.translated_text.toLowerCase().includes(searchTerm.toLowerCase()));

                                    return (
                                        <div
                                            key={h.id}
                                            className={`group bg-white dark:bg-zinc-900 p-5 rounded-2xl transition-all duration-500 ease-in-out
                                                ${isMatch
                                                    ? 'border-2 border-amber-400/50 shadow-lg shadow-amber-500/10 scale-[1.02]'
                                                    : 'border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-tighter bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                                                    {h.source_lang} <ArrowRightLeft size={10} /> {h.target_lang}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <KanbanSemaphore sourceId={h.id} sourceTitle={h.source_text.substring(0, 50)} />
                                                    <button
                                                        onClick={() => handleRevive(h)}
                                                        className="p-1.5 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                                        title="Revivir"
                                                    >
                                                        <Zap size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(h.id)}
                                                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-[10px] text-zinc-400 font-bold uppercase mb-1">{h.source_lang === 'en' ? 'Original (EN)' : 'Original (ES)'}</p>
                                                    <p className="text-zinc-800 dark:text-zinc-100 font-medium leading-tight">
                                                        {highlightText(h.source_text, searchTerm)}
                                                    </p>
                                                </div>
                                                <div className="h-px bg-zinc-100 dark:bg-zinc-800 w-full"></div>
                                                <div>
                                                    <p className="text-[10px] text-indigo-400/80 font-bold uppercase mb-1">{h.target_lang === 'en' ? 'Traducción (EN)' : 'Traducción (ES)'}</p>
                                                    <p className="text-indigo-600 dark:text-indigo-400 font-bold leading-tight">
                                                        {highlightText(h.translated_text, searchTerm)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};