import React, { useState, useEffect, useCallback } from 'react';
import { Languages, Volume2, Trash2, Copy, CheckCircle2, ArrowRightLeft, Loader2, Sparkles, Archive as ArchiveIcon, X, Eraser, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient';

const LANGUAGES = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'Inglés' },
  { code: 'fr', name: 'Francés' },
  { code: 'de', name: 'Alemán' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Portugués' }
];

// --- UTILS FORMATO DE FECHA ---
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

import { Session } from '@supabase/supabase-js';

interface Translation {
  id: string;
  source_text: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
  created_at: string;
  user_id: string;
}

export const TranslatorApp: React.FC<{ session: Session }> = ({ session }) => {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('es');
  const [targetLang, setTargetLang] = useState('en');
  
  // Action states
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedTranslationIds, setExpandedTranslationIds] = useState<Set<string>>(new Set());

  const toggleExpandTranslation = (id: string) => setExpandedTranslationIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
  });

  const fetchTranslations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('translations')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setTranslations(data || []);
    } catch (error) {
      console.error('Error fetching translations:', error);
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => {
    fetchTranslations();
  }, [fetchTranslations]);

  // 🚀 FIX: Traducción REAL automática (usando MyMemory API) y con Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
        if (originalText.trim()) {
            performTranslation();
        } else {
            setTranslatedText('');
        }
    }, 800); // Espera 800ms después de que dejas de escribir para traducir
    
    return () => clearTimeout(timer);
  }, [originalText, sourceLang, targetLang]);

  const performTranslation = async () => {
    setIsTranslating(true);
    try {
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalText)}&langpair=${sourceLang}|${targetLang}`);
        const data = await res.json();
        
        if (data && data.responseData && data.responseData.translatedText) {
            setTranslatedText(data.responseData.translatedText);
        } else {
            setTranslatedText("Error al traducir.");
        }
    } catch (error) {
        console.error("Error traduciendo:", error);
        setTranslatedText("...");
    } finally {
        setIsTranslating(false);
    }
  };

  const saveTranslation = async () => {
    if (!originalText.trim() || !translatedText.trim()) return;
    setIsSaving(true);
    try {
      const newTranslation = {
        source_text: originalText,
        translated_text: translatedText,
        source_lang: sourceLang,
        target_lang: targetLang,
        user_id: session.user.id
      };

      const { data, error } = await supabase
        .from('translations')
        .insert([newTranslation])
        .select()
        .single();

      if (error) throw error;
      
      setTranslations([data, ...translations]);
      setOriginalText('');
      setTranslatedText('');
    } catch (error) {
      console.error('Error saving translation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTranslation = async (id: string) => {
    if (!window.confirm('¿Eliminar esta traducción?')) return;
    try {
      const { error } = await supabase.from('translations').delete().eq('id', id);
      if (error) throw error;
      setTranslations(translations.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting translation:', error);
    }
  };

  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setOriginalText(translatedText);
    // No vaciamos translatedText manualmente, el useEffect se encargará de traducir el nuevo originalText.
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const playAudio = (text: string, lang: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  };

  const getLangName = (code: string) => LANGUAGES.find(l => l.code === code)?.name || code;

  // Filtrado en tiempo real del archivo basado en el texto de entrada actual
  const filteredTranslations = originalText.trim()
    ? translations
        .filter(t => t.source_text.toLowerCase().includes(originalText.trim().toLowerCase()))
        .slice(0, 10) // Mostrar máximo las 10 coincidencias más recientes
    : translations;

  if (loading) return <div className="p-10 text-center animate-pulse text-zinc-500">Cargando Traductor...</div>;

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
        
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
            <div className="flex items-center justify-between px-4 md:px-6 py-4">
                <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-3">
                    <div className="p-2 bg-[#8B5CF6] rounded-lg text-white shadow-lg shadow-violet-500/20">
                        <Languages size={20} />
                    </div>
                    Traductor
                </h1>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 hidden-scrollbar">
            <div className="max-w-4xl mx-auto space-y-12 pb-20">
                
                {/* 1. MÓDULO DE CREACIÓN */}
                <div className="space-y-6 animate-fadeIn">
                    <div className="flex items-center gap-2 text-violet-500">
                        <Sparkles size={18} className="fill-current" />
                        <span className="text-sm font-bold uppercase tracking-widest">Nueva Traducción</span>
                    </div>

                    {/* 🚀 FIX: focus-within EN LA TARJETA EXTERIOR EXCLUSIVAMENTE */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-1 transition-all duration-300 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/5 focus-within:ring-2 focus-within:ring-violet-500/50">
                        
                        <div className="bg-zinc-50 dark:bg-[#1B1B1E] rounded-xl m-4 p-4 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
                            <select 
                                value={sourceLang} 
                                onChange={(e) => setSourceLang(e.target.value)}
                                className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-bold rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer transition-all"
                            >
                                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                            </select>
                            
                            <button onClick={swapLanguages} className="p-2.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-400 transition-colors shadow-sm">
                                <ArrowRightLeft size={16} />
                            </button>
                            
                            <select 
                                value={targetLang} 
                                onChange={(e) => setTargetLang(e.target.value)}
                                className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-bold rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer transition-all"
                            >
                                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                            </select>
                        </div>

                        {/* 🚀 FIX: Eliminado el 'focus-within:ring-2' de los textarea internos */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 m-4">
                            <div className="relative flex flex-col bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden transition-all">
                                <textarea
                                    value={originalText}
                                    onChange={(e) => setOriginalText(e.target.value)}
                                    placeholder="Escribe el texto a traducir..."
                                    className="w-full h-40 bg-transparent p-4 outline-none resize-none text-zinc-800 dark:text-zinc-200 placeholder-zinc-400"
                                />
                                {originalText && (
                                    <button onClick={() => playAudio(originalText, sourceLang)} className="absolute bottom-3 right-3 p-2 text-zinc-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors">
                                        <Volume2 size={16} />
                                    </button>
                                )}
                            </div>
                            
                            <div className="relative flex flex-col bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden transition-all">
                                {isTranslating && (
                                    <div className="absolute top-4 right-4 text-violet-500 animate-spin">
                                        <Loader2 size={18} />
                                    </div>
                                )}
                                <textarea
                                    value={translatedText}
                                    readOnly
                                    placeholder="La traducción aparecerá aquí..."
                                    className="w-full h-40 bg-transparent p-4 outline-none resize-none text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 opacity-90"
                                />
                                <div className="absolute bottom-3 right-3 flex items-center gap-1">
                                    {translatedText && !isTranslating && (
                                        <>
                                            <button onClick={() => copyToClipboard(translatedText, 'current_output')} className="p-2 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors" title="Copiar traducción">
                                                {copiedId === 'current_output' ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
                                            </button>
                                            <button onClick={() => playAudio(translatedText, targetLang)} className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Escuchar traducción">
                                                <Volume2 size={16} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 🚀 FIX: Botón de Limpiar como icono y alineado a la derecha */}
                        <div className="flex justify-end items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-2xl border-t border-zinc-200 dark:border-zinc-800">
                            <button 
                                onClick={() => { setOriginalText(''); setTranslatedText(''); }} 
                                disabled={!originalText.trim()}
                                className="p-2 text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                                title="Limpiar contenido"
                            >
                                <Eraser size={18} />
                            </button>
                            
                            <button 
                                onClick={saveTranslation} 
                                disabled={!originalText.trim() || !translatedText.trim() || isTranslating || isSaving}
                                className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#8B5CF6] hover:bg-violet-600 rounded-xl shadow-lg shadow-violet-500/20 transition-all disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                Guardar Traducción
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. ARCHIVO DE TRADUCCIONES */}
                <div className="space-y-4 pt-4 border-t border-zinc-300 dark:border-zinc-800/50">
                    <div className="flex items-center gap-2 text-zinc-400">
                        <ArchiveIcon size={16} /> <span className="text-xs font-bold uppercase tracking-widest">Archivo ({filteredTranslations.length}{originalText.trim() && ' de ' + translations.length})</span>
                    </div>

                    <div className="space-y-2">
                        {filteredTranslations.map((t) => {
                            const isExpanded = expandedTranslationIds.has(t.id);
                            
                            return (
                            <div key={t.id} className="flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800 transition-colors">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    
                                    {/* Cabecera / Fila Compacta */}
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <button onClick={() => toggleExpandTranslation(t.id)} className="p-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-md text-zinc-500 transition-colors shrink-0" title="Desplegar traducción">
                                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </button>
                                        
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded shrink-0">
                                            <span>{t.source_lang}</span>
                                            <ArrowRightLeft size={10} className="opacity-50" />
                                            <span>{t.target_lang}</span>
                                        </div>

                                        <div className="flex flex-1 items-center gap-2 min-w-0 overflow-hidden text-sm">
                                            <span className="text-zinc-500 dark:text-zinc-500 truncate max-w-[40%]">{t.source_text}</span>
                                            <span className="text-zinc-300 dark:text-zinc-700 shrink-0">|</span>
                                            <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate flex-1">{t.translated_text}</span>
                                        </div>
                                    </div>

                                    {/* Acciones */}
                                    <div className="flex items-center gap-1 shrink-0 pl-11 md:pl-0">
                                        <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1 hidden md:block"></div>
                                        <button onClick={() => copyToClipboard(t.translated_text, t.id)} className="p-1.5 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors text-zinc-400" title="Copiar traducción">
                                            {copiedId === t.id ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
                                        </button>
                                        <button onClick={() => deleteTranslation(t.id)} className="p-1.5 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors text-zinc-400" title="Eliminar para siempre">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Vista Expandida */}
                                {isExpanded && (
                                    <div className="mt-2 bg-zinc-100/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 animate-fadeIn">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="relative group text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                                <div className="mb-1 text-[10px] font-bold text-violet-500/70 uppercase tracking-wider">{getLangName(t.source_lang)}</div>
                                                {t.source_text}
                                                <button onClick={() => playAudio(t.source_text, t.source_lang)} className="absolute top-0 right-0 p-1.5 opacity-0 group-hover:opacity-100 bg-white dark:bg-zinc-800 text-zinc-400 hover:text-violet-500 rounded-md transition-all shadow-sm">
                                                    <Volume2 size={14} />
                                                </button>
                                            </div>
                                            <div className="relative group text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                                                <div className="mb-1 text-[10px] font-bold text-violet-500/70 uppercase tracking-wider">{getLangName(t.target_lang)}</div>
                                                {t.translated_text}
                                                <button onClick={() => playAudio(t.translated_text, t.target_lang)} className="absolute top-0 right-0 p-1.5 opacity-0 group-hover:opacity-100 bg-white dark:bg-zinc-800 text-zinc-400 hover:text-emerald-500 rounded-md transition-all shadow-sm">
                                                    <Volume2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )})}
                        {filteredTranslations.length === 0 && translations.length > 0 && (
                            <div className="text-center text-sm text-zinc-400 p-8 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-2xl">
                                No se encontraron traducciones que coincidan con la búsqueda.
                            </div>
                        )}
                    </div>
                    {translations.length === 0 && (
                        <div className="text-center text-sm text-zinc-400 p-8 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-2xl">
                            Aún no tienes traducciones guardadas en el archivo.
                        </div>
                    )}
                </div>

            </div>
        </div>
    </div>
  );
};