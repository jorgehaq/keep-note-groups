import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Music, 
  List, 
  Play, 
  Check, 
  X, 
  AlertCircle, 
  RefreshCw, 
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
  StickyNote
} from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient';
import { useUIStore } from '../src/lib/store';
import { Session } from '@supabase/supabase-js';
import { TikTokVideo, TikTokQueueItem } from '../types';
import { KanbanSemaphore } from './KanbanSemaphore';
import { TikTokAIPanel } from './TikTokAIPanel';

// --- HELPERS ---
const formatDuration = (secs: number): string => {
  if (!secs) return '0:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const extractUrls = (raw: string): string[] => {
  return raw
    .split(/[\n,\s]+/)
    .map((u) => u.trim())
    .filter((u) => u.includes("tiktok.com"));
};

export const TikTokApp: React.FC<{ session: Session }> = ({ session }) => {
  const { 
    isTikTokMaximized, 
    setIsTikTokMaximized, 
    activeGroupId,
    isZenModeByApp,
    tikTokVideos,
    tikTokQueueItems,
    focusedVideoId,
    setFocusedVideoId,
    isVideoTrayOpen,
    setIsVideoTrayOpen,
    groups, // Needed for selecting target group when converting to note
    overdueRemindersCount,
    showOverdueMarquee,
    setShowOverdueMarquee
  } = useUIStore();

  const [urlInput, setUrlInput] = useState("");
  const [activeEditorTab, setActiveEditorTab] = useState<"notes" | "transcript" | "ai">("notes");
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  const isZenMode = !!isZenModeByApp['tiktok'];
  const focusedVideo = tikTokVideos.find(v => v.id === focusedVideoId);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setIsActionMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- ACTIONS ---
  const handleAddUrls = async () => {
    const urls = extractUrls(urlInput);
    if (!urls.length) return;
    setIsAdding(true);
    
    const rows = urls.map((url) => ({ 
      url, 
      user_id: session.user.id, 
      status: "pending" 
    }));
    
    const { error } = await supabase.from("tiktok_queue").insert(rows);

    if (!error) {
      setUrlInput("");
      // Realtime will pick up the change
    }
    setIsAdding(false);
  };

  const handleUpdateVideo = async (updates: Partial<TikTokVideo>) => {
    if (!focusedVideoId) return;
    await supabase.from("tiktok_videos").update(updates).eq("id", focusedVideoId);
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este video?")) return;
    await supabase.from("tiktok_videos").delete().eq("id", id);
    if (focusedVideoId === id) setFocusedVideoId(null);
  };

  const filteredVideos = tikTokVideos.filter(v => 
    v.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.author?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConvertToNote = async () => {
    if (!focusedVideo) return;
    
    // User selects a group
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

    const { data, error } = await supabase.from("notes").insert([{
      title: `TikTok: ${focusedVideo.title?.slice(0, 40)}`,
      content,
      user_id: session.user.id,
      group_id: targetGroupId,
      position: 0
    }]).select().single();

    if (error) {
      alert("Error al convertir a nota: " + error.message);
    } else {
      setIsActionMenuOpen(false);
      if (confirm("Nota creada con éxito. ¿Quieres ir a verla ahora?")) {
        useUIStore.setState({ globalView: 'notes', activeGroupId: targetGroupId });
      }
    }
  };

  return (
    <div className={`flex h-full bg-[#13131A] text-zinc-100 font-sans transition-all duration-300 ${isTikTokMaximized ? 'fixed inset-0 z-50' : 'relative'}`}>
      
      {/* 1. LEFT TRAY (VIDEO LIST & QUEUE) */}
      {!isZenMode && (
        <div className={`
          flex flex-col border-r border-zinc-800/50 bg-[#1A1A24] md:bg-[#1A1A24]/40 backdrop-blur-3xl transition-all duration-300 
          ${isVideoTrayOpen ? 'w-full fixed inset-0 z-[60] md:relative md:w-80 md:inset-auto' : 'w-0 overflow-hidden'}
        `}>
          <div className="p-4 border-b border-zinc-800/50 flex flex-col gap-4">
             {/* Mobile Close Button */}
             <div className="flex md:hidden items-center justify-between mb-2">
               <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Explorar Videos</span>
               <button onClick={() => setIsVideoTrayOpen(false)} className="p-2 bg-zinc-800 rounded-xl text-zinc-400">
                 <X size={20} />
               </button>
             </div>
             {/* Search Area with Amber Pattern */}
             <div className="relative group">
               <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${searchQuery ? 'text-amber-400' : 'text-zinc-500'}`} size={16} />
               <input
                 type="text"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder="Buscar videos..."
                 className={`w-full bg-zinc-900/50 border rounded-2xl py-2.5 pl-11 pr-4 text-xs outline-none transition-all ${searchQuery ? 'border-amber-500/50 ring-4 ring-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'border-zinc-800 focus:border-indigo-500/50'}`}
               />
             </div>

             {/* Add URL */}
             <div className="flex gap-2">
               <input 
                 type="text" 
                 value={urlInput}
                 onChange={(e) => setUrlInput(e.target.value)}
                 placeholder="Pegar URL TikTok..."
                 className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-[10px] outline-none focus:border-indigo-500/30"
                 onKeyDown={(e) => e.key === 'Enter' && handleAddUrls()}
               />
               <button 
                 onClick={handleAddUrls}
                 disabled={isAdding || !urlInput.trim()}
                 className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white transition-all disabled:opacity-50"
               >
                 {isAdding ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />}
               </button>
             </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto hidden-scrollbar p-2 space-y-2">
             {/* Queue Items */}
             {tikTokQueueItems.length > 0 && (
               <div className="space-y-1 mb-4">
                 <div className="px-3 py-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                   <Clock size={10} /> En Cola ({tikTokQueueItems.length})
                 </div>
                 {tikTokQueueItems.map(item => (
                   <div key={item.id} className="mx-1 p-2 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-between gap-2 overflow-hidden shadow-sm animate-pulse">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-zinc-400 truncate opacity-60 italic">{item.url}</p>
                      </div>
                      <div className="text-[8px] font-black bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full uppercase">
                        {item.status}
                      </div>
                   </div>
                 ))}
               </div>
             )}

             {/* Processed Videos */}
             <div className="space-y-1">
               <div className="px-3 py-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                 <Play size={10} /> Videos Procesados
               </div>
               {filteredVideos.map(video => (
                 <button
                   key={video.id}
                   onClick={() => setFocusedVideoId(video.id)}
                   className={`w-full group text-left p-3 rounded-2xl flex items-center gap-3 transition-all ${
                     focusedVideoId === video.id 
                       ? 'bg-indigo-600/10 border border-indigo-500/30 shadow-lg shadow-black/20 translate-x-1' 
                       : 'hover:bg-zinc-800/40 border border-transparent'
                   }`}
                 >
                   <div className="w-12 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-zinc-800 group-hover:border-zinc-700 transition-all shadow-inner relative">
                      <img src={video.thumbnail} className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all" alt="" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                      <div className="absolute bottom-1 right-1 text-[8px] font-bold text-white/80">{formatDuration(video.duration)}</div>
                   </div>
                   <div className="flex-1 min-w-0">
                     <h4 className={`text-xs font-bold truncate transition-colors ${focusedVideoId === video.id ? 'text-indigo-400' : 'text-zinc-200 group-hover:text-white'}`}>
                       {video.title || "Procesando..."}
                     </h4>
                     <p className="text-[10px] text-zinc-500 mt-0.5 font-medium flex items-center gap-1">
                        <User size={10} /> @{video.author}
                     </p>
                     <div className="flex items-center gap-2 mt-2 opacity-50 group-hover:opacity-80 transition-opacity">
                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">
                          {new Date(video.created_at).toLocaleDateString()}
                        </span>
                     </div>
                   </div>
                 </button>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* 2. MAIN CONTENT (EDITOR & INFO) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#13131A] relative shadow-2xl overflow-hidden">
        
        {/* Toggle Tray Button */}
        {!isZenMode && (
          <button
            onClick={() => setIsVideoTrayOpen(!isVideoTrayOpen)}
            className={`absolute top-1/2 -left-3 -translate-y-1/2 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full border border-zinc-700 z-40 transition-all shadow-xl ${isVideoTrayOpen ? 'md:opacity-0 md:hover:opacity-100' : 'opacity-100'}`}
          >
            <PanelLeft size={16} className={`text-zinc-400 transition-transform ${isVideoTrayOpen ? '' : 'rotate-180'}`} />
          </button>
        )}

        {focusedVideo ? (
          <>
            {/* VIDEO HEADER */}
            <div className={`px-8 py-4 border-b border-zinc-800/50 flex items-center justify-between gap-6 transition-all ${isZenMode ? 'mt-8' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-black text-white truncate uppercase tracking-tight">{focusedVideo.title}</h2>
                  <KanbanSemaphore 
                    status={focusedVideo.status || 'todo'} 
                    onStatusChange={(s) => handleUpdateVideo({ status: s })}
                  />
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-zinc-500 font-mono uppercase tracking-[0.1em]">
                  <span className="flex items-center gap-1.5 text-indigo-400/80"><User size={14} /> @{focusedVideo.author}</span>
                  <span className="flex items-center gap-1.5"><Eye size={14} /> {focusedVideo.view_count.toLocaleString()}</span>
                  <span className="flex items-center gap-1.5"><Heart size={14} className="text-red-500/40" /> {focusedVideo.like_count.toLocaleString()}</span>
                  <a href={focusedVideo.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-white transition-colors">
                    <ExternalLink size={14} /> VIDEO ORIGINAL
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Bell Reminder Button */}
                <button
                  onClick={() => overdueRemindersCount > 0 && setShowOverdueMarquee(!showOverdueMarquee)}
                  disabled={overdueRemindersCount === 0}
                  className={`h-9 px-3 rounded-xl transition-all active:scale-[0.98] shrink-0 flex items-center gap-2 border ${
                    showOverdueMarquee 
                      ? 'bg-[#DC2626] border-red-400 text-white shadow-sm shadow-red-600/20' 
                      : overdueRemindersCount > 0
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40'
                        : 'bg-white dark:bg-[#1A1A24] border-zinc-200 dark:border-[#2D2D42] text-zinc-400 opacity-60 cursor-not-allowed'
                  }`}
                  title={overdueRemindersCount === 0 ? "No hay recordatorios vencidos" : showOverdueMarquee ? "Ocultar Recordatorios" : "Mostrar Recordatorios"}
                >
                  <Bell size={18} className={overdueRemindersCount > 0 ? `animate-pulse ${showOverdueMarquee ? 'text-white' : 'text-red-500'}` : ''} />
                  {overdueRemindersCount > 0 && (
                    <span className={`text-xs font-bold whitespace-nowrap ${showOverdueMarquee ? 'text-white' : ''}`}>
                      {overdueRemindersCount}
                    </span>
                  )}
                </button>
                <div className="relative" ref={actionMenuRef}>
                    <button 
                      onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                      className="p-3 hover:bg-zinc-800/80 rounded-2xl text-zinc-500 transition-all"
                    >
                      <MoreVertical size={20} />
                    </button>
                    {isActionMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-[#1A1A24] border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                        <button 
                          onClick={handleConvertToNote}
                          className="w-full text-left px-4 py-3 text-xs font-semibold text-amber-400 hover:bg-amber-500/10 flex items-center gap-3"
                        >
                          <StickyNote size={14} /> Convertir en Nota 📝
                        </button>
                        <button className="w-full text-left px-4 py-3 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 flex items-center gap-3">
                          <Archive size={14} /> Archivar Nota
                        </button>
                        <button className="w-full text-left px-4 py-3 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 flex items-center gap-3">
                          <Download size={14} /> Exportar MD
                        </button>
                        <div className="border-t border-zinc-800 my-1"></div>
                        <button 
                          onClick={() => handleDeleteVideo(focusedVideo.id)}
                          className="w-full text-left px-4 py-3 text-xs font-semibold text-red-400 hover:bg-red-500/10 flex items-center gap-3"
                        >
                          <Trash2 size={14} /> Eliminar permanentemente
                        </button>
                      </div>
                    )}
                </div>
                {!isZenMode && (
                  <button
                    onClick={() => setIsTikTokMaximized(!isTikTokMaximized)}
                    className="p-3 bg-zinc-800/80 hover:bg-zinc-700 rounded-2xl text-zinc-400 hover:text-white transition-all shadow-inner"
                  >
                    {isTikTokMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                  </button>
                )}
              </div>
            </div>

            {/* TAB NAVIGATION */}
            <div className="px-8 border-b border-zinc-800/30 flex bg-zinc-900/10">
              {[
                { id: 'notes', label: 'ANÁLISIS & NOTAS', icon: FileText },
                { id: 'transcript', label: 'TRANSCRIPCIÓN', icon: Quote },
                { id: 'ai', label: 'IA GENERATIVA', icon: Sparkles },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveEditorTab(tab.id as any)}
                  className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border-b-2 transition-all ${
                    activeEditorTab === tab.id 
                      ? 'border-indigo-500 text-white bg-indigo-500/5' 
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* EDITOR AREA */}
            <div className="flex-1 overflow-y-auto hidden-scrollbar p-8">
              <div className="max-w-4xl mx-auto h-full flex flex-col gap-6">
                
                {activeEditorTab === 'notes' && (
                  <>
                    {/* Summary Card */}
                    <div className="p-6 bg-zinc-900/40 rounded-3xl border border-zinc-800/50 shadow-inner relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50"></div>
                       <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                         <Sparkles size={14} /> Resumen Ejecutivo
                       </h3>
                       <p className="text-zinc-300 leading-relaxed font-medium italic">
                         {focusedVideo.summary || "Genera un análisis en la pestaña de IA para ver el resumen aquí."}
                       </p>
                    </div>

                    {/* Editor (Scratchpad / Notes) */}
                    <div className="flex-1 flex flex-col min-h-[400px]">
                       <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2 px-1">
                         <Type size={14} /> Notas de Trabajo (Pizarrón)
                       </h3>
                       <textarea
                         value={focusedVideo.scratchpad || ""}
                         onChange={(e) => handleUpdateVideo({ scratchpad: e.target.value })}
                         placeholder="Escribe tus ideas aquí..."
                         className="flex-1 bg-transparent text-zinc-300 text-base leading-relaxed resize-none outline-none font-medium placeholder-zinc-700"
                       />
                    </div>
                  </>
                )}

                {activeEditorTab === 'transcript' && (
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                       <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                         <Quote size={14} /> Transcripción del Video
                       </h3>
                       <button className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-colors flex items-center gap-1">
                          <Download size={12} /> Descargar Texto
                       </button>
                    </div>
                    <textarea
                      value={focusedVideo.transcript || ""}
                      onChange={(e) => handleUpdateVideo({ transcript: e.target.value })}
                      placeholder="La transcripción se generará automáticamente..."
                      className="w-full min-h-[600px] bg-zinc-900/20 rounded-3xl p-6 text-zinc-400 text-sm leading-relaxed outline-none border border-zinc-800/50 font-medium"
                    />
                  </div>
                )}

                {activeEditorTab === 'ai' && (
                  <div className="flex flex-col gap-8">
                     <TikTokAIPanel videoId={focusedVideo.id} />
                     
                     <div className="space-y-6">
                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Análisis Previos</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {focusedVideo.key_points?.map((point, idx) => (
                             <div key={idx} className="p-4 bg-zinc-900/30 rounded-2xl border border-zinc-800/50 text-xs text-zinc-400 font-medium flex items-start gap-3">
                                <div className="w-5 h-5 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center font-bold flex-shrink-0">{idx + 1}</div>
                                {point}
                             </div>
                           ))}
                        </div>
                     </div>
                  </div>
                )}

              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-6 p-12">
             <div className="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 shadow-inner">
                <Music size={40} className="text-zinc-800" />
             </div>
             <div className="text-center space-y-2">
                <h2 className="text-xl font-black text-zinc-400 uppercase tracking-tight">Selecciona un video</h2>
                <p className="text-sm font-medium italic max-w-xs mx-auto text-zinc-500">
                  Explora tus videos procesados en el panel izquierdo o añade una nueva URL para empezar.
                </p>
             </div>
             {!isVideoTrayOpen && (
               <button 
                onClick={() => setIsVideoTrayOpen(true)}
                className="mt-4 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-2xl text-xs font-bold transition-all border border-zinc-700 shadow-lg"
               >
                 Abrir Panel de Videos
               </button>
             )}
          </div>
        )}
      </div>
    </div>
  );
};
