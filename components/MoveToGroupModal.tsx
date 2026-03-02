import React, { useState, useMemo } from 'react';
import { Search, X, Folder, Move, Loader2 } from 'lucide-react';
import { Group, Note } from '../types';

interface MoveToGroupModalProps {
    note: Note;
    groups: Group[];
    onClose: () => void;
    onMove: (noteId: string, targetGroupId: string) => Promise<void>;
}

export const MoveToGroupModal: React.FC<MoveToGroupModalProps> = ({ note, groups, onClose, onMove }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const filteredGroups = useMemo(() => {
        return groups.filter(g => 
            g.id !== note.group_id && 
            g.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [groups, note.group_id, searchQuery]);

    const handleMove = async (targetGroupId: string) => {
        setLoading(true);
        try {
            await onMove(note.id, targetGroupId);
            onClose();
        } catch (error: any) {
            alert('Error al mover la nota: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-fadeIn" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="border-b border-zinc-200 dark:border-zinc-800 p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                        <Move size={18} className="text-indigo-500"/>
                        Mover a Grupo
                    </h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 flex flex-col gap-4">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar grupo..."
                            className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            autoFocus
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[300px] border border-zinc-100 dark:border-zinc-800 rounded-xl p-1">
                        {filteredGroups.length === 0 ? (
                            <div className="py-8 text-center text-xs text-zinc-400">
                                {searchQuery ? "No se encontraron grupos" : "No hay otros grupos disponibles"}
                            </div>
                        ) : (
                            filteredGroups.map(group => (
                                <button 
                                    key={group.id}
                                    onClick={() => handleMove(group.id)}
                                    disabled={loading}
                                    className="w-full flex items-center gap-3 p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left group"
                                >
                                    <div className="p-2 bg-zinc-100 dark:bg-zinc-700 rounded-lg text-zinc-400 group-hover:text-indigo-500 transition-colors">
                                        <Folder size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm text-zinc-800 dark:text-zinc-200 truncate truncate">
                                            {group.title}
                                        </div>
                                        <div className="text-[10px] text-zinc-500">
                                            {group.notes.length} {group.notes.length === 1 ? 'nota' : 'notas'}
                                        </div>
                                    </div>
                                    {loading ? <Loader2 size={14} className="animate-spin text-zinc-400" /> : <Move size={14} className="text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-500 font-medium">
                    Nota: "{note.title || 'Sin título'}" se cambiará de grupo.
                </div>
            </div>
        </div>
    );
};
