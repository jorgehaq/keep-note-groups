import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Play, Check, X, Search, ExternalLink, Plus, Maximize2, Minimize2,
  Bell, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Clock,
  User, Heart, Eye, Type, Share2, Music, ChevronsDownUp, ArrowUpDown,
  Calendar, History, PanelLeft, Settings, MoreVertical, Trash2,
  Archive, Download, Sparkles, FileText, Quote, StickyNote, Wind,
  PlusCircle, AlertCircle, PenLine, Brain, GitBranch, RotateCcw,
  Loader2, ListPlus, ArrowUpRight, Hash, CheckSquare, Pin, Columns, Rows, CloudCheck
} from 'lucide-react';

import { supabase } from '../src/lib/supabaseClient';
import { useUIStore } from '../src/lib/store';
import { Session } from '@supabase/supabase-js';
import { TikTokVideo, TikTokQueueItem, BrainDump } from '../types';
import { KanbanSemaphore } from './KanbanSemaphore';
import { TikTokAIPanel } from './TikTokAIPanel';
import { SmartNotesEditor, SmartNotesEditorRef } from '../src/components/editor/SmartNotesEditor';
import { useTikTokSummaries } from '../src/lib/useTikTokSummaries';
import { useTikTokSubnotes } from '../src/lib/useTikTokSubnotes';
import { TikTokLinkerModal } from './TikTokLinkerModal';

// --- HELPERS ---
const formatDuration = (secs: number): string => {
  if (!secs) return '0:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const highlightText = (text: string, highlight?: string): React.ReactNode => {
  if (!highlight || !highlight.trim()) return text;
  const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, index) =>
    part.toLowerCase() === highlight.toLowerCase() ? (
      <mark key={index} className="bg-yellow-200 dark:bg-yellow-500/40 text-yellow-900 dark:text-yellow-100 px-0.5 font-medium">
        {part}
      </mark>
    ) : (
      part
    )
  );
};

// Thumbnail with fallback for expired TikTok CDN URLs
const ThumbnailImg: React.FC<{ src?: string; className?: string; alt?: string }> = ({ src, className, alt }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`${className} flex items-center justify-center bg-zinc-800`}>
        <Play size={14} className="text-zinc-600 ml-0.5" />
      </div>
    );
  }
  return <img src={src} className={className} alt={alt || ''} onError={() => setFailed(true)} />;
};

// ─── SummaryTitle (inline rename) ────────────────────────────────────────────
const SummaryTitle: React.FC<{
  summary: any;
  isActive: boolean;
  searchQuery?: string;
  onRename: (id: string, newObjective: string) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
}> = ({ summary, isActive, searchQuery, onRename, isEditing, setIsEditing }) => {
  const [val, setVal] = useState(summary.target_objective || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(summary.target_objective || ''); }, [summary.target_objective]);

  const save = () => {
    setIsEditing(false);
    const trimmed = val.trim();
    if (trimmed && trimmed !== summary.target_objective) onRename(summary.id, trimmed);
    else setVal(summary.target_objective || '');
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(0, 0);
      inputRef.current.scrollLeft = 0;
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={val}
        autoFocus
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') { setIsEditing(false); setVal(summary.target_objective || ''); }
          e.stopPropagation();
        }}
        onClick={e => e.stopPropagation()}
        className="bg-black text-white border-violet-500 border rounded px-1.5 py-0.5 outline-none text-[14px] max-w-[280px] shadow-inner text-left"
        placeholder="Título..."
      />
    );
  }

  return (
    <span
      className="truncate max-w-[120px] cursor-pointer"
      onDoubleClick={e => { e.stopPropagation(); if (isActive) setIsEditing(true); }}
      title={isActive ? 'Doble clic para renombrar' : summary.target_objective || ''}
    >
      {searchQuery?.trim() ? highlightText(summary.target_objective || 'Resumen', searchQuery.trim()) : (summary.target_objective || 'Resumen')}
    </span>
  );
};

// ─── SubnoteTabTitle (inline rename in tab) ───────────────────────────────────
const SubnoteTabTitle: React.FC<{
  note: any;
  isActive: boolean;
  searchQuery?: string;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  onRename: (id: string, title: string) => void;
}> = ({ note, isActive, searchQuery, isEditing, setIsEditing, onRename }) => {
  const [val, setVal] = useState(note.title || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(note.title || ''); }, [note.title]);

  const save = () => {
    setIsEditing(false);
    const trimmed = val.trim();
    if (trimmed !== (note.title || '')) onRename(note.id, trimmed);
    else setVal(note.title || '');
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={val}
        autoFocus
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') { setIsEditing(false); setVal(note.title || ''); }
          e.stopPropagation();
        }}
        onClick={e => e.stopPropagation()}
        className="bg-zinc-800 text-white border-emerald-500 border rounded px-1.5 py-0.5 outline-none text-[14px] max-w-[280px] shadow-inner text-left"
        placeholder="Título..."
      />
    );
  }

  return (
    <span
      className="truncate max-w-[120px] cursor-pointer"
      onDoubleClick={e => { e.stopPropagation(); if (isActive) setIsEditing(true); }}
      title={isActive ? 'Doble clic para renombrar' : note.title || ''}
    >
      {searchQuery?.trim() ? highlightText(note.title || 'Sin título', searchQuery.trim()) : (note.title || 'Sin título')}
    </span>
  );
};

// ─── MODAL ────────────────────────────────────────────────────────────────────
const NewTikTokModal: React.FC<{
  onClose: () => void;
  queue: TikTokQueueItem[];
  onAdd: (urls: string) => void;
  isAdding: boolean;
}> = ({ onClose, queue, onAdd, isAdding }) => {
  const [urlInput, setUrlInput] = useState("");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white dark:bg-[#1A1A24] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#EE1D52]/20 text-[#EE1D52] rounded-xl">
              <PlusCircle size={20} />
            </div>
            <h2 className="text-lg font-bold text-white uppercase tracking-tight">Nuevo TikTok</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto hidden-scrollbar flex flex-col gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Pegar URLs (una por línea o separadas por coma)</label>
            <div className="flex gap-2">
              <textarea
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://www.tiktok.com/@user/video/..."
                className="flex-1 min-h-[100px] bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200 outline-none focus:border-[#EE1D52]/50 transition-all resize-none font-mono"
              />
            </div>
            <button
              onClick={() => { onAdd(urlInput); setUrlInput(""); }}
              disabled={isAdding || !urlInput.trim()}
              className="w-full py-3 bg-[#EE1D52] hover:bg-[#D61A4A] disabled:opacity-50 text-white rounded-2xl text-sm font-bold transition-all active:scale-[0.98] shadow-lg shadow-[#EE1D52]/20 flex items-center justify-center gap-2"
            >
              {isAdding ? <Clock className="animate-spin" size={18} /> : <Plus size={18} />}
              {isAdding ? "Procesando..." : "Agregar a la cola"}
            </button>
          </div>

          <div className="space-y-3 flex-1 min-h-[200px] flex flex-col">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <History size={12} /> Log de Pendientes y Procesados
              </label>
              <span className="text-[9px] font-bold text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded-full">{queue.length} items</span>
            </div>
            <div className="flex-1 bg-zinc-950/50 border border-zinc-800/80 rounded-2xl p-4 font-mono text-[10px] overflow-y-auto space-y-2">
              {queue.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-700 italic">No hay actividad reciente</div>
              ) : (
                queue.map(item => (
                  <div key={item.id} className="flex items-start gap-3 border-b border-zinc-900/50 pb-2 last:border-0">
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'failed' ? 'bg-red-500/10 text-red-500' : item.status === 'processing' ? 'bg-amber-500/10 text-amber-500 animate-pulse' : 'bg-zinc-500/10 text-zinc-400'}`}>
                      {item.status}
                    </span>
                    <span className="text-zinc-500 shrink-0">{new Date(item.created_at).toLocaleTimeString()}</span>
                    <span className="text-zinc-300 truncate flex-1">{item.url}</span>
                    {item.error_msg && <span className="text-red-400/60 italic" title={item.error_msg}>!!</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
export const TikTokApp: React.FC<{
  session: Session,
  allSummaries?: any[],
  allSubnotes?: any[],
  searchQuery?: string,
  onSearchQueryChange?: (q: string) => void,
  showLineNumbers?: boolean,
  onToggleLineNumbers?: () => void
}> = ({
  session,
  allSummaries = [],
  allSubnotes = [],
  searchQuery = "",
  onSearchQueryChange,
  showLineNumbers = false,
  onToggleLineNumbers
}) => {
  const {
    isTikTokMaximized, setIsTikTokMaximized,
    tikTokVideos, setTikTokVideos, updateTikTokVideoSync, deleteTikTokVideoSync,
    tikTokQueueItems, updateTikTokQueueItemSync, deleteTikTokQueueItemSync,
    focusedVideoId, setFocusedVideoId,
    isVideoTrayOpen, setIsVideoTrayOpen,
    isZenModeByApp, toggleZenMode,
    overdueRemindersCount, showOverdueMarquee, setShowOverdueMarquee,
    activeTabByVideo, setActiveTabByVideo,
    isTikTokPizarronOpen, setIsTikTokPizarronOpen,
    pizarronVisibleByNoteAndTab, setPizarronVisible,
    groups, activeGroupId,
    brainDumps, globalTasks,
    isArchiveOpenByApp, setArchiveOpenByApp
  } = useUIStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [scrollToActiveCount, setScrollToActiveCount] = useState(0);
  const triggerScrollToActive = () => setScrollToActiveCount(prev => prev + 1);

  const [localSearch, setLocalSearch] = useState(searchQuery);
  useEffect(() => { if (searchQuery !== localSearch) setLocalSearch(searchQuery); }, [searchQuery]);
  useEffect(() => {
    const timer = setTimeout(() => { onSearchQueryChange?.(localSearch); }, 50);
    return () => clearTimeout(timer);
  }, [localSearch]);

  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [sortMode, setSortMode] = useState<'date-desc' | 'date-asc' | 'created-desc' | 'created-asc' | 'alpha-asc' | 'alpha-desc'>(() => {
    return (localStorage.getItem('tiktok-sort-mode') as any) || 'created-asc';
  });
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [showAIInput, setShowAIInput] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollTrayLeft, setCanScrollTrayLeft] = useState(false);
  const [canScrollTrayRight, setCanScrollTrayRight] = useState(false);
  const [hasSearchMatchLeft, setHasSearchMatchLeft] = useState(false);
  const [hasSearchMatchRight, setHasSearchMatchRight] = useState(false);
  const [hasSearchMatchTrayLeft, setHasSearchMatchTrayLeft] = useState(false);
  const [hasSearchMatchTrayRight, setHasSearchMatchTrayRight] = useState(false);
  const [editingSubnoteTabId, setEditingSubnoteTabId] = useState<string | null>(null);
  const [editingSummaryTabId, setEditingSummaryTabId] = useState<string | null>(null);

  const moreMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const videoTrayRef = useRef<HTMLDivElement>(null);
  const [videoSaveStatus, setVideoSaveStatus] = useState<Record<string, 'saved' | 'saving' | 'error' | 'idle'>>({});

  const splitContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const editorRef = useRef<SmartNotesEditorRef>(null);
  const scratchRef = useRef<SmartNotesEditorRef>(null);
  const videoSaveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const tabBarRef = useRef<HTMLDivElement>(null);

  const isZenMode = !!isZenModeByApp['tiktok'];
  const focusedVideo = useMemo(() => tikTokVideos.find(v => v.id === focusedVideoId), [tikTokVideos, focusedVideoId]);
  const isInKanban = focusedVideo ? globalTasks?.some(t => t.id === focusedVideo.id || t.linked_tiktok_id === focusedVideo.id || t.source_id === focusedVideo.id) : false;

  const handleAddToKanban = async () => {
    if (!focusedVideo) return;
    const { error } = await supabase.from('tasks').insert([{
      id: focusedVideo.id,
      title: focusedVideo.title || 'Análisis TikTok',
      content: focusedVideo.content || '',
      status: 'backlog',
      user_id: session.user.id,
      linked_tiktok_id: focusedVideo.id
    }]);
    if (error) { console.error('Error linking to Kanban:', error); alert(`Error al vincular: ${error.message}`); return; }
    setShowMoreMenu(false);
    window.dispatchEvent(new CustomEvent('kanban-updated'));
  };

  const { summaries: aiSummaries, generateSummary, deleteSummary, updateScratchpad: updateSummaryScratchpad, updateSummaryMetadata, updateSummaryContent } = useTikTokSummaries(focusedVideoId);
  const { subnotes, createSubnote, deleteSubnote, updateSubnote } = useTikTokSubnotes(focusedVideoId);

  const activeTab = focusedVideoId ? (activeTabByVideo[focusedVideoId] || 'original') : 'original';
  const setActiveTab = (tabId: string) => { if (focusedVideoId) setActiveTabByVideo(focusedVideoId, tabId); };

  const unifiedTabs = useMemo(() => {
    const tabs = [
      ...aiSummaries.map(s => ({ id: `summary_${s.id}`, type: 'summary' as const, order_index: s.order_index || 0, data: s })),
      ...subnotes.map(n => ({ id: `note_${n.id}`, type: 'note' as const, order_index: n.order_index || 0, data: n }))
    ];
    return tabs.sort((a, b) => a.order_index - b.order_index);
  }, [aiSummaries, subnotes]);

  const getNewOrderIndex = () => {
    if (activeTab === 'original') {
      const first = unifiedTabs[0];
      if (!first) return 1;
      return first.order_index / 2;
    }
    const activeIndex = unifiedTabs.findIndex(t => t.id === activeTab);
    if (activeIndex === -1) {
      const last = unifiedTabs[unifiedTabs.length - 1];
      return last ? last.order_index + 1 : 1;
    }
    const current = unifiedTabs[activeIndex];
    const next = unifiedTabs[activeIndex + 1];
    if (!next) return current.order_index + 1;
    return (current.order_index + next.order_index) / 2;
  };

  // ── SCROLL: inner tabs ────────────────────────────────────────────────────
  const checkScroll = useCallback(() => {
    if (tabBarRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabBarRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
      const query = localSearch?.trim();
      if (!query) { setHasSearchMatchLeft(false); setHasSearchMatchRight(false); return; }
      let matchLeft = false; let matchRight = false;
      const tabs = tabBarRef.current.querySelectorAll('button[data-is-match="true"]');
      tabs.forEach(tab => {
        const t = tab as HTMLElement;
        const tabStart = t.offsetLeft; const tabEnd = tabStart + t.offsetWidth;
        if (tabStart < scrollLeft + 35) matchLeft = true;
        if (tabEnd > scrollLeft + clientWidth - 35) matchRight = true;
      });
      setHasSearchMatchLeft(matchLeft);
      setHasSearchMatchRight(matchRight);
    }
  }, [localSearch]);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabBarRef.current) tabBarRef.current.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  useEffect(() => {
    const container = tabBarRef.current;
    if (container) {
      checkScroll();
      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => { container.removeEventListener('scroll', checkScroll); window.removeEventListener('resize', checkScroll); };
    }
  }, [checkScroll, localSearch]);

  useEffect(() => { checkScroll(); }, [unifiedTabs, checkScroll]);

  useEffect(() => {
    if (!tabBarRef.current || !activeTab) return;
    const timer = setTimeout(() => {
      const activeBtn = tabBarRef.current?.querySelector('[data-active-tab="true"]');
      if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 100);
    return () => clearTimeout(timer);
  }, [activeTab, scrollToActiveCount]);

  // ── SCROLL: video tray ────────────────────────────────────────────────────
  const checkTrayScroll = useCallback(() => {
    if (videoTrayRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = videoTrayRef.current;
      setCanScrollTrayLeft(scrollLeft > 5);
      setCanScrollTrayRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 5);
      const query = localSearch?.trim();
      if (!query) { setHasSearchMatchTrayLeft(false); setHasSearchMatchTrayRight(false); return; }
      let matchLeft = false; let matchRight = false;
      const tabs = videoTrayRef.current.querySelectorAll('button[data-is-match="true"]');
      tabs.forEach(tab => {
        const t = tab as HTMLElement;
        if (t.offsetLeft < scrollLeft + 35) matchLeft = true;
        if (t.offsetLeft + t.offsetWidth > scrollLeft + clientWidth - 35) matchRight = true;
      });
      setHasSearchMatchTrayLeft(matchLeft);
      setHasSearchMatchTrayRight(matchRight);
    }
  }, [localSearch]);

  const scrollTray = (direction: 'left' | 'right') => {
    if (videoTrayRef.current) videoTrayRef.current.scrollBy({ left: direction === 'left' ? -350 : 350, behavior: 'smooth' });
  };

  useEffect(() => {
    const container = videoTrayRef.current;
    if (container) {
      checkTrayScroll();
      container.addEventListener('scroll', checkTrayScroll);
      window.addEventListener('resize', checkTrayScroll);
      const ro = new ResizeObserver(checkTrayScroll);
      ro.observe(container);
      return () => { container.removeEventListener('scroll', checkTrayScroll); window.removeEventListener('resize', checkTrayScroll); ro.disconnect(); };
    }
  }, [checkTrayScroll]);

  useEffect(() => {
    if (!videoTrayRef.current || !focusedVideoId || !isVideoTrayOpen) return;
    const timer = setTimeout(() => {
      const activeBtn = videoTrayRef.current?.querySelector('[data-active-tab="true"]');
      if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 150);
    return () => clearTimeout(timer);
  }, [focusedVideoId, isVideoTrayOpen, scrollToActiveCount]);

  // ── SEARCH MATCH ──────────────────────────────────────────────────────────
  const checkDumpTreeMatch = useCallback((dump: BrainDump, q: string): boolean => {
    if ((dump.title || '').toLowerCase().includes(q)) return true;
    if ((dump.content || '').toLowerCase().includes(q)) return true;
    if ((dump.scratchpad || '').toLowerCase().includes(q)) return true;
    const kids = brainDumps.filter(k => k.parent_id === dump.id);
    return kids.some(k => checkDumpTreeMatch(k, q));
  }, [brainDumps]);

  const checkVideoMatch = useCallback((video: TikTokVideo, query: string): boolean => {
    if (!query) return false;
    const q = query.toLowerCase();
    if ((video.title || '').toLowerCase().includes(q)) return true;
    if ((video.author || '').toLowerCase().includes(q)) return true;
    if ((video.description || '').toLowerCase().includes(q)) return true;
    if ((video.transcript || '').toLowerCase().includes(q)) return true;
    if ((video.content || '').toLowerCase().includes(q)) return true;
    if ((video.scratchpad || '').toLowerCase().includes(q)) return true;
    const videoSubnotes = allSubnotes.filter(n => n.tiktok_video_id === video.id);
    const checkNoteDeepMatch = (note: any): boolean => {
      if ((note.title || '').toLowerCase().includes(q) || (note.content || '').toLowerCase().includes(q) || (note.scratchpad || '').toLowerCase().includes(q)) return true;
      const nSums = allSummaries.filter(s => s.note_id === note.id);
      if (nSums.some(s => (s.target_objective || '').toLowerCase().includes(q) || (s.content || '').toLowerCase().includes(q) || (s.scratchpad || '').toLowerCase().includes(q))) return true;
      if (nSums.some(s => { if (!s.brain_dump_id) return false; const d = brainDumps.find(d => d.id === s.brain_dump_id); return d ? checkDumpTreeMatch(d, q) : false; })) return true;
      const kids = allSubnotes.filter(n => n.parent_id === note.id);
      return kids.some(checkNoteDeepMatch);
    };
    if (videoSubnotes.some(checkNoteDeepMatch)) return true;
    const videoSums = allSummaries.filter(s => s.tiktok_video_id === video.id);
    if (videoSums.some(s => {
      if ((s.target_objective || '').toLowerCase().includes(q) || (s.content || '').toLowerCase().includes(q) || (s.scratchpad || '').toLowerCase().includes(q)) return true;
      if (s.brain_dump_id) { const d = brainDumps.find(d => d.id === s.brain_dump_id); if (d && checkDumpTreeMatch(d, q)) return true; }
      return false;
    })) return true;
    const children = tikTokVideos.filter(v => v.parent_id === video.id);
    if (children.some(child => checkVideoMatch(child, query))) return true;
    return false;
  }, [brainDumps, allSubnotes, allSummaries, tikTokVideos, checkDumpTreeMatch]);

  const rootVideos = useMemo(() => {
    let result = tikTokVideos.filter(v => !v.parent_id && v.status !== 'archived');
    return result.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      switch (sortMode) {
        case 'date-desc': return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
        case 'date-asc': return new Date(a.updated_at || a.created_at || 0).getTime() - new Date(b.updated_at || b.created_at || 0).getTime();
        case 'created-desc': return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'created-asc': return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        case 'alpha-asc': return (a.title || '').localeCompare(b.title || '');
        case 'alpha-desc': return (b.title || '').localeCompare(a.title || '');
        default: return 0;
      }
    });
  }, [tikTokVideos, sortMode]);

  const archivedVideos = useMemo(() => tikTokVideos.filter(v => v.status === 'archived'), [tikTokVideos]);

  // ── CLICK OUTSIDE ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false);
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setIsSortMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── ACTIONS ───────────────────────────────────────────────────────────────
  const handleAddUrls = async (raw: string) => {
    const urls = raw.split(/[\n,\s]+/).map(u => u.trim()).filter(u => u.includes("tiktok.com"));
    if (!urls.length) return;
    setIsAdding(true);
    const rows = urls.map(url => ({ url, user_id: session.user.id, status: "pending" }));
    await supabase.from("tiktok_queue").insert(rows);
    setIsAdding(false);
  };

  const updateVideo = async (id: string, updates: Partial<TikTokVideo>) => {
    await supabase.from("tiktok_videos").update(updates).eq("id", id);
  };

  const debouncedUpdateVideo = (id: string, updates: Partial<TikTokVideo>) => {
    updateTikTokVideoSync(id, updates);
    setVideoSaveStatus(prev => ({ ...prev, [id]: 'saving' }));
    if (videoSaveTimeoutRef.current[id]) clearTimeout(videoSaveTimeoutRef.current[id]);
    videoSaveTimeoutRef.current[id] = setTimeout(async () => {
      const { error } = await supabase.from("tiktok_videos").update(updates).eq("id", id);
      setVideoSaveStatus(prev => ({ ...prev, [id]: error ? 'error' : 'saved' }));
    }, 800);
  };

  const deleteVideo = async (id: string, url?: string) => {
    if (!confirm("¿Eliminar permanentemente este TikTok y todas sus notas?")) return;
    deleteTikTokVideoSync(id);
    if (url) { const qItem = tikTokQueueItems.find(q => q.url === url); if (qItem) deleteTikTokQueueItemSync(qItem.id); }
    if (focusedVideoId === id) {
      const remaining = rootVideos.filter(v => v.id !== id);
      setFocusedVideoId(remaining.length > 0 ? remaining[0].id : null);
    }
    await supabase.from("notes").delete().eq("tiktok_video_id", id);
    if (url) await supabase.from("tiktok_queue").delete().eq("url", url);
    await supabase.from("tiktok_queue").delete().eq("video_id", id);
    await supabase.from("tiktok_videos").delete().eq("id", id);
  };

  const archiveVideo = async (id: string) => {
    updateTikTokVideoSync(id, { status: 'archived' });
    if (focusedVideoId === id) {
      const remaining = rootVideos.filter(v => v.id !== id);
      setFocusedVideoId(remaining.length > 0 ? remaining[0].id : null);
    }
    await supabase.from("tiktok_videos").update({ status: 'archived' }).eq("id", id);
  };

  const restoreVideo = async (id: string) => {
    await supabase.from("tiktok_videos").update({ status: 'active' }).eq("id", id);
  };

  const handleConvertToNote = () => { setIsLinkModalOpen(true); };

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const container = splitContainerRef.current;
    if (!container) return;
    const forcedOrientation = useUIStore.getState().forcedPizarronOrientation;
    const isMobile = window.innerWidth < 768;
    const layoutCol = forcedOrientation ? forcedOrientation === 'horizontal' : isMobile;

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const rect = container.getBoundingClientRect();
      if (layoutCol) {
        const ratio = (ev.clientY - rect.top) / rect.height;
        setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
      } else {
        const ratio = (ev.clientX - rect.left) / rect.width;
        setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
      }
    };
    const onUp = () => { isDraggingRef.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  const queryToUse = localSearch?.trim() || searchQuery?.trim() || "";
  const forcedOrientation = useUIStore(s => s.forcedPizarronOrientation);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const layoutCol = forcedOrientation ? forcedOrientation === 'horizontal' : isMobile;

  return (
    <div className={`flex flex-col h-full bg-zinc-50 dark:bg-[#13131A] text-zinc-900 dark:text-zinc-100 font-sans transition-all duration-300 ${isZenMode ? 'fixed inset-0 z-[60]' : 'relative'}`}>

      {/* ── TOPBAR ──────────────────────────────────────────────────────── */}
      {!isZenMode && (
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#13131A]/90 backdrop-blur-md shrink-0 border-b border-zinc-200 dark:border-zinc-800 shadow-sm transition-all">
          <div className="py-[10px] flex flex-col items-center justify-center">
            <div className="max-w-6xl mx-auto w-full flex flex-row items-center justify-center md:justify-between px-6 gap-4">
              <h1 className="hidden md:flex text-xl font-bold text-zinc-800 dark:text-[#CCCCCC] items-center gap-3">
                <div className="hidden md:flex h-9 w-9 items-center justify-center bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/40 rounded-xl shadow-sm shrink-0">
                  <Play size={20} className="ml-0.5" />
                </div>
                <span className="truncate">TikTok</span>
              </h1>

              <div className="flex items-center justify-center gap-2 sm:gap-3 shrink-0">
                {/* Search */}
                <div className="relative flex items-center group">
                  <Search size={15} className={`absolute left-3 transition-colors ${localSearch?.trim() ? 'text-[#EE1D52]' : 'text-zinc-500'}`} />
                  <input
                    type="text"
                    placeholder="Buscar TikTok..."
                    value={localSearch}
                    onChange={e => setLocalSearch(e.target.value)}
                    className={`h-9 pl-9 pr-8 rounded-xl border transition-all outline-none text-xs w-32 md:w-32 lg:w-40 ${localSearch?.trim() ? 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 placeholder-amber-700/50 dark:placeholder-amber-400/50 font-semibold' : 'bg-zinc-200/50 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500 hover:border-zinc-400 dark:hover:border-zinc-700 focus:border-[#EE1D52]/50'}`}
                  />
                  {localSearch?.trim() && (
                    <button onClick={() => setLocalSearch('')} className="absolute right-2 p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-zinc-300/80 dark:bg-zinc-800/80 rounded-full transition-colors">
                      <X size={10} />
                    </button>
                  )}
                </div>

                {/* Bell */}
                <button
                  onClick={() => overdueRemindersCount > 0 && setShowOverdueMarquee(!showOverdueMarquee)}
                  disabled={overdueRemindersCount === 0}
                  className={`hidden md:flex h-9 px-3 rounded-xl transition-all active:scale-95 shrink-0 flex items-center gap-2 border ${showOverdueMarquee ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/40 shadow-sm' : overdueRemindersCount > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40' : 'bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-400 opacity-60 cursor-not-allowed'}`}
                >
                  <Bell size={18} className={overdueRemindersCount > 0 ? `animate-pulse ${showOverdueMarquee ? 'text-red-700 dark:text-red-400' : 'text-red-500'}` : ''} />
                  {overdueRemindersCount > 0 && <span className="text-xs font-bold">{overdueRemindersCount}</span>}
                </button>

                {/* Tray Toggle */}
                <button
                  onClick={() => setIsVideoTrayOpen(!isVideoTrayOpen)}
                  className={`h-9 px-3 rounded-xl transition-all border flex items-center gap-2 active:scale-95 shrink-0 ${isVideoTrayOpen ? 'bg-red-50 dark:bg-[#EE1D52]/10 border-[#EE1D52]/40 text-[#EE1D52] font-bold shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-[#EE1D52]/50 hover:text-[#EE1D52]'}`}
                  title={isVideoTrayOpen ? "Ocultar bandeja" : "Mostrar bandeja"}
                >
                  <ChevronsDownUp size={18} className={`transition-transform duration-300 ${isVideoTrayOpen ? 'rotate-180' : ''}`} />
                  <span className="text-sm font-bold">{rootVideos.length}</span>
                </button>

                {/* Sort */}
                <div className="relative" ref={sortMenuRef}>
                  <button onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} className="h-9 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center justify-center active:scale-95" title="Ordenar">
                    <ArrowUpDown size={16} />
                  </button>
                  {isSortMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1A1A24] border border-zinc-200 dark:border-[#2D2D42] rounded-xl shadow-2xl z-50 py-1 overflow-hidden animate-fadeIn">
                      {[
                        { id: 'date-desc', label: 'Fecha (Recientes)', icon: <Calendar size={14} /> },
                        { id: 'date-asc', label: 'Fecha (Antiguos)', icon: <Calendar size={14} /> },
                        { id: 'created-desc', label: 'Creación (reciente)', icon: <Calendar size={14} /> },
                        { id: 'created-asc', label: 'Creación (antigua)', icon: <Calendar size={14} /> },
                        { id: 'alpha-asc', label: 'Nombre (A-Z)', icon: <Type size={14} /> },
                        { id: 'alpha-desc', label: 'Nombre (Z-A)', icon: <Type size={14} /> },
                      ].map(opt => (
                        <button key={opt.id} onClick={() => { setSortMode(opt.id as any); localStorage.setItem('tiktokSortMode', opt.id); setIsSortMenuOpen(false); }} className={`w-full px-4 py-2 text-left text-xs flex items-center gap-2 hover:bg-zinc-800 transition-colors ${sortMode === opt.id ? 'text-[#EE1D52] font-bold bg-[#EE1D52]/5' : 'text-zinc-400 font-medium'}`}>
                          {opt.icon} {opt.label}
                          {sortMode === opt.id && <Check size={14} className="ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* New */}
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="h-9 w-9 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/40 rounded-lg shadow-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all flex items-center justify-center active:scale-95 shrink-0"
                  title="Añadir TikTok"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VIDEO TRAY ───────────────────────────────────────────────────── */}
      {isVideoTrayOpen && !isZenMode && (
        <div className="bg-zinc-50 dark:bg-[#13131A] shrink-0 animate-slideDown group/tray border-b border-zinc-200 dark:border-transparent">
          <div className="max-w-6xl mx-auto relative px-0">
            <div className={`absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-zinc-50 dark:from-[#13131A] to-transparent z-10 flex items-center justify-start pointer-events-none transition-opacity duration-150 ${canScrollTrayLeft ? 'opacity-100' : 'opacity-0'}`}>
              <button onClick={() => scrollTray('left')} className={`p-1 rounded-full bg-zinc-200 dark:bg-zinc-800 shadow-md text-zinc-600 dark:text-zinc-400 hover:text-[#EE1D52] transition-all active:scale-95 border ${hasSearchMatchTrayLeft ? 'border-amber-500 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,192,45,0.4)] scale-110' : 'border-zinc-300 dark:border-zinc-700'} ml-1 ${canScrollTrayLeft ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                <ChevronLeft size={14} />
              </button>
            </div>

            <div ref={videoTrayRef} onScroll={checkTrayScroll} className={`flex flex-nowrap items-center gap-4 overflow-x-auto hidden-scrollbar scroll-smooth py-3 px-10 transition-all ${(!canScrollTrayLeft && !canScrollTrayRight) ? 'justify-center' : 'justify-start'}`}>
              {rootVideos.length === 0 ? (
                <div className="text-xs text-zinc-600 italic px-4">No hay videos activos</div>
              ) : (
                rootVideos.map(video => {
                  const isMatch = !!queryToUse && checkVideoMatch(video, queryToUse);
                  return (
                    <button
                      key={video.id}
                      data-is-match={isMatch}
                      data-active-tab={focusedVideoId === video.id}
                      onClick={() => { if (focusedVideoId === video.id) setFocusedVideoId(null); else setFocusedVideoId(video.id); triggerScrollToActive(); }}
                      className={`shrink-0 flex items-center justify-start gap-3 px-4 py-2 rounded-xl border transition-all relative ${focusedVideoId === video.id
                        ? `bg-[#EE1D52] text-white border-[#EE1D52] shadow-lg shadow-[#EE1D52]/20 scale-[1.02] ${isMatch ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-[#13131A] shadow-[0_0_20px_rgba(251,192,45,0.5)]' : ''}`
                        : isMatch
                          ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-100 shadow-[0_0_15px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                          : 'bg-zinc-100 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-[#EE1D52]/40 hover:bg-zinc-200 dark:hover:bg-zinc-800/80 hover:text-[#EE1D52]'
                        }`}
                    >
                      {globalTasks?.some(t => t.id === video.id || t.linked_tiktok_id === video.id) && (
                        <div className="absolute -top-1.5 -right-1.5 z-10">
                          <KanbanSemaphore sourceType="tiktok" sourceId={video.id} sourceTitle={video.title || 'TikTok'} />
                        </div>
                      )}
                      {/* Thumbnail in tray */}
                      <div className="w-6 h-8 rounded-md overflow-hidden bg-zinc-800 border border-zinc-700/50 shrink-0">
                        <ThumbnailImg src={video.thumbnail} className="w-full h-full object-cover" />
                      </div>
                      <div className="max-w-[150px] truncate text-[11px] font-bold">
                        {highlightText(video.title || "Procesando...", queryToUse)}
                      </div>
                      {video.is_pinned && (
                        <span className="flex items-center ml-1">
                          <Pin size={9} className={`fill-current ${focusedVideoId === video.id ? 'text-white' : 'text-[#85858C]'}`} />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-zinc-50 dark:from-[#13131A] to-transparent z-10 flex items-center justify-end pointer-events-none transition-opacity duration-150 ${canScrollTrayRight ? 'opacity-100' : 'opacity-0'}`}>
              <button onClick={() => scrollTray('right')} className={`p-1 rounded-full bg-zinc-200 dark:bg-zinc-800 shadow-md text-zinc-600 dark:text-zinc-400 hover:text-[#EE1D52] transition-all active:scale-95 border ${hasSearchMatchTrayRight ? 'border-amber-500 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,192,45,0.4)] scale-110' : 'border-zinc-300 dark:border-zinc-700'} mr-1 ${canScrollTrayRight ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {focusedVideo ? (() => {
          const isGlobalVideoMatch = queryToUse && checkVideoMatch(focusedVideo, queryToUse);
          const titleMatch = queryToUse && (focusedVideo.title || '').toLowerCase().includes(queryToUse.toLowerCase());

          return (
            <div className={`flex-1 flex flex-col overflow-y-auto w-full px-4 pb-4 ${isVideoTrayOpen && !isZenMode ? 'pt-[2px]' : 'pt-5'}`}>
              <div className={`flex-1 flex flex-col min-h-0 ${isTikTokMaximized ? 'max-w-full' : 'max-w-full md:max-w-6xl mx-auto'} w-full transition-all duration-300 bg-white dark:bg-[#1A1A24] rounded-2xl border overflow-hidden animate-fadeIn ${isGlobalVideoMatch
                ? 'border-amber-500 ring-2 ring-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                : 'shadow-lg border-zinc-200 dark:border-[#2D2D42] focus-within:ring-2 focus-within:ring-[#EE1D52]/50 focus-within:border-[#EE1D52]/50'
                }`}
              >
                {/* ══ HEADER ═════════════════════════════════════════════ */}
                <div className="flex flex-col px-4 pt-4 pb-0 transition-colors min-w-0 shrink-0">

                  {/* ROW 1: TITLE */}
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-3 flex-1 overflow-hidden pl-1 min-w-0">
                      <div className="flex flex-col min-w-0 justify-center w-full">
                        <div className="relative flex w-full">
                          {titleMatch && (
                            <div className="absolute inset-0 w-full pointer-events-none text-lg font-bold p-0 min-h-[1.5em] flex items-center overflow-hidden whitespace-nowrap">
                              <span className="truncate">{highlightText(focusedVideo.title || "", queryToUse)}</span>
                            </div>
                          )}
                          <input
                            type="text"
                            value={focusedVideo.title || ""}
                            onChange={(e) => debouncedUpdateVideo(focusedVideo.id, { title: e.target.value })}
                            placeholder="Sin Título"
                            className={`w-full bg-transparent border-none outline-none text-lg font-bold placeholder:text-zinc-400 p-0 truncate transition-colors ${titleMatch ? 'text-transparent caret-zinc-800 dark:caret-[#CCCCCC]' : 'text-zinc-800 dark:text-zinc-100'}`}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pr-1">
                      {(() => {
                        const currentStatus = videoSaveStatus[focusedVideo.id] || 'idle';
                        return (
                          <div className="mr-0.5 flex items-center justify-center w-6 h-6" title={currentStatus === 'saving' ? 'Sincronizando...' : 'Sincronizado'}>
                            {currentStatus === 'saving' ? (
                              <Loader2 size={13} className="animate-spin text-rose-500" />
                            ) : (
                              <CloudCheck size={13} className={currentStatus === 'saved' ? "text-emerald-500" : "text-zinc-300 dark:text-zinc-600"} />
                            )}
                          </div>
                        );
                      })()}

                      {isInKanban && (
                        <div className="flex-shrink-0 animate-fadeIn">
                          <KanbanSemaphore sourceType="tiktok" sourceId={focusedVideo.id} sourceTitle={focusedVideo.title || 'Análisis TikTok'} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="h-3 shrink-0" />

                  {/* ROW 2: ACTION BUTTONS */}
                  <div className="flex items-center justify-between gap-1.5 flex-wrap pl-1">
                    {/* LEFT GROUP */}
                    <div className="flex items-center gap-1.5">
                      {/* + Subnota */}
                      <button
                        onClick={async () => {
                          const tiktokGroup = groups.find(g => g.title === 'TikTok') || groups[0];
                          if (!tiktokGroup) return;
                          const relIndex = getNewOrderIndex();
                          const newNote = await createSubnote('', tiktokGroup.id, '', relIndex);
                          if (newNote) { setActiveTab(`note_${newNote.id}`); setEditingSubnoteTabId(newNote.id); }
                        }}
                        title="Nueva subnota"
                        className="flex items-center justify-center px-3 h-[32.5px] rounded-lg text-[13px] font-medium border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all active:scale-95"
                      >
                        <ListPlus size={13} className="mr-1.5" />
                        <span>+</span>
                      </button>

                      {/* AI */}
                      <button
                        onClick={() => setShowAIInput(v => !v)}
                        title={showAIInput ? 'Ocultar panel AI' : 'Abrir panel AI'}
                        className={`flex items-center px-3 h-[32.5px] rounded-lg text-[13px] font-medium border transition-all ${showAIInput
                          ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/40 shadow-sm'
                          : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-violet-500/50 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-400'
                          }`}
                      >
                        <Sparkles size={13} />
                      </button>

                      {/* Pizarrón */}
                      <button
                        onClick={() => setIsTikTokPizarronOpen(!isTikTokPizarronOpen)}
                        title={isTikTokPizarronOpen ? 'Ocultar pizarrón' : 'Abrir pizarrón'}
                        className={`flex items-center px-3 h-[32.5px] rounded-lg text-[13px] font-medium border transition-all ${isTikTokPizarronOpen
                          ? 'bg-[#EE1D52]/10 text-[#EE1D52] border-[#EE1D52]/40 shadow-sm'
                          : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-[#EE1D52]/40 hover:bg-[#EE1D52]/5 hover:text-[#EE1D52]'
                          }`}
                      >
                        <PenLine size={13} />
                      </button>

                      {/* Hash */}
                      {showLineNumbers && onToggleLineNumbers && (
                        <button
                          onClick={onToggleLineNumbers}
                          className="flex items-center px-3 h-[32.5px] rounded-lg text-[13px] font-medium border border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 transition-all shadow-sm"
                          title="Ocultar números de línea"
                        >
                          <Hash size={13} />
                        </button>
                      )}

                      {/* Pin (only when pinned) */}
                      {focusedVideo.is_pinned && (
                        <button
                          onClick={() => debouncedUpdateVideo(focusedVideo.id, { is_pinned: false })}
                          className="flex items-center px-3 h-[32.5px] rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 transition-all shadow-sm"
                          title="Desfijar TikTok"
                        >
                          <Pin size={13} className="fill-current" />
                        </button>
                      )}
                    </div>

                    {/* RIGHT GROUP */}
                    <div className="flex items-center gap-1.5">
                      {/* Zen */}
                      <button
                        onClick={() => toggleZenMode('tiktok')}
                        className={`p-2 rounded-xl border transition-all ${isZenMode
                          ? 'bg-[#EE1D52]/10 text-[#EE1D52] border-[#EE1D52]/40 shadow-sm'
                          : 'text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-[#EE1D52]/40 hover:bg-[#EE1D52]/5 hover:text-[#EE1D52]'
                          }`}
                        title={isZenMode ? "Salir de Modo Zen" : "Entrar a Modo Zen"}
                      >
                        <Wind size={13} />
                      </button>

                      {/* Maximize */}
                      <button
                        onClick={() => setIsTikTokMaximized(!isTikTokMaximized)}
                        className={`hidden md:flex p-2 rounded-xl border transition-all ${isTikTokMaximized
                          ? 'bg-[#EE1D52]/10 text-[#EE1D52] border-[#EE1D52]/40 shadow-sm'
                          : 'text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-[#EE1D52]/40 hover:bg-[#EE1D52]/5 hover:text-[#EE1D52]'
                          }`}
                        title={isTikTokMaximized ? "Minimizar" : "Maximizar"}
                      >
                        {isTikTokMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                      </button>

                      {/* More menu */}
                      <div className="relative shrink-0 flex items-center" ref={moreMenuRef}>
                        <button
                          onClick={() => setShowMoreMenu(!showMoreMenu)}
                          className={`p-2 rounded-xl border transition-all ${showMoreMenu
                            ? 'bg-[#4940D9] border-[#4940D9]/80 text-white font-bold shadow-lg shadow-[#4940D9]/20'
                            : 'text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400/60 dark:hover:border-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700/60 hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                          title="Más opciones"
                        >
                          <MoreVertical size={13} />
                        </button>

                        {showMoreMenu && (
                          <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-[#1A1A24] shadow-xl rounded-lg border border-zinc-200 dark:border-[#2D2D42] p-1 flex flex-col gap-0.5 min-w-[210px] animate-fadeIn">
                            {onToggleLineNumbers && (
                              <>
                                <button onClick={() => { onToggleLineNumbers(); setShowMoreMenu(false); }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${showLineNumbers ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42]"}`}>
                                  <Hash size={14} /> {showLineNumbers ? "Ocultar números" : "Mostrar números"}
                                </button>
                              </>
                            )}
                            <button onClick={() => { debouncedUpdateVideo(focusedVideo.id, { is_pinned: !focusedVideo.is_pinned }); setShowMoreMenu(false); }} className={`flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md transition-colors ${focusedVideo.is_pinned ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42]'}`}>
                              <Pin size={14} className={focusedVideo.is_pinned ? "fill-current" : ""} /> {focusedVideo.is_pinned ? 'Desfijar TikTok' : 'Fijar TikTok'}
                            </button>
                            <div className="border-t border-zinc-100 dark:border-[#2D2D42] my-0.5" />

                            <button onClick={() => { handleConvertToNote(); setShowMoreMenu(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-colors font-bold">
                              <ArrowUpRight size={14} /> Convertir a Nota
                            </button>
                            {!isInKanban && (
                              <button onClick={handleAddToKanban} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42] transition-colors">
                                <CheckSquare size={14} /> Añadir a Kanban
                              </button>
                            )}

                            <button onClick={async () => {
                              if (!focusedVideo) return;
                              const getAllTreeIds = (id: string): string[] => { const kids = tikTokVideos.filter(v => v.parent_id === id); return [id, ...kids.flatMap(k => getAllTreeIds(k.id))]; };
                              const treeIds = getAllTreeIds(focusedVideo.id);
                              const { data: treeSummaries } = await supabase.from('summaries').select('*').in('tiktok_video_id', treeIds);
                              const clean = (t: string) => (t || '').replace(/\[\d+\]/g, '').replace(/<[^>]+>/g, '');
                              const getRecursiveContent = (videoId: string, depth: number): string => {
                                const video = tikTokVideos.find(v => v.id === videoId);
                                if (!video) return "";
                                let md = `${"#".repeat(depth)} 🎬 ${video.title || 'TikTok Sin Título'}\n\n- **URL:** ${video.url}\n- **Autor:** ${video.author || 'Anónimo'}\n\n`;
                                if (video.transcript) md += `${"#".repeat(depth + 1)} Transcripción\n\n${clean(video.transcript)}\n\n`;
                                if (video.content) md += `${"#".repeat(depth + 1)} Análisis\n\n${clean(video.content)}\n\n`;
                                if (video.scratchpad) md += `${"#".repeat(depth + 1)} Pizarrón\n\n${clean(video.scratchpad)}\n\n`;
                                const vSums = (treeSummaries || []).filter(s => s.tiktok_video_id === videoId);
                                if (vSums.length > 0) {
                                  md += `${"#".repeat(depth + 1)} Análisis AI (${vSums.length})\n\n`;
                                  for (const s of vSums) { md += `${"#".repeat(depth + 2)} ${s.target_objective || 'General'}\n\n${clean(s.content)}\n\n`; }
                                }
                                const kids = tikTokVideos.filter(v => v.parent_id === videoId);
                                for (const kid of kids) { md += "\n---\n\n" + getRecursiveContent(kid.id, depth + 1); }
                                return md;
                              };
                              const fullMarkdown = getRecursiveContent(focusedVideo.id, 1);
                              const element = document.createElement("a");
                              const file = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8;' });
                              element.href = URL.createObjectURL(file);
                              element.download = `${(focusedVideo.title || 'analisis_tiktok').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
                              document.body.appendChild(element); element.click(); document.body.removeChild(element);
                              setShowMoreMenu(false);
                            }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#2D2D42] transition-colors font-bold">
                              <Download size={14} /> Exportar (.md)
                            </button>

                            <div className="border-t border-zinc-100 dark:border-[#2D2D42] my-0.5" />
                            <button onClick={() => { archiveVideo(focusedVideo.id); setShowMoreMenu(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors font-bold">
                              <Archive size={14} /> Archivar TikTok
                            </button>
                            <button onClick={() => { deleteVideo(focusedVideo.id, focusedVideo.url); setShowMoreMenu(false); }} className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-bold">
                              <Trash2 size={14} /> Eliminar Permanentemente
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="h-[5px]" />

                  {/* ROW 3: TAB BAR */}
                  <div className="relative group/tabbar shrink-0">
                    {/* Arrow Left */}
                    <div className={`absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white dark:from-[#1A1A24] to-transparent z-10 flex items-center justify-start pointer-events-none transition-opacity duration-150 ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`}>
                      <button onClick={() => scrollTabs('left')} className={`p-1 rounded-full bg-white dark:bg-zinc-800 shadow-md text-zinc-400 hover:text-[#EE1D52] transition-all active:scale-95 border ${hasSearchMatchLeft ? 'border-amber-500 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,192,45,0.4)] scale-110' : 'border-zinc-200 dark:border-zinc-700'} ml-1 ${canScrollLeft ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                        <ChevronLeft size={14} />
                      </button>
                    </div>

                    <div ref={tabBarRef} onScroll={checkScroll} className={`flex items-center gap-1.5 overflow-x-auto pt-2 pb-1 shrink-0 min-w-0 hidden-scrollbar px-10 transition-all ${(!canScrollLeft && !canScrollRight) ? 'justify-center' : 'justify-start'}`}>

                      {/* Tab Original (TikTok red, solo icono) */}
                      {(() => {
                        const isOriginalMatch = Boolean(queryToUse && (
                          (focusedVideo.title || '').toLowerCase().includes(queryToUse.toLowerCase()) ||
                          (focusedVideo.transcript || '').toLowerCase().includes(queryToUse.toLowerCase()) ||
                          (focusedVideo.scratchpad || '').toLowerCase().includes(queryToUse.toLowerCase())
                        ));
                        return (
                          <button
                            onClick={() => { setActiveTab('original'); triggerScrollToActive(); }}
                            data-active-tab={activeTab === 'original' || undefined}
                            data-is-match={isOriginalMatch}
                            className={`relative flex items-center justify-center gap-1.5 px-4 h-[32.5px] rounded-xl text-[13px] font-medium whitespace-nowrap border shrink-0 transition-all active:scale-95 ${activeTab === 'original'
                              ? `bg-[#EE1D52]/10 text-[#EE1D52] border-[#EE1D52]/40 shadow-sm ${isOriginalMatch ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-[#1A1A24] shadow-[0_0_15px_rgba(251,192,45,0.4)]' : ''}`
                              : isOriginalMatch
                                ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-100 shadow-[0_0_8px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                                : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-[#EE1D52]/40 hover:bg-[#EE1D52]/5 hover:text-[#EE1D52] transition-all'
                              }`}
                          >
                            {globalTasks?.some(t => t.id === focusedVideoId || t.linked_tiktok_id === focusedVideoId) && (
                              <div className="absolute -top-1.5 -right-1.5 z-10">
                                <KanbanSemaphore sourceType="tiktok" sourceId={focusedVideoId!} sourceTitle="Video Original" />
                              </div>
                            )}
                            <FileText size={12} className={activeTab === 'original' ? 'text-[#EE1D52] shrink-0' : 'shrink-0'} />
                          </button>
                        );
                      })()}

                      {/* Unified tabs */}
                      {unifiedTabs.map(tab => {
                        if (tab.type === 'summary') {
                          const summary = tab.data;
                          const isProcessing = summary.status === 'pending' || summary.status === 'processing';
                          const isMatch = !isProcessing && Boolean(queryToUse && (() => {
                            const q = queryToUse.toLowerCase();
                            if ((summary.target_objective || '').toLowerCase().includes(q) || (summary.content || '').toLowerCase().includes(q) || (summary.scratchpad || '').toLowerCase().includes(q)) return true;
                            if (summary.brain_dump_id) { const d = brainDumps.find(d => d.id === summary.brain_dump_id); if (d && checkDumpTreeMatch(d, q)) return true; }
                            return false;
                          })());
                          const isActive = activeTab === `summary_${summary.id}`;

                          if (isProcessing) {
                            return (
                              <div key={summary.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border shrink-0 max-w-[150px] bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-400 animate-pulse">
                                <Loader2 size={10} className="animate-spin shrink-0" />
                                <span className="truncate">{summary.target_objective || 'Analizando...'}</span>
                              </div>
                            );
                          }

                          return (
                            <button
                              key={summary.id}
                              onClick={() => setActiveTab(activeTab === `summary_${summary.id}` ? 'original' : `summary_${summary.id}`)}
                              data-active-tab={isActive || undefined}
                              data-is-match={isMatch}
                              className={`flex items-center ${editingSummaryTabId === summary.id ? 'gap-0' : 'gap-1.5'} px-3 h-[32.5px] rounded-xl text-[13px] font-medium whitespace-nowrap border shrink-0 transition-all active:scale-95 max-w-[320px] ${isActive
                                ? `bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/40 shadow-sm ${isMatch ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-[#1A1A24] shadow-[0_0_15px_rgba(251,192,45,0.4)]' : ''}`
                                : isMatch
                                  ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-100 shadow-[0_0_8px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                                  : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-violet-500/50 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-400 transition-all'
                                }`}
                            >
                              {editingSummaryTabId !== summary.id && <Sparkles size={10} className="shrink-0" />}
                              <span className="truncate">
                                <SummaryTitle
                                  summary={summary}
                                  isActive={isActive}
                                  searchQuery={queryToUse}
                                  onRename={(id, obj) => updateSummaryMetadata(id, { target_objective: obj })}
                                  isEditing={editingSummaryTabId === summary.id}
                                  setIsEditing={(val) => setEditingSummaryTabId(val ? summary.id : null)}
                                />
                              </span>
                              {isActive && editingSummaryTabId !== summary.id && (
                                <span
                                  onClick={(e) => { e.stopPropagation(); deleteSummary(summary.id); setActiveTab('original'); }}
                                  className="ml-1 p-1 rounded-lg border border-transparent hover:border-white/20 hover:bg-black/20 transition-all text-white/70 hover:text-white active:scale-90"
                                  title="Borrar análisis"
                                >
                                  <Trash2 size={10} />
                                </span>
                              )}
                            </button>
                          );
                        } else {
                          const note = tab.data;
                          const isMatch = Boolean(queryToUse && (() => {
                            const q = queryToUse.toLowerCase();
                            const checkNoteDeepMatch = (n: any): boolean => {
                              if ((n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q) || (n.scratchpad || '').toLowerCase().includes(q)) return true;
                              const nSums = allSummaries.filter(s => s.note_id === n.id);
                              if (nSums.some(s => (s.target_objective || '').toLowerCase().includes(q) || (s.content || '').toLowerCase().includes(q) || (s.scratchpad || '').toLowerCase().includes(q))) return true;
                              const kids = subnotes.filter(child => child.parent_note_id === n.id);
                              return kids.some(checkNoteDeepMatch);
                            };
                            return checkNoteDeepMatch(note);
                          })());
                          const isActive = activeTab === `note_${note.id}`;

                          return (
                            <button
                              key={note.id}
                              onClick={() => setActiveTab(`note_${note.id}`)}
                              data-active-tab={isActive || undefined}
                              data-is-match={isMatch}
                              className={`flex items-center ${editingSubnoteTabId === note.id ? 'gap-0' : 'gap-1.5'} px-3 h-[32.5px] rounded-xl text-[13px] font-medium whitespace-nowrap border transition-all active:scale-95 max-w-[320px] ${isActive
                                ? `bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 shadow-sm ${isMatch ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-[#1A1A24] shadow-[0_0_15px_rgba(251,192,45,0.4)]' : ''}`
                                : isMatch
                                  ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-100 shadow-[0_0_8px_rgba(251,192,45,0.4)] ring-1 ring-amber-500/50'
                                  : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all'
                                }`}
                            >
                              {editingSubnoteTabId !== note.id && <StickyNote size={10} className="shrink-0" />}
                              <SubnoteTabTitle
                                note={note}
                                isActive={isActive}
                                searchQuery={queryToUse}
                                isEditing={editingSubnoteTabId === note.id}
                                setIsEditing={(val) => setEditingSubnoteTabId(val ? note.id : null)}
                                onRename={(id, title) => updateSubnote(id, { title })}
                              />
                              {isActive && editingSubnoteTabId !== note.id && (
                                <span
                                  onClick={(e) => { e.stopPropagation(); deleteSubnote(note.id); setActiveTab('original'); }}
                                  className="ml-1 p-1 rounded-lg border border-transparent hover:border-white/20 hover:bg-black/20 transition-all text-white/70 hover:text-white active:scale-90"
                                  title="Borrar subnota"
                                >
                                  <Trash2 size={10} />
                                </span>
                              )}
                            </button>
                          );
                        }
                      })}
                    </div>

                    {/* Arrow Right */}
                    <div className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white dark:from-[#1A1A24] to-transparent z-10 flex items-center justify-end pointer-events-none transition-opacity duration-150 ${canScrollRight ? 'opacity-100' : 'opacity-0'}`}>
                      <button onClick={() => scrollTabs('right')} className={`p-1 rounded-full bg-white dark:bg-zinc-800 shadow-md text-zinc-400 hover:text-[#EE1D52] transition-all active:scale-95 border ${hasSearchMatchRight ? 'border-amber-500 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,192,45,0.4)] scale-110' : 'border-zinc-200 dark:border-zinc-700'} mr-1 ${canScrollRight ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* ══ SPACER ════════════════════════════════════════════════ */}
                <div className="h-5 shrink-0" />

                {/* ══ CONTENT ═══════════════════════════════════════════════ */}
                <div className="px-[5px] pb-[5px] pt-0 w-full flex-1 flex flex-col min-h-0 gap-[10px]">

                  {/* AI Input Panel */}
                  {showAIInput && (
                    <div className="shrink-0 mb-2">
                      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 dark:bg-[#1A1A2E]/60 p-3 animate-fadeIn">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-violet-400 flex items-center gap-1.5">
                            <Sparkles size={11} /> Consultar con IA
                          </span>
                          <button onClick={() => setShowAIInput(false)} className="text-zinc-400 hover:text-zinc-300 p-0.5">
                            <X size={13} />
                          </button>
                        </div>
                        <TikTokAIPanel
                          videoId={focusedVideo.id}
                          onGenerate={async (obj) => {
                            setShowAIInput(false);
                            const orderIndex = getNewOrderIndex();
                            let activeContent = '';
                            let activeLabel = '';
                            if (activeTab === 'original') {
                              activeContent = focusedVideo.transcript || '';
                              activeLabel = 'Transcripción principal';
                            } else if (activeTab.startsWith('summary_')) {
                              const s = aiSummaries.find(sm => sm.id === activeTab.replace('summary_', ''));
                              activeContent = s?.content || '';
                              activeLabel = `Resumen: ${s?.target_objective || 'IA'}`;
                            } else if (activeTab.startsWith('note_')) {
                              const n = subnotes.find(nt => nt.id === activeTab.replace('note_', ''));
                              activeContent = n?.content || '';
                              activeLabel = `Subnota: ${n?.title || 'Usuario'}`;
                            }
                            const fullContext = {
                              title: focusedVideo.title || '',
                              author: focusedVideo.author || '',
                              activeLabel,
                              activeContent,
                              transcript: focusedVideo.transcript || '',
                              subnotes: subnotes.map(n => ({ title: n.title || '', content: n.content || '', scratchpad: n.scratchpad || '' })),
                              existingSummaries: aiSummaries.map(s => ({ objective: s.target_objective || '', content: s.content || '' })),
                              orderIndex
                            };
                            const newSumm = await generateSummary(obj, fullContext);
                            if (newSumm) setActiveTab(`summary_${newSumm.id}`);
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Editor + Pizarrón split */}
                  <div
                    ref={splitContainerRef}
                    onFocusCapture={triggerScrollToActive}
                    onClickCapture={triggerScrollToActive}
                    className={`flex-1 flex min-h-0 ${layoutCol ? 'flex-col' : 'flex-row'} gap-2 animate-fadeIn`}
                  >
                    {/* Main editor panel */}
                    <div
                      className={`min-h-0 overflow-hidden flex flex-col rounded-xl border bg-zinc-50 dark:bg-[#131314] ${activeTab === 'original'
                        ? 'border-[#EE1D52]/20 dark:border-[#EE1D52]/20 focus-within:border-[#EE1D52]/50 dark:focus-within:border-[#EE1D52]/40'
                        : activeTab.startsWith('summary_')
                          ? 'border-violet-200 dark:border-violet-500/30 focus-within:border-violet-400 dark:focus-within:border-violet-500/60'
                          : 'border-emerald-200 dark:border-emerald-900/30 focus-within:border-emerald-400 dark:focus-within:border-emerald-500/60'
                        } transition-colors`}
                      style={isTikTokPizarronOpen
                        ? (layoutCol ? { height: `${splitRatio * 100}%`, flex: 'none' } : { width: `${splitRatio * 100}%`, flex: 'none' })
                        : { flex: 1 }
                      }
                    >
                      {/* Metadata header — replaces dates with video info */}
                      <div className="flex items-center justify-center gap-6 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#1A1A24] shrink-0 flex-wrap">
                        {activeTab === 'original' && (
                          <>
                            <a href={focusedVideo.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-tighter text-[#EE1D52]/80 hover:text-[#EE1D52] transition-colors opacity-80 hover:opacity-100">
                              <ExternalLink size={10} /> Ver en TikTok
                            </a>
                            <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-800" />
                            <div className="flex items-center gap-1.5 opacity-60">
                              <User size={10} className="text-zinc-500" />
                              <span className="text-[9px] font-bold uppercase tracking-tighter text-zinc-500">{focusedVideo.author || 'Anónimo'}</span>
                            </div>
                            <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-800" />
                            <div className="flex items-center gap-1.5 opacity-60">
                              <Clock size={10} className="text-zinc-500" />
                              <span className="text-[9px] font-bold uppercase tracking-tighter text-zinc-500">{formatDuration(focusedVideo.duration)}</span>
                            </div>
                          </>
                        )}
                        {activeTab.startsWith('summary_') && (() => {
                          const summary = aiSummaries.find(s => `summary_${s.id}` === activeTab);
                          return summary ? (
                            <>
                              <div className="flex items-center gap-1.5 opacity-60">
                                <Sparkles size={10} className="text-violet-400" />
                                <span className="text-[9px] font-bold uppercase tracking-tighter text-zinc-500 truncate max-w-[200px]">{summary.target_objective || 'Análisis AI'}</span>
                              </div>
                              <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-800" />
                              <div className="flex items-center gap-1.5 opacity-60">
                                <Clock size={10} className="text-zinc-500" />
                                <span className="text-[9px] font-bold uppercase tracking-tighter text-zinc-500">{new Date(summary.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </>
                          ) : null;
                        })()}
                        {activeTab.startsWith('note_') && (() => {
                          const note = subnotes.find(n => `note_${n.id}` === activeTab);
                          return note ? (
                            <>
                              <div className="flex items-center gap-1.5 opacity-60">
                                <Clock size={11} className="text-zinc-500" />
                                <span className="text-[9px] font-bold uppercase tracking-tighter text-zinc-500">Creación:</span>
                                <span className="text-[9px] font-medium text-zinc-500">{new Date(note.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              {note.updated_at && (
                                <>
                                  <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-800" />
                                  <div className="flex items-center gap-1.5 opacity-60">
                                    <History size={11} className="text-zinc-500" />
                                    <span className="text-[9px] font-bold uppercase tracking-tighter text-zinc-500">Edición:</span>
                                    <span className="text-[9px] font-medium text-zinc-500">{new Date(note.updated_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                </>
                              )}
                            </>
                          ) : null;
                        })()}
                      </div>

                      {/* Editor */}
                      <div
                        className={`${showLineNumbers ? 'pt-8 pr-6 pb-[5px] pl-[7px]' : 'px-8 py-6'} h-full overflow-y-auto cursor-text note-editor-scroll`}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('.cm-panel, .cm-search')) return;
                          editorRef.current?.focus();
                        }}
                      >
                        {activeTab === 'original' && (
                          <SmartNotesEditor
                            ref={editorRef}
                            noteId={focusedVideo.id}
                            initialContent={focusedVideo.transcript || ""}
                            onChange={(c) => debouncedUpdateVideo(focusedVideo.id, { transcript: c })}
                            searchQuery={searchQuery}
                            showLineNumbers={showLineNumbers}
                          />
                        )}
                        {activeTab.startsWith('summary_') && (() => {
                          const summary = aiSummaries.find(s => `summary_${s.id}` === activeTab);
                          return summary ? (
                            <SmartNotesEditor
                              key={summary.id}
                              noteId={summary.id}
                              initialContent={summary.content || ""}
                              onChange={(c) => updateSummaryContent(summary.id, c)}
                              searchQuery={searchQuery}
                              showLineNumbers={showLineNumbers}
                            />
                          ) : null;
                        })()}
                        {activeTab.startsWith('note_') && (() => {
                          const note = subnotes.find(n => `note_${n.id}` === activeTab);
                          return note ? (
                            <SmartNotesEditor
                              key={note.id}
                              noteId={note.id}
                              initialContent={note.content || ""}
                              onChange={(c) => updateSubnote(note.id, { content: c })}
                              searchQuery={searchQuery}
                              showLineNumbers={showLineNumbers}
                            />
                          ) : null;
                        })()}
                      </div>
                    </div>

                    {/* Divider */}
                    {isTikTokPizarronOpen && (
                      <div
                        onMouseDown={handleDividerMouseDown}
                        className={`shrink-0 flex items-center justify-center rounded-full select-none hover:bg-[#EE1D52]/20 transition-colors ${layoutCol ? 'h-2 w-full cursor-row-resize' : 'w-2 h-full cursor-col-resize'}`}
                        title="Arrastrar para redimensionar"
                      >
                        <div className={`rounded-full bg-[#EE1D52]/30 ${layoutCol ? 'h-1 w-8' : 'w-1 h-8'}`} />
                      </div>
                    )}

                    {/* Pizarrón */}
                    {isTikTokPizarronOpen && (
                      <div
                        className="min-h-0 overflow-hidden flex flex-col rounded-xl border border-[#EE1D52]/20 dark:border-[#EE1D52]/15 focus-within:border-[#EE1D52]/50 dark:focus-within:border-[#EE1D52]/40 bg-white dark:bg-[#1A1A24] animate-fadeIn transition-colors"
                        style={{ flex: 1 }}
                      >
                        <div className="relative flex items-center justify-center gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#1A1A24] shrink-0">
                          <div className="flex items-center gap-2">
                            <PenLine size={11} className="text-[#EE1D52]/70" />
                            <span className="text-[10px] font-bold text-[#EE1D52]/70 uppercase tracking-widest">Pizarrón</span>
                          </div>
                          <div className="absolute right-2 flex items-center">
                            <button
                              onClick={() => {
                                const cur = useUIStore.getState().forcedPizarronOrientation;
                                const next = cur === 'vertical' ? 'horizontal' : 'vertical';
                                useUIStore.getState().setForcedPizarronOrientation(next);
                              }}
                              title={useUIStore.getState().forcedPizarronOrientation === 'horizontal' ? "Cambiar a Vertical" : "Cambiar a Horizontal"}
                              className="p-1 hover:bg-[#EE1D52]/10 rounded-lg text-[#EE1D52]/60 transition-colors"
                            >
                              {useUIStore.getState().forcedPizarronOrientation === 'horizontal' ? <Columns size={12} /> : <Rows size={12} />}
                            </button>
                          </div>
                        </div>
                        <div
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('.cm-panel, .cm-search')) return;
                            scratchRef.current?.focus();
                          }}
                          className={`flex-1 ${showLineNumbers ? 'pt-8 pr-6 pb-[5px] pl-[7px]' : 'px-8 py-6'} overflow-y-auto cursor-text note-editor-scroll`}
                        >
                          {activeTab === 'original' && (
                            <SmartNotesEditor
                              ref={scratchRef}
                              noteId={`scratch_${focusedVideo.id}`}
                              initialContent={focusedVideo.scratchpad || ""}
                              onChange={(c) => debouncedUpdateVideo(focusedVideo.id, { scratchpad: c })}
                              searchQuery={searchQuery}
                              showLineNumbers={showLineNumbers}
                            />
                          )}
                          {activeTab.startsWith('summary_') && (() => {
                            const summaryId = activeTab.replace('summary_', '');
                            const summary = aiSummaries.find(s => s.id === summaryId);
                            return summary ? (
                              <SmartNotesEditor
                                key={`scratch_${summary.id}`}
                                noteId={`scratch_summary_${summary.id}`}
                                initialContent={summary.scratchpad || ""}
                                onChange={(c) => updateSummaryScratchpad(summary.id, c)}
                                searchQuery={searchQuery}
                                showLineNumbers={showLineNumbers}
                              />
                            ) : null;
                          })()}
                          {activeTab.startsWith('note_') && (() => {
                            const noteId = activeTab.replace('note_', '');
                            const note = subnotes.find(n => n.id === noteId);
                            return note ? (
                              <SmartNotesEditor
                                key={`scratch_${note.id}`}
                                noteId={`scratch_note_${note.id}`}
                                initialContent={note.scratchpad || ""}
                                onChange={(c) => updateSubnote(note.id, { scratchpad: c })}
                                searchQuery={searchQuery}
                                showLineNumbers={showLineNumbers}
                              />
                            ) : null;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })() : (
          /* ── GRID / WELCOME ─────────────────────────────────────────────── */
          <div className={`flex-1 overflow-y-auto hidden-scrollbar scroll-smooth animate-fadeIn ${!isZenMode && isVideoTrayOpen ? 'pt-[2px]' : 'pt-5'}`}>
            <div className={`${isTikTokMaximized ? 'max-w-full' : 'max-w-full md:max-w-6xl'} mx-auto space-y-5 pb-20 px-4 md:px-10`}>
              {rootVideos.length > 0 ? (
                <div className={`grid ${isTikTokMaximized ? 'grid-cols-[repeat(auto-fit,340px)] w-full max-w-[2160px]' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl'} gap-6 justify-center mx-auto`}>
                  {rootVideos.map(video => {
                    const isMatch = !!queryToUse && checkVideoMatch(video, queryToUse);
                    return (
                      <div
                        key={video.id}
                        onClick={() => setFocusedVideoId(video.id)}
                        className={`group bg-white dark:bg-[#1A1A24] border rounded-2xl p-5 hover:shadow-xl transition-all cursor-pointer flex flex-col gap-3 relative animate-fadeIn ${isMatch ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-zinc-200 dark:border-[#2D2D42] hover:border-[#EE1D52]/40'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-zinc-800 dark:text-[#CCCCCC] truncate flex-1 text-sm">
                            {highlightText(video.title || "Procesando...", queryToUse)}
                          </h3>
                          <div className={`${globalTasks?.some(t => t.id === video.id || t.linked_tiktok_id === video.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                            <KanbanSemaphore sourceType="tiktok" sourceId={video.id} sourceTitle={video.title || 'TikTok'} onInteract={() => setFocusedVideoId(video.id)} />
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <div className="w-16 h-20 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 shadow-md">
                            <ThumbnailImg src={video.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <p className="text-[10px] font-medium text-zinc-500 mt-0.5 flex items-center gap-1">
                              <User size={10} /> {video.author || "Anónimo"}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[10px] font-black text-white px-1.5 py-0.5 bg-[#EE1D52] rounded flex items-center gap-1">
                                <Clock size={10} /> {formatDuration(video.duration)}
                              </span>
                              <span className="text-[9px] font-bold text-zinc-400 flex items-center gap-1 uppercase tracking-tighter">
                                <Calendar size={10} /> {new Date(video.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-zinc-50 dark:border-zinc-800/50 mt-auto">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-zinc-400 capitalize">{video.author ? 'Creador' : 'Video'}</span>
                            <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                            <span className="text-[10px] font-black text-[#EE1D52]/60 uppercase tracking-tighter italic">AI READY</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); updateVideo(video.id, { is_pinned: !video.is_pinned }); }}
                              className={`p-1.5 rounded-lg transition-all active:scale-95 hover:bg-amber-50 dark:hover:bg-amber-900/20 ${video.is_pinned ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400 hover:text-amber-600'}`}
                              title={video.is_pinned ? 'Quitar fijado' : 'Fijar TikTok'}
                            >
                              <Pin size={14} className={video.is_pinned ? 'fill-current' : ''} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); archiveVideo(video.id); }}
                              className="p-1 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                              title="Archivar"
                            >
                              <Archive size={14} />
                            </button>
                            <div className="w-6 h-6 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-400 group-hover:bg-[#EE1D52] group-hover:text-white transition-all">
                              <ChevronRight size={14} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="max-w-4xl mx-auto px-6 h-full flex flex-col items-center justify-center text-center space-y-8 py-20">
                  <div className="w-32 h-32 rounded-full bg-zinc-900/10 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[#EE1D52]/5 group-hover:bg-[#EE1D52]/10 transition-colors"></div>
                    <Brain size={56} className="text-zinc-600 dark:text-zinc-400 relative z-10" />
                  </div>
                  <div className="space-y-2 max-w-sm">
                    <h2 className="text-xl font-black text-zinc-800 dark:text-white uppercase tracking-tight">Cerebro TikTok</h2>
                    <p className="text-sm text-zinc-500 font-medium">Extrae conocimiento de cualquier video. Usa el botón "Nuevo" para empezar.</p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-6 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-2xl text-xs font-bold transition-all"
                  >
                    Agregar Nuevo Video
                  </button>
                </div>
              )}

              {/* Archive */}
              {archivedVideos.length > 0 && (
                <div className={`mt-5 space-y-4 animate-fadeIn ${isArchiveOpenByApp['tiktok'] ? 'pb-20' : 'pb-10'}`}>
                  <button
                    onClick={() => setArchiveOpenByApp('tiktok', !isArchiveOpenByApp['tiktok'])}
                    className="flex items-center gap-3 text-zinc-400 font-bold uppercase tracking-widest text-xs px-2 hover:text-[#EE1D52] transition-colors group/archheader"
                  >
                    <Archive size={16} className="text-zinc-500/50 group-hover/archheader:text-[#EE1D52]/50 transition-colors" />
                    <span>Archivo ({archivedVideos.length})</span>
                    <ChevronDown size={14} className={`transition-transform duration-300 ${isArchiveOpenByApp['tiktok'] ? '' : '-rotate-90'}`} />
                  </button>

                  {isArchiveOpenByApp['tiktok'] && (
                    <div className={`grid ${isTikTokMaximized ? 'grid-cols-[repeat(auto-fit,340px)] w-full max-w-[2160px]' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl'} gap-4 justify-center mx-auto pb-20`}>
                      {archivedVideos.map(video => (
                        <div key={video.id} className="p-4 bg-white dark:bg-[#1A1A24]/50 border border-zinc-200 dark:border-[#2D2D42] rounded-2xl flex items-center justify-between group hover:border-[#EE1D52]/30 transition-all">
                          <div className="flex items-center gap-4 truncate">
                            <div className="w-8 h-10 rounded bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0 opacity-60">
                              <ThumbnailImg src={video.thumbnail} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col truncate">
                              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 truncate">{video.title || "Sin Título"}</span>
                              <span className="text-[10px] text-zinc-500 font-medium">{video.author} • {formatDuration(video.duration)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => restoreVideo(video.id)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-[#EE1D52] rounded-xl transition-all" title="Restaurar"><RotateCcw size={16} /></button>
                            <button onClick={() => deleteVideo(video.id, video.url)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-red-500 rounded-xl transition-all" title="Eliminar permanentemente"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <NewTikTokModal
          onClose={() => setIsModalOpen(false)}
          queue={tikTokQueueItems}
          onAdd={handleAddUrls}
          isAdding={isAdding}
        />
      )}

      {isLinkModalOpen && focusedVideo && (
        <TikTokLinkerModal
          video={focusedVideo}
          groups={groups}
          onClose={() => setIsLinkModalOpen(false)}
          onSuccess={() => { setIsLinkModalOpen(false); }}
        />
      )}
    </div>
  );
};
