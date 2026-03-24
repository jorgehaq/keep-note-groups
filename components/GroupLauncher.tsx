import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Clock, List, Pin, FolderOpen, X, Star } from 'lucide-react';
import { Group } from '../types';
import { useUIStore } from '../src/lib/store';

interface GroupLauncherProps {
    groups: Group[];
    isOpen: boolean;
    onClose: () => void;
    onTogglePin: (groupId: string, currentStatus: boolean) => void;
    onToggleFavorite: (groupId: string, currentStatus: boolean) => void;
}

export const GroupLauncher: React.FC<GroupLauncherProps> = ({ groups, isOpen, onClose, onTogglePin, onToggleFavorite }) => {
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
                <div className="max-h-[60vh] overflow-y-auto hidden-scrollbar p-3">
                    {filteredGroups.length === 0 ? (
                        <div className="text-center py-10 text-zinc-400">
                            <p>No se encontraron grupos.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {filteredGroups.map(group => {
                                const isDocked = dockedGroupIds.includes(group.id);
                                const borderClass = group.is_favorite
                                    ? 'border-yellow-400/50 dark:border-[#3F3F46]'
                                    : group.is_pinned
                                        ? 'border-amber-400/50 dark:border-[#3F3F46]'
                                        : isDocked
                                            ? 'border-indigo-500/40 dark:border-[#3F3F46]'
                                            : 'border-zinc-200 dark:border-[#3F3F46]';
                                // Mismo hover que las tarjetas de notas: indigo-500/50 + bg indigo

                                return (
                                    <div
                                        key={group.id}
                                        className={`group relative flex items-center justify-between gap-2 p-2.5 rounded-xl border bg-white dark:bg-[#1A1A24] transition-all cursor-pointer active:scale-[0.98] hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:shadow-xl ${borderClass}`}
                                        onClick={() => {
                                            openGroup(group.id);
                                            setGlobalView('notes');
                                            onClose();
                                        }}
                                    >
                                        {/* Icon and Title */}
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center shrink-0">
                                                {isDocked
                                                    ? <FolderOpen size={14} className="text-indigo-500 fill-indigo-500/20" />
                                                    : <FolderOpen size={14} className="text-zinc-400" />
                                                }
                                            </div>
                                            <span className="text-[13px] font-bold leading-tight truncate text-zinc-800 dark:text-[#CCCCCC]">
                                                {highlightMatch(group.title.length > 40 ? group.title.substring(0, 40) + '...' : group.title)}
                                            </span>
                                        </div>

                                        {/* Actions, Badges, and Count */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(group.id, !!group.is_favorite); }}
                                                    className={`p-1 rounded-lg border transition-all ${
                                                        group.is_favorite
                                                            ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400/40 opacity-100'
                                                            : 'text-zinc-400 hover:text-yellow-500 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 border-transparent hover:border-yellow-400/30'
                                                    }`}
                                                    title={group.is_favorite ? "Quitar de favoritos" : "Marcar favorito"}
                                                >
                                                    <Star size={12} className={group.is_favorite ? 'fill-current' : ''} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onTogglePin(group.id, !!group.is_pinned); }}
                                                    className={`p-1 rounded-lg border transition-all ${
                                                        group.is_pinned
                                                            ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-400/40 opacity-100'
                                                            : 'text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 border-transparent hover:border-amber-400/30'
                                                    }`}
                                                    title={group.is_pinned ? "Desanclar" : "Anclar"}
                                                >
                                                    <Pin size={12} className={group.is_pinned ? 'fill-current' : ''} />
                                                </button>
                                            </div>
                                            {/* Badges visibles sin hover cuando tienen estado */}
                                            {(group.is_favorite || group.is_pinned) && (
                                                <div className="flex items-center gap-0.5 group-hover:hidden">
                                                    {group.is_favorite && <Star size={11} className="text-yellow-500 fill-current" />}
                                                    {group.is_pinned && <Pin size={11} className="text-amber-500 fill-current" />}
                                                </div>
                                            )}
                                            <span className="text-[10px] font-bold text-zinc-400 dark:text-[#CCCCCC]/50 shrink-0 min-w-[12px] text-right">
                                                {group.notes.length}
                                            </span>
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
