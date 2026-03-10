import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Clock, List, Pin, FolderOpen, X } from 'lucide-react';
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
        closeGroup,
        setGlobalView
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

    // Highlight matching text in group names
    const highlightMatch = (text: string) => {
        if (!searchQuery.trim()) return text;
        const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, i) =>
            regex.test(part)
                ? <mark key={i} className="bg-amber-200 dark:bg-amber-700/50 text-amber-900 dark:text-amber-100 rounded-sm px-0.5">{part}</mark>
                : part
        );
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
            <div
                className="w-full max-w-2xl mx-4 sm:mx-auto bg-white dark:bg-[#1A1A24] rounded-2xl shadow-2xl border border-zinc-200 dark:border-[#2D2D42] overflow-hidden transform transition-all scale-100"
                onClick={e => e.stopPropagation()}
            >
                {/* Header: Search */}
                <div className="p-4 bg-white/50 dark:bg-[#1A1A24]/90 backdrop-blur-lg pb-2">
                    <div className="relative flex items-center">
                        <Search size={15} className={`absolute left-3 pointer-events-none transition-colors ${searchQuery.trim() ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-400'}`} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Buscar grupos..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className={`w-full pl-9 pr-8 py-2 text-sm rounded-lg border transition-all focus:outline-none ${searchQuery.trim()
                                ? 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 font-semibold placeholder-amber-700/50 dark:placeholder-amber-400/50'
                                : 'border-zinc-200 dark:border-[#2D2D42] bg-white dark:bg-[#13131A] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-1 focus:ring-zinc-400/30'}`}
                            autoFocus
                        />
                        {searchQuery.trim() && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 p-0.5 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 bg-amber-200/50 dark:bg-amber-800/50 hover:bg-amber-300/50 dark:hover:bg-amber-700/50 rounded-full transition-colors"
                                title="Limpiar búsqueda"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs - Only show if NO search query */}
                {!searchQuery.trim() && (
                    <div className="px-4 py-1">
                        <div className="flex bg-zinc-100 dark:bg-black/40 p-1 rounded-xl border border-zinc-200 dark:border-[#2D2D42]">
                            <button
                                onClick={() => handleTabChange('alpha')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded-lg transition-all ${activeTab === 'alpha'
                                    ? 'bg-white dark:bg-[#2D2D42] text-zinc-900 dark:text-[#CCCCCC] shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                                    }`}
                            >
                                <List size={14} /> A-Z
                            </button>
                            <button
                                onClick={() => handleTabChange('recent')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded-lg transition-all ${activeTab === 'recent'
                                    ? 'bg-white dark:bg-[#2D2D42] text-zinc-900 dark:text-[#CCCCCC] shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                                    }`}
                            >
                                <Clock size={14} /> RECIENTES
                            </button>
                            <button
                                onClick={() => handleTabChange('pinned')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded-lg transition-all ${activeTab === 'pinned'
                                    ? 'bg-white dark:bg-[#2D2D42] text-zinc-900 dark:text-[#CCCCCC] shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                                    }`}
                            >
                                <Pin size={14} /> PINEADOS
                            </button>
                        </div>
                    </div>
                )}

                {/* List */}
                <div className="max-h-[60vh] overflow-y-auto hidden-scrollbar p-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-700">
                    {filteredGroups.length === 0 ? (
                        <div className="text-center py-10 text-zinc-400">
                            <p>No se encontraron grupos.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-1">
                            {filteredGroups.map(group => {
                                return (
                                    <div
                                        key={group.id}
                                        className="group flex items-center justify-between w-full px-3 h-[25px] rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                    >
                                        {/* ZONA 1: ABRIR GRUPO (Click Principal) */}
                                        <div
                                            className="flex-1 min-w-0 flex flex-row items-center gap-1.5"
                                            onClick={() => {
                                                openGroup(group.id);
                                                setGlobalView('notes');
                                                onClose();
                                            }}
                                        >
                                            <span className={`text-sm font-medium leading-none truncate uppercase ${
                                                dockedGroupIds.includes(group.id)
                                                    ? 'text-[#4940D9]'
                                                    : 'text-zinc-800 dark:text-[#CCCCCC]'
                                            }`}>
                                                {highlightMatch(group.title)}
                                            </span>
                                            <span className="text-sm font-medium leading-none text-zinc-800 dark:text-[#CCCCCC] opacity-40 group-hover:opacity-100 transition-opacity shrink-0">
                                                ({group.notes.length})
                                            </span>
                                        </div>

                                        {/* ZONA 2: ACCIONES (Carpeta, Pin, Conteo) */}
                                        <div className="flex items-center gap-1 ml-2 shrink-0">
                                            {/* Status: Open (Folder) */}
                                            <div className="w-6 h-6 flex items-center justify-center p-1">
                                                {dockedGroupIds.includes(group.id) && (
                                                    <FolderOpen size={14} className="text-[#4940D9] opacity-0 group-hover:opacity-100 transition-all shrink-0 fill-[#4940D9]" />
                                                )}
                                            </div>

                                            {/* Action: Pin */}
                                            <div className="w-6 h-6 flex items-center justify-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onTogglePin(group.id, !!group.is_pinned);
                                                    }}
                                                    className={`
                                                        p-1 rounded-md transition-all
                                                        ${group.is_pinned
                                                            ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/10 opacity-100'
                                                            : 'text-zinc-400 hover:text-amber-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 opacity-0 group-hover:opacity-100 focus:opacity-100'}
                                                    `}
                                                    title={group.is_pinned ? "Desanclar grupo" : "Anclar grupo"}
                                                >
                                                    <Pin size={14} className={group.is_pinned ? 'fill-current' : ''} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Hint */}
                {searchQuery.trim() === '' && (
                    <div className="bg-zinc-50 dark:bg-[#13131A] p-2 text-center text-xs text-zinc-400 border-t border-zinc-100 dark:border-[#2D2D42]">
                        Presiona <code>Esc</code> para cerrar
                    </div>
                )}
            </div>
        </div>
    );
};
