import React, { useState, useEffect, useMemo } from 'react';
import { Languages, ArrowRightLeft, Save, Trash2, Clock, Type, Zap, Loader2 } from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';

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
            return;
        }

        const timer = setTimeout(async () => {
            setIsTranslating(true);
            try {
                const { data, error } = await supabase.functions.invoke('translateMyAppNotes', {
                    body: {
                        sourceLang,
                        targetLang,
                        text: inputText
                    },
                    headers: {
                        Authorization: `Bearer ${session.access_token}`
                    }
                });

                if (error) throw error;
                setTranslatedText(data.translation);
            } catch (error) {
                console.error('Translation error:', error);
                setTranslatedText('Error al traducir. Verifica la conexión.');
            } finally {
                setIsTranslating(false);
            }
        }, 800);

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

            // Reset inputs and reload history
            setInputText('');
            setTranslatedText('');
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
        // Note: translatedText will be updated by the useEffect
    };

    // --- FILTERED & SORTED HISTORY ---
    const filteredAndSortedHistory = useMemo(() => {
        let list = history.filter(h =>
            h.source_text.toLowerCase().includes(inputText.toLowerCase()) ||
            h.translated_text.toLowerCase().includes(inputText.toLowerCase())
        );

        list.sort((a, b) => {
            switch (sortMode) {
                case 'date-desc': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case 'date-asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'alpha-asc': return a.source_text.localeCompare(b.source_text);
                case 'alpha-desc': return b.source_text.localeCompare(a.source_text);
                default: return 0;
            }
        });

        return list;
    }, [history, inputText, sortMode]);

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

                    <button
                        onClick={handleSwapLanguages}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all font-medium border border-zinc-200 dark:border-zinc-700 active:scale-95 shadow-sm"
                    >
                        <span className="uppercase text-xs tracking-widest">{sourceLang}</span>
                        <ArrowRightLeft size={16} className="text-zinc-400" />
                        <span className="uppercase text-xs tracking-widest">{targetLang}</span>
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
                                    onClick={() => setInputText('')}
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
                                    {filteredAndSortedHistory.length}
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

                        {filteredAndSortedHistory.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-zinc-400 text-center animate-fadeIn">
                                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                                    <Languages size={32} className="opacity-20" />
                                </div>
                                <p className="max-w-xs mx-auto">
                                    {inputText ? 'No se encontraron resultados para tu búsqueda.' : 'Tu diccionario personal está vacío. Traduce algo y guárdalo para que aparezca aquí.'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredAndSortedHistory.map(h => (
                                    <div
                                        key={h.id}
                                        className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all animate-fadeIn"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-tighter bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                                                {h.source_lang} <ArrowRightLeft size={10} /> {h.target_lang}
                                            </div>
                                            <div className="flex items-center gap-1">
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
                                                <p className="text-zinc-800 dark:text-zinc-100 font-medium leading-tight">{h.source_text}</p>
                                            </div>
                                            <div className="h-px bg-zinc-100 dark:bg-zinc-800 w-full"></div>
                                            <div>
                                                <p className="text-[10px] text-indigo-400/80 font-bold uppercase mb-1">{h.target_lang === 'en' ? 'Traducción (EN)' : 'Traducción (ES)'}</p>
                                                <p className="text-indigo-600 dark:text-indigo-400 font-bold leading-tight">{h.translated_text}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};
