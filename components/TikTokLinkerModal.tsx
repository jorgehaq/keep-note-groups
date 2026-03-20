import React, { useState, useMemo } from 'react';
import { Search, Plus, X, Folder, ArrowUpRight, Loader2 } from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient';
import { Group } from '../types';

interface TikTokLinkerModalProps {
    video: { id: string; title?: string; author?: string; url?: string; summary?: string; key_points?: string[]; transcript?: string; scratchpad?: string };
    groups: Group[];
    onClose: () => void;
    onSuccess: (groupId: string, noteId: string) => void;
}

export const TikTokLinkerModal: React.FC<TikTokLinkerModalProps> = ({ video, groups, onClose, onSuccess }) => {
    const [mode, setMode] = useState<'create' | 'link'>('create');
    const [loading, setLoading] = useState(false);
    
    // --- CREATE MODE STATES ---
    const [groupInput, setGroupInput] = useState('');
    
    // --- LINK MODE STATES ---
    const [searchQuery, setSearchQuery] = useState('');

    const allNotes = useMemo(() => {
        return groups.flatMap(g => g.notes.map(n => ({ ...n, groupName: g.title, groupId: g.id })));
    }, [groups]);

    const filteredNotes = useMemo(() => {
        if (!searchQuery.trim()) return [];
        return allNotes.filter(n => (n.title || '').toLowerCase().includes(searchQuery.toLowerCase()));
    }, [allNotes, searchQuery]);

    const exactGroupMatch = groups.find(g => g.title.toLowerCase() === groupInput.trim().toLowerCase());

    const buildContent = () => {
        return `
# [ANÁLISIS TIKTOK] ${video.title}
**Autor:** @${video.author} | **URL:** ${video.url}

## 📝 RESUMEN EJECUTIVO
${video.summary || "_Sin resumen generado_"}

## 💡 PUNTOS CLAVE
${video.key_points?.map(p => `- ${p}`).join("\n") || "_Sin puntos clave_"}

## ✍️ NOTAS DE TRABAJO
${video.scratchpad || "_Sin notas_"}

---

## 🎙️ TRANSCRIPCIÓN COMPLETA
${video.transcript || "_Sin transcripción_"}
`.trim();
    };

    const handleCreateFlow = async () => {
        if (!groupInput.trim()) return;
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No session");

            let targetGroupId = exactGroupMatch?.id;

            if (!targetGroupId) {
                const { data: newGroup, error: groupError } = await supabase
                    .from('groups')
                    .insert([{ name: groupInput.trim(), user_id: session.user.id }])
                    .select().single();
                if (groupError) throw groupError;
                targetGroupId = newGroup.id;
            }

            const { data: noteData, error: noteError } = await supabase
                .from('notes')
                .insert([{
                    title: `TikTok: ${video.title?.slice(0, 40)}`, 
                    content: buildContent(), 
                    group_id: targetGroupId, 
                    user_id: session.user.id 
                }])
                .select().single();
            
            if (noteError) throw noteError;

            window.dispatchEvent(new CustomEvent('reload-app-data'));
            window.dispatchEvent(new CustomEvent('kanban-updated'));
            onSuccess(targetGroupId, noteData.id);
        } catch (error: any) {
            alert('Error en la creación: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLinkFlow = async (targetNoteId: string, targetGroupId: string) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('notes')
                .update({ content: buildContent() })
                .eq('id', targetNoteId);

            if (error) throw error;

            window.dispatchEvent(new CustomEvent('reload-app-data'));
            window.dispatchEvent(new CustomEvent('kanban-updated'));
            onSuccess(targetGroupId, targetNoteId);
        } catch (error: any) {
            alert('Error al vincular: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-fadeIn" onClick={e => e.stopPropagation()}>
                
                {/* Header & Tabs */}
                <div className="border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex justify-between items-center p-4 pb-2">
                        <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                            <ArrowUpRight size={18} className="text-[#EE1D52]"/>
                            Convertir TikTok a Nota
                        </h3>
                        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex px-4 gap-4">
                        <button 
                            onClick={() => setMode('create')}
                            className={`pb-3 text-sm font-normal transition-colors border-b-2 ${mode === 'create' ? 'border-[#EE1D52] text-[#EE1D52]' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                        >
                            Nueva Nota en Grupo
                        </button>
                        <button 
                            onClick={() => setMode('link')}
                            className={`pb-3 text-sm font-normal transition-colors border-b-2 ${mode === 'link' ? 'border-[#EE1D52] text-[#EE1D52]' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                        >
                            Actualizar Nota Existente
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 min-h-[250px] flex flex-col">
                    {mode === 'create' ? (
                        <div className="flex-1 flex flex-col">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Folder size={14} /> Selecciona o crea un Grupo
                            </label>
                            <input 
                                list="tiktok-groups-list"
                                value={groupInput}
                                onChange={e => setGroupInput(e.target.value)}
                                placeholder="Ej: Trabajo, Ideas, Proyecto X..."
                                className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-[#EE1D52] outline-none transition-all"
                            />
                            <datalist id="tiktok-groups-list">
                                {groups.map(g => <option key={g.id} value={g.title} />)}
                            </datalist>

                            <div className="mt-3 text-sm text-zinc-500">
                                Acción: {exactGroupMatch 
                                    ? <span className="text-[#EE1D52] font-medium">Se añadirá al grupo "{exactGroupMatch.title}"</span>
                                    : groupInput.trim() 
                                        ? <span className="text-amber-600 font-medium">✨ Se creará el nuevo grupo "{groupInput.trim()}"</span>
                                        : "Elige un grupo para la nota"}
                            </div>

                            <button 
                                onClick={handleCreateFlow}
                                disabled={!groupInput.trim() || loading}
                                className="mt-auto w-full flex items-center justify-center gap-2 bg-[#EE1D52] hover:bg-[#D61A4A] text-white font-normal py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#EE1D52]/20"
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                                Exportar y Abrir Nota
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col">
                            <div className="relative mb-4">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <input 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Buscar nota para sobrescribir..."
                                    className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-[#EE1D52] outline-none"
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto max-h-[200px] border border-zinc-100 dark:border-zinc-800 rounded-xl p-1">
                                {filteredNotes.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-xs text-zinc-400 text-center p-4">
                                        {searchQuery ? "No hay coincidencias" : "Busca una nota para actualizarla"}
                                    </div>
                                ) : (
                                    filteredNotes.map(note => (
                                        <button 
                                            key={note.id}
                                            onClick={() => handleLinkFlow(note.id, note.groupId)}
                                            disabled={loading}
                                            className="w-full flex flex-col items-start p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left"
                                        >
                                            <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200 truncate w-full">
                                                {note.title || 'Sin título'}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                                <Folder size={10} /> {note.groupName}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
