import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Star, Clock, List, X, Pin, PinOff } from 'lucide-react';
import { Group } from '../types';
import { useUIStore } from '../src/lib/store';

interface GroupLauncherProps {
    groups: Group[];
    isOpen: boolean;
    onClose: () => void;
    onTogglePin: (groupId: string, currentStatus: boolean) => void;
}

export const GroupLauncher: React.FC<GroupLauncherProps> = ({ groups, isOpen, onClose, onTogglePin }) => {
    const {
        openGroup,
        lastLauncherTab,
        setLauncherTab,
        dockedGroupIds,
        closeGroup
    } = useUIStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'alpha' | 'recent' | 'pinned'>(lastLauncherTab);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input on open & Handle Escape
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
            setActiveTab(lastLauncherTab); // Sync with store if changed elsewhere

            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    onClose();
                }
            };
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        } else {
            setSearchQuery('');
        }
    }, [isOpen, lastLauncherTab, onClose]);

    // Handle Tab Change with persistence
    const handleTabChange = (tab: 'alpha' | 'recent' | 'pinned') => {
        setActiveTab(tab);
        setLauncherTab(tab);
    };

    // Filter and Sort Logic
    const filteredGroups = useMemo(() => {
        let result = groups;

        // 1. Search Filter (Global)
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(g => g.title.toLowerCase().includes(q));
            // When searching, we might want to show all matches regardless of tab?
            // Or keep tab context? Expectation: Search usually overrides tabs or tabs filter search results.
            // Let's make search override tabs for better UX, or just filter within active tab?
            // "Header Fijo: Buscador global (filtra en tiempo real)."
            // Usually global search shows everything.
        }

        // 2. Tab Filter (only if no search or if we want to filter search results by tab)
        // If user is searching, they probably want to find ANY group.
        // Let's apply tab filtering only if (searchQuery is empty).
        if (!searchQuery.trim()) {
            switch (activeTab) {
                case 'pinned':
                    result = result.filter(g => g.is_pinned);
                    break;
                case 'recent':
                    // Sort by last_accessed_at desc, take top 10
                    // Filter? Recent implies "all sorted by recent" or "subset"?
                    // "Recientes: Los últimos 10 grupos accedidos."
                    result = [...result]
                        .sort((a, b) => {
                            const dateA = a.last_accessed_at ? new Date(a.last_accessed_at).getTime() : 0;
                            const dateB = b.last_accessed_at ? new Date(b.last_accessed_at).getTime() : 0;
                            return dateB - dateA;
                        })
                        .slice(0, 10);
                    break;
                case 'alpha':
                default:
                    result = [...result].sort((a, b) => a.title.localeCompare(b.title));
                    break;
            }
        } else {
            // If searching, maybe just simple A-Z sort for results?
            result = [...result].sort((a, b) => {
                // Put pinned first?
                if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
                return a.title.localeCompare(b.title);
            });
        }

        return result;
    }, [groups, searchQuery, activeTab]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
            <div
                className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all scale-100"
                onClick={e => e.stopPropagation()}
            >
                {/* Header: Search */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-lg">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Buscar grupos..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-all text-lg"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Tabs - Only show if NO search query */}
                {!searchQuery.trim() && (
                    <div className="flex items-center p-2 gap-2 border-b border-slate-100 dark:border-slate-800">
                        <button
                            onClick={() => handleTabChange('alpha')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'alpha'
                                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            <List size={16} /> A-Z
                        </button>
                        <button
                            onClick={() => handleTabChange('recent')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'recent'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            <Clock size={16} /> Recientes
                        </button>
                        <button
                            onClick={() => handleTabChange('pinned')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'pinned'
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            <Pin size={16} /> Pineados
                        </button>
                    </div>
                )}

                {/* List */}
                <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                    {filteredGroups.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <p>No se encontraron grupos.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-1">
                            {filteredGroups.map(group => {
                                const isDocked = dockedGroupIds.includes(group.id);
                                return (
                                    <div
                                        key={group.id}
                                        className="group flex items-center justify-between w-full p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
                                    >
                                        {/* ZONA 1: ABRIR GRUPO (Click Principal) */}
                                        <div
                                            className="flex-1 flex items-center gap-3 cursor-pointer min-w-0"
                                            onClick={() => {
                                                openGroup(group.id);
                                                onClose();
                                            }}
                                        >
                                            {/* Avatar */}
                                            <div className={`
                                                w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-lg font-bold transition-colors
                                                ${group.is_pinned
                                                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-500'
                                                    : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}
                                            `}>
                                                {group.title.charAt(0).toUpperCase()}
                                            </div>

                                            {/* Texto */}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center gap-2">
                                                    {group.title}
                                                </div>
                                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                                    {group.notes.length} notas
                                                    {isDocked && <span className="text-zinc-500 font-medium ml-1">• Abierto</span>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* ZONA 2: BOTÓN PIN (Acción Secundaria) */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation(); // CRÍTICO: Evita abrir el grupo
                                                onTogglePin(group.id, !!group.is_pinned);
                                            }}
                                            className={`
                                                p-2 rounded-lg transition-all ml-2
                                                ${group.is_pinned
                                                    ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/10 opacity-100'
                                                    : 'text-slate-400 hover:text-amber-500 hover:bg-slate-200 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 focus:opacity-100'}
                                            `}
                                            title={group.is_pinned ? "Desanclar grupo" : "Anclar grupo"}
                                        >
                                            {group.is_pinned
                                                ? <Pin size={18} className="fill-current" />
                                                : <Pin size={18} />
                                            }
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Hint */}
                {searchQuery.trim() === '' && (
                    <div className="bg-slate-50 dark:bg-slate-950/50 p-2 text-center text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">
                        Presiona <code>Esc</code> para cerrar
                    </div>
                )}
            </div>
        </div>
    );
};
