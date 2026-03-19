import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Play, 
  Check, 
  X, 
  Search, 
  ExternalLink, 
  Plus, 
  Maximize2, 
  Minimize2, 
  Bell, 
  ChevronDown, 
  ChevronUp,
  Clock,
  User,
  Heart,
  Eye,
  Type,
  Share2,
  ChevronRight,
  PanelLeft,
  Settings,
  MoreVertical,
  Trash2,
  Archive,
  Download,
  Sparkles,
  FileText,
  Quote,
  StickyNote,
  ChevronsDownUp,
  ArrowUpDown,
  Calendar,
  Wind,
  PlusCircle,
  History,
  AlertCircle,
  ChevronLeft,
  PenLine,
  Brain,
  GitBranch,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient';
import { useUIStore } from '../src/lib/store';
import { Session } from '@supabase/supabase-js';
import { TikTokVideo, TikTokQueueItem } from '../types';
import { KanbanSemaphore } from './KanbanSemaphore';
import { TikTokAIPanel } from './TikTokAIPanel';
import { SmartNotesEditor, SmartNotesEditorRef } from '../src/components/editor/SmartNotesEditor';
import { useTikTokSummaries } from '../src/lib/useTikTokSummaries';
import { useTikTokSubnotes } from '../src/lib/useTikTokSubnotes';

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

// --- SUB-COMPONENTS ---

const NewTikTokModal: React.FC<{ 
  onClose: () => void; 
  queue: TikTokQueueItem[]; 
  onAdd: (urls: string) => void;
  isAdding: boolean;
}> = ({ onClose, queue, onAdd, isAdding }) => {
  const [urlInput, setUrlInput] = useState("");
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-[#1A1A24] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
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
          {/* Input Area */}
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

          {/* Log Area */}
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
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                      item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                      item.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                      item.status === 'processing' ? 'bg-amber-500/10 text-amber-500 animate-pulse' :
                      'bg-zinc-500/10 text-zinc-400'
                    }`}>
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

export const TikTokApp: React.FC<{ session: Session }> = ({ session }) => {
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
    groups, activeGroupId
  } = useUIStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [sortMode, setSortMode] = useState<'date-desc' | 'date-asc' | 'created-desc' | 'created-asc' | 'alpha-asc' | 'alpha-desc'>(() => {
    return (localStorage.getItem('tiktokSortMode') as any) || 'date-desc';
  });
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [showAIInput, setShowAIInput] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const editorRef = useRef<SmartNotesEditorRef>(null);
  const scratchRef = useRef<SmartNotesEditorRef>(null);

  const isZenMode = !!isZenModeByApp['tiktok'];
  const focusedVideo = useMemo(() => tikTokVideos.find(v => v.id === focusedVideoId), [tikTokVideos, focusedVideoId]);
  
  const { 
    summaries: aiSummaries, 
    generateSummary, 
    deleteSummary, 
    updateScratchpad: updateSummaryScratchpad, 
    updateSummaryMetadata,
    updateSummaryContent 
  } = useTikTokSummaries(focusedVideoId);

  const {
    subnotes,
    createSubnote,
    deleteSubnote,
    updateSubnote
  } = useTikTokSubnotes(focusedVideoId);

  const activeTab = focusedVideoId ? (activeTabByVideo[focusedVideoId] || 'original') : 'original';
  const setActiveTab = (tabId: string) => { if (focusedVideoId) setActiveTabByVideo(focusedVideoId, tabId); };

  // Hierarchy support
  const rootVideos = useMemo(() => {
    let result = tikTokVideos.filter(v => !v.parent_id && v.status !== 'archived');
    if (searchQuery.trim()) {
      result = result.filter(v => 
        v.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.author?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    // Sorting
    return result.sort((a, b) => {
      switch (sortMode) {
        case 'date-desc': {
          const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
          const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
          return dateB - dateA;
        }
        case 'date-asc': {
          const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
          const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
          return dateA - dateB;
        }
        case 'created-desc': {
          const dateB = new Date(b.created_at || 0).getTime();
          const dateA = new Date(a.created_at || 0).getTime();
          return dateB - dateA;
        }
        case 'created-asc': {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateA - dateB;
        }
        case 'alpha-asc': return (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
        case 'alpha-desc': return (b.title || '').toLowerCase().localeCompare((a.title || '').toLowerCase());
        default: return 0;
      }
    });
  }, [tikTokVideos, searchQuery, sortMode]);

  const archivedVideos = useMemo(() => {
    return tikTokVideos.filter(v => v.status === 'archived');
  }, [tikTokVideos]);

  const subVideos = useMemo(() => {
    if (!focusedVideoId) return [];
    return tikTokVideos.filter(v => v.parent_id === focusedVideoId);
  }, [tikTokVideos, focusedVideoId]);

  // Auto-focus first video if none is focused
  /*
  useEffect(() => {
    if (!focusedVideoId && rootVideos.length > 0) {
      setFocusedVideoId(rootVideos[0].id);
    }
  }, [rootVideos, focusedVideoId, setFocusedVideoId]);
  */

  // Click outside for More Menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

  // Actions
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

  const deleteVideo = async (id: string, url?: string) => {
    if (!confirm("¿Eliminar permanentemente este TikTok y todas sus notas?")) return;
    
    // 1. Optimistic local update
    deleteTikTokVideoSync(id);
    if (url) {
      const qItem = tikTokQueueItems.find(q => q.url === url);
      if (qItem) deleteTikTokQueueItemSync(qItem.id);
    }
    
    // Focus next if current was deleted
    if (focusedVideoId === id) {
      const remaining = rootVideos.filter(v => v.id !== id);
      setFocusedVideoId(remaining.length > 0 ? remaining[0].id : null);
    }

    // 2. Perform deletions in Supabase
    await supabase.from("notes").delete().eq("tiktok_video_id", id);
    if (url) {
      await supabase.from("tiktok_queue").delete().eq("url", url);
    }
    await supabase.from("tiktok_queue").delete().eq("video_id", id);
    await supabase.from("tiktok_videos").delete().eq("id", id);
  };

  const archiveVideo = async (id: string) => {
    // Optimistic local update
    updateTikTokVideoSync(id, { status: 'archived' });
    
    if (focusedVideoId === id) {
      const remaining = rootVideos.filter(v => v.id !== id);
      setFocusedVideoId(remaining.length > 0 ? remaining[0].id : null);
    }
    
    await supabase.from("tiktok_videos").update({ status: 'archived' }).eq("id", id);
  };

  const restoreVideo = async (id: string) => {
    await supabase.from("tiktok_videos").update({ status: 'active' }).eq("id", id);
    setFocusedVideoId(id);
  };

  const handleCreateSubTikTok = async () => {
    if (!focusedVideoId) return;
    const url = prompt("Introduce el URL para el Sub-TikTok:");
    if (!url) return;
    
    setIsAdding(true);
    const { data: queueData, error: queueError } = await supabase.from("tiktok_queue").insert([{
      url,
      user_id: session.user.id,
      status: "pending",
      parent_id: focusedVideoId
    }]).select().single();
    
    if (queueError) {
      alert("Error al crear sub-tiktok: " + queueError.message);
    } else {
      // In a real scenario, we might want to link it once it's processed.
      // For now, let's just add it to the queue. 
      // The worker will insert it into tiktok_videos. 
      // We need a way to tell the worker it has a parent.
      // But our worker doesn't support parent_id yet.
      // So I'll manually insert a placeholder or wait for processing.
      setIsModalOpen(true); // Show log
    }
    setIsAdding(false);
  };

  const handleConvertToNote = async () => {
    if (!focusedVideo) return;
    const { groups, activeGroupId } = useUIStore.getState();
    const groupNames = groups.map((g, idx) => `${idx + 1}. ${g.title}`).join("\n");
    const choice = prompt(`Selecciona el número del grupo para la nueva nota:\n${groupNames}\n\n(Deja vacío para el grupo activo)`);
    
    let targetGroupId = activeGroupId;
    if (choice) {
      const idx = parseInt(choice) - 1;
      if (groups[idx]) targetGroupId = groups[idx].id;
    }

    if (!targetGroupId) {
      alert("No hay un grupo seleccionado.");
      return;
    }

    const content = `
# [ANÁLISIS TIKTOK] ${focusedVideo.title}
**Autor:** @${focusedVideo.author} | **URL:** ${focusedVideo.url}

## 📝 RESUMEN EJECUTIVO
${focusedVideo.summary || "_Sin resumen generado_"}

## 💡 PUNTOS CLAVE
${focusedVideo.key_points?.map(p => `- ${p}`).join("\n") || "_Sin puntos clave_"}

## ✍️ NOTAS DE TRABAJO
${focusedVideo.scratchpad || "_Sin notas_"}

---

## 🎙️ TRANSCRIPCIÓN COMPLETA
${focusedVideo.transcript || "_Sin transcripción_"}
`.trim();

    const { error } = await supabase.from("notes").insert([{
      title: `TikTok: ${focusedVideo.title?.slice(0, 40)}`,
      content,
      user_id: session.user.id,
      group_id: targetGroupId,
      position: 0
    }]);

    if (error) {
      alert("Error al convertir a nota: " + error.message);
    } else {
      alert("¡Nota creada con éxito!");
    }
  };

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const container = splitContainerRef.current;
    if (!container) return;
    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const rect = container.getBoundingClientRect();
      const ratio = (ev.clientX - rect.left) / rect.width;
      setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
    };
    const onUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Click outside menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setIsSortMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`flex flex-col h-full bg-[#13131A] text-zinc-100 font-sans transition-all duration-300 ${isTikTokMaximized ? 'fixed inset-0 z-50' : 'relative'}`}>
      
      {/* 1. HEADER */}
      {!isZenMode && (
        <div className="sticky top-0 z-30 bg-[#1A1A24]/90 backdrop-blur-md shrink-0 border-b border-zinc-800/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 gap-4">
            <h1 className="text-xl font-bold text-white flex items-center gap-3">
              <div className="h-9 p-2 bg-[#EE1D52] rounded-lg text-white shadow-lg shadow-[#EE1D52]/20 shrink-0">
                <Play size={20} />
              </div>
              <span className="truncate">TikTok</span>
            </h1>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Bell Reminder */}
              <button
                onClick={() => overdueRemindersCount > 0 && setShowOverdueMarquee(!showOverdueMarquee)}
                disabled={overdueRemindersCount === 0}
                className={`h-9 px-3 rounded-xl transition-all active:scale-[0.98] shrink-0 flex items-center gap-2 border ${
                  showOverdueMarquee 
                    ? 'bg-[#DC2626] border-red-400 text-white shadow-sm shadow-red-600/20' 
                    : overdueRemindersCount > 0
                      ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20'
                      : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 opacity-60 cursor-not-allowed'
                }`}
              >
                <Bell size={18} className={overdueRemindersCount > 0 ? 'animate-pulse' : ''} />
                {overdueRemindersCount > 0 && <span className="text-xs font-bold">{overdueRemindersCount}</span>}
              </button>

              {/* Accesos Tray Toggle */}
              <button 
                onClick={() => setIsVideoTrayOpen(!isVideoTrayOpen)} 
                className={`h-9 px-3 rounded-xl transition-all border flex items-center gap-2 ${isVideoTrayOpen ? 'bg-[#EE1D52] border-[#EE1D52]/80 text-white font-bold shadow-lg shadow-[#EE1D52]/20' : 'bg-[#EE1D52]/10 text-[#EE1D52] border-[#EE1D52]/30 hover:bg-[#EE1D52]/20'}`}
              >
                <ChevronsDownUp size={18} className={`transition-transform duration-300 ${isVideoTrayOpen ? 'rotate-180' : ''}`}/>
                <span className="text-sm font-bold">{rootVideos.length}</span>
              </button>

              {/* Maximize */}
              <button onClick={() => setIsTikTokMaximized(!isTikTokMaximized)} className="h-9 p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all">
                {isTikTokMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>

              {/* Sort */}
              <div className="relative" ref={sortMenuRef}>
                <button onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} className="h-9 p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all">
                  <ArrowUpDown size={18} />
                </button>
                {isSortMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#1A1A24] border border-zinc-800 rounded-xl shadow-2xl z-50 py-1 overflow-hidden animate-fadeIn">
                    {[
                      { id: 'date-desc', label: 'Fecha (Recientes)', icon: <Calendar size={14} /> },
                      { id: 'date-asc', label: 'Fecha (Antiguos)', icon: <Calendar size={14} /> },
                      { id: 'created-desc', label: 'Creación (reciente)', icon: <Calendar size={14} /> },
                      { id: 'created-asc', label: 'Creación (antigua)', icon: <Calendar size={14} /> },
                      { id: 'alpha-asc', label: 'Nombre (A-Z)', icon: <Type size={14} /> },
                      { id: 'alpha-desc', label: 'Nombre (Z-A)', icon: <Type size={14} /> },
                    ].map(opt => (
                      <button 
                        key={opt.id} 
                        onClick={() => { setSortMode(opt.id as any); localStorage.setItem('tiktokSortMode', opt.id); setIsSortMenuOpen(false); }} 
                        className={`w-full px-4 py-2 text-left text-xs flex items-center gap-2 hover:bg-zinc-800 transition-colors ${sortMode === opt.id ? 'text-[#EE1D52] font-bold bg-[#EE1D52]/5' : 'text-zinc-400 font-medium'}`}
                      >
                        {opt.icon} {opt.label}
                        {sortMode === opt.id && <Check size={14} className="ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${searchQuery ? 'text-[#EE1D52]' : 'text-zinc-500'}`} />
                <input 
                  type="text" 
                  placeholder="Buscar TikTok..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 pr-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-xs outline-none focus:border-[#EE1D52]/50 transition-all w-48"
                />
              </div>

              {/* New Button */}
              <button 
                onClick={() => setIsModalOpen(true)}
                className="h-9 bg-[#EE1D52] hover:bg-[#D61A4A] text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 active:scale-95 transition-all shadow-[#EE1D52]/10 border border-[#EE1D52]/30"
              >
                <Plus size={18} /> <span className="text-sm font-bold">Nuevo TikTok</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ACCESS TRAY (Solo Activos) */}
      {isVideoTrayOpen && !isZenMode && (
        <div className="py-4 px-6 bg-[#1A1A24]/40 border-b border-zinc-800/30 overflow-x-auto hidden-scrollbar flex items-center gap-3 animate-slideDown">
          {rootVideos.length === 0 ? (
            <div className="text-xs text-zinc-600 italic px-4">No hay videos activos</div>
          ) : (
            rootVideos.map(video => (
              <button
                key={video.id}
                onClick={() => { setFocusedVideoId(video.id); }}
                className={`shrink-0 flex items-center gap-3 px-4 py-2 rounded-xl border transition-all ${
                  focusedVideoId === video.id 
                    ? 'bg-[#EE1D52] text-white border-[#EE1D52] shadow-lg shadow-[#EE1D52]/20 scale-[1.02]' 
                    : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:border-[#EE1D52]/40 hover:text-[#EE1D52]'
                }`}
              >
                <div className="w-6 h-8 rounded-md overflow-hidden bg-zinc-800 border border-zinc-700/50 shrink-0">
                  <img src={video.thumbnail} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="max-w-[150px] truncate text-[11px] font-bold">
                  {highlightText(video.title || "Procesando...", searchQuery)}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* 3. MAIN CONTENT */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* If there are videos, show the editor directly. If one is focused, show it. */}
        {focusedVideo ? (
            <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#1A1A24] rounded-2xl shadow-lg border border-zinc-200 dark:border-[#2D2D42] overflow-hidden m-4 animate-fadeIn">
              {/* Integrated Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
                <div className="flex-1 min-w-0 pr-4 flex items-center gap-2">
                  <div className="relative flex-1">
                    <input 
                      type="text"
                      value={focusedVideo.title || ""}
                      onChange={(e) => updateVideo(focusedVideo.id, { title: e.target.value })}
                      placeholder="Sin Título"
                      className="w-full bg-transparent border-none outline-none text-lg font-black text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 p-0 truncate"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => setIsTikTokPizarronOpen(!isTikTokPizarronOpen)} 
                    className={`p-2 rounded-xl border transition-all ${isTikTokPizarronOpen ? 'bg-[#EE1D52]/20 text-[#EE1D52] border-[#EE1D52]/40' : 'text-zinc-500 border-zinc-800 hover:border-[#EE1D52]/30'}`}
                    title="Pizarrón / Borrador"
                  >
                    <PenLine size={13} />
                  </button>
                  <button 
                    onClick={() => toggleZenMode('tiktok')} 
                    className={`p-2 rounded-xl border transition-all ${isZenMode ? 'bg-[#EE1D52] border-[#EE1D52]/80 text-white font-bold shadow-lg shadow-[#EE1D52]/20' : 'text-zinc-500 border-zinc-800 hover:border-[#EE1D52]/30'}`}
                    title={isZenMode ? "Salir de Modo Zen" : "Entrar a Modo Zen"}
                  >
                    <Wind size={13} />
                  </button>
                  
                  <div className="relative" ref={moreMenuRef}>
                    <button
                      onClick={() => setShowMoreMenu(!showMoreMenu)}
                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Más opciones"
                    >
                      <MoreVertical size={16} />
                    </button>
                    
                    {showMoreMenu && (
                      <div className="absolute right-0 top-full mt-1 z-50 bg-[#1A1A24] shadow-xl rounded-lg border border-zinc-800 p-1 flex flex-col gap-0.5 min-w-[180px] animate-fadeIn">
                        <button 
                          onClick={() => { handleConvertToNote(); setShowMoreMenu(false); }} 
                          className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                        >
                          <ExternalLink size={14} /> Convertir a Nota
                        </button>
                        
                        <div className="border-t border-zinc-800 my-0.5" />
                        
                        <button 
                          onClick={() => { archiveVideo(focusedVideo.id); setShowMoreMenu(false); }} 
                          className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                        >
                          <Archive size={14} /> Archivar
                        </button>
                        
                        <button 
                          onClick={() => { deleteVideo(focusedVideo.id, focusedVideo.url); setShowMoreMenu(false); }} 
                          className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => setShowAIInput(!showAIInput)}
                    className={`p-2 rounded-xl border transition-all ${showAIInput ? 'bg-[#EE1D52]/20 text-[#EE1D52] border-[#EE1D52]/40' : 'text-zinc-500 border-zinc-800 hover:border-[#EE1D52]/30'}`}
                    title="Asistente IA"
                  >
                    <Sparkles size={13} />
                  </button>
                </div>
              </div>

              {/* VIDEO METADATA BAR */}
              <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/30 border-y border-zinc-100 dark:border-zinc-800/50 flex items-center gap-4 text-[10px] uppercase tracking-widest font-bold text-zinc-400">
                <a href={focusedVideo.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-[#EE1D52] transition-colors"><ExternalLink size={10} /> Ver en TikTok</a>
                <span className="flex items-center gap-1.5"><User size={10} /> {focusedVideo.author || "Anónimo"}</span>
                <span className="flex items-center gap-1.5"><Clock size={10} /> {formatDuration(focusedVideo.duration)}</span>
                <span className="flex items-center gap-1.5"><History size={10} /> {new Date(focusedVideo.created_at).toLocaleDateString()}</span>
              </div>

              <div className="flex-1 flex flex-col min-h-0 container-notes-app p-4">
                {/* TABS SELECTION */}
                <div className="flex items-center gap-2 pb-3 overflow-x-auto hidden-scrollbar shrink-0">
                  <button 
                    onClick={() => setActiveTab('original')} 
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${activeTab === 'original' ? 'bg-[#EE1D52] text-white border-[#EE1D52] shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:text-[#EE1D52]'}`}
                  >
                    <FileText size={11} /> Transcripción
                  </button>

                  {/* Tabs AI summaries — violetas (procesando) */}
                  {aiSummaries.filter(s => s.status === 'pending' || s.status === 'processing').map(s => (
                    <div key={s.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border shrink-0 max-w-[150px] bg-zinc-800/60 border-zinc-700 text-zinc-400 animate-pulse cursor-wait"
                    >
                      <Loader2 size={10} className="animate-spin shrink-0" />
                      <span className="truncate">{s.target_objective || 'Analizando...'}</span>
                    </div>
                  ))}

                  {/* Tabs AI summaries — violetas (completados) */}
                  {aiSummaries.filter(s => s.status === 'completed' || !s.status).map(summary => (
                    <div key={summary.id} className="relative group">
                      <button 
                        onClick={() => setActiveTab(`summary_${summary.id}`)} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${activeTab === `summary_${summary.id}` ? 'bg-violet-600 text-white border-violet-500 shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:text-violet-400'}`}
                      >
                        <Sparkles size={11} /> 
                        <span className="max-w-[120px] truncate">{summary.target_objective || 'Resumen'}</span>
                        {activeTab === `summary_${summary.id}` && (
                          <span 
                            onClick={(e) => { e.stopPropagation(); deleteSummary(summary.id); setActiveTab('original'); }}
                            className="ml-1 p-0.5 hover:bg-black/20 rounded transition-colors"
                          >
                            <Trash2 size={10} />
                          </span>
                        )}
                      </button>
                    </div>
                  ))}

                  {subnotes.map(note => (
                    <button 
                      key={note.id}
                      onClick={() => setActiveTab(`note_${note.id}`)} 
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${activeTab === `note_${note.id}` ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:text-emerald-400'}`}
                    >
                      <StickyNote size={11} /> 
                      <span className="max-w-[120px] truncate">{note.title || 'Nota'}</span>
                      {activeTab === `note_${note.id}` && (
                        <span 
                          onClick={(e) => { e.stopPropagation(); deleteSubnote(note.id); setActiveTab('original'); }}
                          className="ml-1 p-0.5 hover:bg-black/20 rounded transition-colors"
                        >
                          <Trash2 size={10} />
                        </span>
                      )}
                    </button>
                  ))}

                  <button 
                    onClick={async () => {
                      const tiktokGroup = groups.find(g => g.title === 'TikTok') || groups[0];
                      if (!tiktokGroup) return;
                      const newNote = await createSubnote('Nuevo Detalle', tiktokGroup.id);
                      if (newNote) setActiveTab(`note_${newNote.id}`);
                    }} 
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border shrink-0 text-emerald-400 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 transition-all"
                  >
                    <Plus size={11} /> Sub
                  </button>
                </div>

                {/* AI Assistant Panel */}
                {showAIInput && (
                  <div className="mb-4 animate-slideDown shrink-0">
                    <TikTokAIPanel 
                      videoId={focusedVideo.id} 
                      onGenerate={async (obj) => { 
                        setShowAIInput(false);
                        await generateSummary(obj);
                      }} 
                    />
                  </div>
                )}

                {/* CONTENT AREA (EDITOR + SCRATCHPAD) */}
                <div ref={splitContainerRef} className="flex-1 flex min-h-0 gap-2 overflow-hidden animate-fadeIn">
                  <div 
                    className="flex-1 min-h-0 overflow-y-auto bg-zinc-50 dark:bg-zinc-900/20 rounded-xl border border-zinc-200 dark:border-zinc-800 scroll-smooth"
                    style={isTikTokPizarronOpen ? { width: `${splitRatio * 100}%`, flex: 'none' } : { flex: 1 }}
                  >
                    <div className="p-4 h-full">
                      {activeTab === 'original' && (
                        <SmartNotesEditor 
                          ref={editorRef}
                          noteId={focusedVideo.id}
                          initialContent={focusedVideo.transcript || ""}
                          onChange={(c) => updateVideo(focusedVideo.id, { transcript: c })}
                          searchQuery={searchQuery}
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
                          />
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* Divider */}
                  {isTikTokPizarronOpen && (
                    <div 
                      onMouseDown={handleDividerMouseDown}
                      className="shrink-0 flex items-center justify-center rounded-full cursor-col-resize select-none hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors w-2 h-full"
                      title="Arrastrar para redimensionar"
                    >
                       <div className="rounded-full bg-zinc-300 dark:bg-zinc-600 w-1 h-8" />
                    </div>
                  )}

                  {/* Scratchpad (Pizarrón) */}
                  {isTikTokPizarronOpen && (
                    <div className="flex-1 min-h-0 overflow-y-auto bg-violet-50/10 dark:bg-violet-900/5 rounded-xl border border-violet-200/50 dark:border-violet-900/30 animate-fadeIn flex flex-col">
                      <div className="px-3 py-2 border-b border-violet-200/20 flex items-center gap-2">
                        <PenLine size={11} className="text-violet-400" />
                        <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Pizarrón</span>
                      </div>
                      <div className="flex-1 p-4">
                        {activeTab === 'original' && (
                          <SmartNotesEditor 
                            ref={scratchRef}
                            noteId={`scratch_${focusedVideo.id}`}
                            initialContent={focusedVideo.scratchpad || ""}
                            onChange={(c) => updateVideo(focusedVideo.id, { scratchpad: c })}
                          />
                        )}
                        {activeTab.startsWith('summary_') && (() => {
                          const summaryId = activeTab.replace('summary_', '');
                          const summary = aiSummaries.find(s => s.id === summaryId);
                          return summary ? (
                            <SmartNotesEditor 
                              key={`scratch_${summary.id}`}
                              noteId={summary.id}
                              initialContent={summary.scratchpad || ""}
                              onChange={(c) => updateSummaryScratchpad(summary.id, c)}
                            />
                          ) : null;
                        })()}
                        {activeTab.startsWith('note_') && (() => {
                          const noteId = activeTab.replace('note_', '');
                          const note = subnotes.find(n => n.id === noteId);
                          return note ? (
                            <SmartNotesEditor 
                              key={`scratch_${note.id}`}
                              noteId={note.id}
                              initialContent={note.scratchpad || ""}
                              onChange={(c) => updateSubnote(note.id, { scratchpad: c })}
                            />
                          ) : null;
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={`flex-1 overflow-y-auto p-6 scroll-smooth animate-fadeIn`}>
              <div className={`${isTikTokMaximized ? 'max-w-full' : 'max-w-6xl'} mx-auto space-y-12 pb-20`}>
                {rootVideos.length > 0 ? (
                  /* GRID DE VIDEOS ACTIVOS */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rootVideos.map(video => (
                      <div 
                        key={video.id} 
                        onClick={() => setFocusedVideoId(video.id)}
                        className={`group bg-white dark:bg-[#1A1A24] border border-zinc-200 dark:border-zinc-800/50 rounded-2xl p-5 hover:border-[#EE1D52]/40 hover:shadow-xl transition-all cursor-pointer flex flex-col gap-4 relative`}
                      >
                        <div className="flex gap-4">
                          <div className="w-16 h-20 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 shadow-md">
                            <img src={video.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <h3 className="font-bold text-zinc-800 dark:text-zinc-100 truncate text-sm">
                              {highlightText(video.title || "Procesando...", searchQuery)}
                            </h3>
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
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                               onClick={(e) => { e.stopPropagation(); archiveVideo(video.id); }} 
                               className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-[#EE1D52] hover:bg-[#EE1D52]/10 rounded-xl transition-all"
                               title="Archivar"
                             >
                               <Archive size={14} />
                             </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-3 border-t border-zinc-50 dark:border-zinc-800/50 mt-auto">
                          <div className="flex items-center gap-1.5">
                             <span className="text-[10px] font-bold text-zinc-400 capitalize">{video.author ? 'Creador' : 'Video'}</span>
                             <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                             <span className="text-[10px] font-black text-[#EE1D52]/60 uppercase tracking-tighter italic">AI READY</span>
                          </div>
                          <div className="w-7 h-7 rounded-full bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-400 group-hover:bg-[#EE1D52] group-hover:text-white transition-all shadow-sm">
                            <ChevronRight size={16} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* WELCOME SCREEN (Empty Root) */
                  <div className="flex flex-col items-center justify-center text-center p-12 gap-6 animate-fadeIn">
                    <div className="w-32 h-32 rounded-full bg-zinc-900/10 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center relative overflow-hidden group">
                      <div className="absolute inset-0 bg-[#EE1D52]/5 group-hover:bg-[#EE1D52]/10 transition-colors"></div>
                      <Brain size={56} className="text-zinc-600 dark:text-zinc-400 relative z-10" />
                    </div>
                    <div className="space-y-2 max-w-sm">
                      <h2 className="text-xl font-black text-white uppercase tracking-tight">Cerebro TikTok</h2>
                      <p className="text-sm text-zinc-500 font-medium">Extrae conocimiento de cualquier video. Usa el botón "Nuevo" para empezar o selecciona uno de tus accesos.</p>
                    </div>
                    <button 
                       onClick={() => setIsModalOpen(true)}
                       className="px-6 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-2xl text-xs font-bold transition-all"
                    >
                       Agregar Nuevo Video
                    </button>
                  </div>
                )}

                {/* SECCIÓN DE ARCHIVO (Visible even if root is empty) */}
                {archivedVideos.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                    <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase tracking-widest text-xs px-2">
                      <Archive size={16} /> Historial de Videos ({archivedVideos.length})
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      {archivedVideos.map(video => (
                        <div key={video.id} className="p-4 bg-white dark:bg-[#1A1A24]/60 border border-zinc-200 dark:border-zinc-800/40 rounded-2xl flex items-center justify-between group hover:border-[#EE1D52]/30 transition-all">
                          <div className="flex items-center gap-4 truncate">
                            <div className="w-8 h-10 rounded bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0 opacity-60">
                              <img src={video.thumbnail} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div className="flex flex-col truncate">
                              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 truncate">{video.title || "Sin Título"}</span>
                              <span className="text-[10px] text-zinc-500 font-medium">{video.author} • {formatDuration(video.duration)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => restoreVideo(video.id)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-[#EE1D52] rounded-xl transition-all" title="Restaurar"><RotateCcw size={16}/></button>
                            <button onClick={() => deleteVideo(video.id, video.url)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-red-500 rounded-xl transition-all" title="Eliminar permanentemente"><Trash2 size={16}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
        )}
      </div>

      {/* 4. MODAL */}
      {isModalOpen && (
        <NewTikTokModal 
          onClose={() => setIsModalOpen(false)} 
          queue={tikTokQueueItems}
          onAdd={handleAddUrls}
          isAdding={isAdding}
        />
      )}
    </div>
  );
};
