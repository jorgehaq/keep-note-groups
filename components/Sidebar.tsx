import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Settings, Grid, X, LogOut, StickyNote, KanbanSquare, Clock, Bell, PenTool, Languages, ChevronUp, ChevronDown, Play } from 'lucide-react';
import { Group } from '../types';
import { GroupLauncher } from './GroupLauncher';
import { useUIStore } from '../src/lib/store';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  groups: Group[]; 
  activeGroupId: string | null;
  onSelectGroup: (id: string) => void;
  onAddGroup: () => void;
  onOpenSettings: () => void;
  onTogglePin: (groupId: string, currentStatus: boolean) => void;
  onToggleFavorite: (groupId: string, currentStatus: boolean) => void;
  onLogout: () => void;
  onSelectDockedNote: (groupId: string, noteId: string) => void;
  focusedNoteId: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  groups,
  activeGroupId,
  onSelectGroup,
  onAddGroup,
  onOpenSettings,
  onTogglePin,
  onToggleFavorite,
  onLogout,
  onSelectDockedNote,
  focusedNoteId,
}) => {
  const { dockedGroupIds, closeGroup, globalView, setGlobalView, activeTimersCount, overdueRemindersCount, overdueRemindersList, imminentRemindersCount, lastAppView, kanbanTodoCount, kanbanInProgressCount, kanbanDoneCount, lastUsedApp, globalTasks, lastActiveNoteByGroup, sidebarFocusMode, setSidebarFocusMode, lastActiveGroupId, globalScrollToActiveCount } = useUIStore();
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const { t } = useTranslation();

  const dockedGroups = groups.filter(g => dockedGroupIds.includes(g.id));
  const sortedDockedGroups = dockedGroupIds
    .map(id => groups.find(g => g.id === id))
    .filter((g): g is Group => !!g);

  const getAppStyle = (appId: string) => {
    const TINTED_IDENTITY: Record<string, string> = {
      notes: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/40 shadow-sm',
      reminders: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/40 shadow-sm',
      timers: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/40 shadow-sm',
      kanban: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 shadow-sm',
      tiktok: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/40 shadow-sm',
      translator: 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/40 shadow-sm',
      braindump: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/40 shadow-sm',
    };

    // ESTADO 1: ACTIVO
    if (globalView === appId) {
      const activeStyle = TINTED_IDENTITY[appId] || TINTED_IDENTITY.notes;
      return `${activeStyle} border scale-105 active:scale-95 transition-all`;
    }

    // ESTADO 2: RECIÉN PERDIÓ EL FOCO (Gris estructurado con ring)
    if (lastUsedApp === appId) {
      return 'bg-white dark:bg-[#1A2437] border border-zinc-300 dark:border-indigo-500/80 text-zinc-700 dark:text-zinc-200 shadow-sm hover:border-indigo-400/60 dark:hover:border-[#3D3E89]/60 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 hover:scale-105 active:scale-95 transition-all';
    }

    // ESTADO 3: INACTIVO (Basado en el contrato de AccordionItem)
    return 'bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-indigo-500/80 text-zinc-500 hover:border-indigo-400/60 dark:hover:border-[#3D3E89]/60 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-sm hover:scale-105 active:scale-95 transition-all';
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        setCanScrollUp(scrollTop > 2);
        setCanScrollDown(scrollTop + clientHeight < scrollHeight - 2);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [sortedDockedGroups.length, globalView, activeGroupId, focusedNoteId]);

  // --- 🚀 AUTO-SCROLL TO ACTIVE ELEMENT ---
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    if (!container) return;

    const timer = setTimeout(() => {
        // Buscamos el elemento que tiene el foco activo (burbuja de nota o botón de grupo)
        const activeElement = container.querySelector('[data-sidebar-active="true"]');
        
        if (activeElement) {
            activeElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center', // Usamos center para paridad con inline:center de AccordionItem
            });
        }
        
        // Tras el scroll, recalculamos si se pueden mostrar u ocultar flechas
        checkScroll();
    }, 150);
    
    return () => clearTimeout(timer);
  }, [activeGroupId, focusedNoteId, sidebarFocusMode, globalView, sortedDockedGroups.length, globalScrollToActiveCount]);

  const scrollGroups = (direction: 'up' | 'down') => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ top: direction === 'up' ? -150 : 150, behavior: 'smooth' });
    }
  };

  return (
    <>
      <div className="w-[49px] md:w-[59px] bg-zinc-50 dark:bg-[#112240] border-r border-zinc-200 dark:border-[#2D2D42] flex flex-col items-center py-3 gap-4 h-full shrink-0 z-50 overflow-visible transition-colors duration-300">

        {/* Reminders Button */}
        <button
          onClick={() => setGlobalView('reminders')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all shrink-0 ${getAppStyle('reminders')}`}
          title={t('sidebar.reminders')}
        >
          <Bell size={20} />
          {overdueRemindersList.length > 0 && (
            <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-red-500 text-white brightness-110 drop-shadow-sm text-[10px] md:text-[12px] font-bold min-w-[16px] md:min-w-[20px] h-4 md:h-5 px-1 md:px-1.5 flex items-center justify-center rounded-md shadow-md ring-1 ring-red-600/50 animate-pulse z-30" style={{ animationDuration: '1s' }}>
              {overdueRemindersList.length}
            </div>
          )}
        </button>

        {/* Timer Button */}
        <button
          onClick={() => setGlobalView('timers')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all shrink-0 ${getAppStyle('timers')}`}
          title={t('sidebar.timers')}
        >
          <Clock size={20} />
          {activeTimersCount > 0 && (
            <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-red-500 text-white brightness-110 drop-shadow-sm text-[10px] md:text-[12px] font-bold min-w-[16px] md:min-w-[20px] h-4 md:h-5 px-1 md:px-1.5 flex items-center justify-center rounded-md shadow-md ring-1 ring-red-600/50 animate-pulse z-30" style={{ animationDuration: '1s' }}>
              {activeTimersCount}
            </div>
          )}
        </button>

        {/* Kanban Button */}
        <button
          onClick={() => setGlobalView('kanban')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all shrink-0 ${getAppStyle('kanban')}`}
          title={t('sidebar.kanban')}
        >
          <KanbanSquare size={20} />
          {(kanbanTodoCount > 0 || kanbanInProgressCount > 0) && (
            <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 flex items-center gap-px">
              {kanbanTodoCount > 0 && (
                <div className="bg-[#FFD60A] text-amber-950 text-[10px] md:text-[12px] font-bold min-w-[16px] md:min-w-[20px] h-4 md:h-5 px-1 md:px-1.5 flex items-center justify-center rounded-md shadow-md ring-1 ring-[#FFD60A]/50 z-30" style={{ boxShadow: '0 0 6px #FFD60A88' }} title={t('sidebar.pending')}>
                  {kanbanTodoCount}
                </div>
              )}
              {kanbanInProgressCount > 0 && (
                <div className="bg-[#38BDF8] text-sky-950 text-[10px] md:text-[12px] font-bold min-w-[16px] md:min-w-[20px] h-4 md:h-5 px-1 md:px-1.5 flex items-center justify-center rounded-md shadow-md ring-1 ring-[#38BDF8]/50 z-20" style={{ boxShadow: '0 0 6px #38BDF888' }} title={t('sidebar.in_progress')}>
                  {kanbanInProgressCount}
                </div>
              )}
            </div>
          )}
        </button>

        {/* Translator Button */}
        <button
          onClick={() => setGlobalView('translator')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all shrink-0 ${getAppStyle('translator')}`}
          title={t('sidebar.translator')}
        >
          <Languages size={20} />
        </button>

        {/* TikTok Button */}
        <button
          onClick={() => setGlobalView('tiktok')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all shrink-0 ${getAppStyle('tiktok')}`}
          title="TikTok a Notas"
        >
          <Play size={20} />
        </button>

        {/* BrainDump Button */}
        <button
          onClick={() => setGlobalView('braindump')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all shrink-0 ${getAppStyle('braindump')}`}
          title={t('sidebar.braindump')}
        >
          <PenTool size={20} />
        </button>

        <div className="w-6 h-px bg-zinc-200 dark:bg-zinc-800/80 rounded-full shrink-0"></div>

        {/* New Group Button */}
        <button
          onClick={onAddGroup}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/80 shadow-sm hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all duration-300 shrink-0 hover:scale-105 active:scale-95"
          title={t('sidebar.new_group')}
        >
          <Plus size={18} />
        </button>

        {/* Launcher Button */}
        <button 
          onClick={() => setIsLauncherOpen(true)}
          className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-indigo-500/80 text-zinc-500 hover:border-indigo-400/60 dark:hover:border-[#3D3E89]/60 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 shrink-0"
          title={t('sidebar.launcher')}
        >
          <Grid size={20} />
        </button>

        <div className="w-6 h-px bg-zinc-200 dark:bg-zinc-800/80 rounded-full shrink-0"></div>

        {/* CONTENEDOR DE GRUPOS DOCKED */}
        <div className="relative flex-1 w-full flex flex-col group/sidebar min-h-0 min-w-0">
          
          <div className={`absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-zinc-50 dark:from-[#112240] to-transparent z-10 flex items-start justify-center pt-1 pointer-events-none transition-opacity duration-200 ${canScrollUp ? 'opacity-100' : 'opacity-0'}`}>
            <button 
              onClick={() => scrollGroups('up')} 
              className={`p-1 rounded-full bg-white dark:bg-[#1A2437] border border-zinc-200 dark:border-[#2D2D42] shadow-md text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-95 ${canScrollUp ? 'pointer-events-auto' : 'pointer-events-none'}`}
            >
              <ChevronUp size={14} />
            </button>
          </div>

          <div 
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="flex flex-col gap-4 w-full items-center flex-1 overflow-y-auto hidden-scrollbar pt-2 pb-2 scroll-smooth"
          >
          {sortedDockedGroups.map((group) => {
            const isGroupActive = activeGroupId === group.id;
            const isGroupLastUsed = lastActiveGroupId === group.id;
            const isNotesView = globalView === 'notes';
            const focusedNoteIsDocked = focusedNoteId ? group.notes?.some(n => n.id === focusedNoteId && n.is_docked) : false;

            return (
            <div key={group.id} data-sidebar-group-id={group.id} className="flex flex-col items-center shrink-0">
              <div className="relative group w-10 md:w-12">
                {/* Close Button (Hover) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeGroup(group.id);
                  }}
                  className="absolute top-0 right-0 z-20 w-4 h-4 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-500/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm text-[10px] hover:scale-110 active:scale-95"
                  title={t('sidebar.close_dock')}
                >
                  <X size={12} />
                </button>

                <button
                  onClick={() => {
                    onSelectGroup(group.id);
                    setGlobalView('notes');
                    setSidebarFocusMode('group');
                  }}
                  data-sidebar-active={isGroupActive && (globalView === 'notes' || globalView === 'kanban') && sidebarFocusMode === 'group' ? 'true' : undefined}
                  className={`relative flex items-center justify-center w-full transition-all duration-300 overflow-hidden rounded-xl border group/dockedbtn active:scale-95
                    ${isGroupActive && isNotesView && sidebarFocusMode === 'group'
                      ? 'h-32 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/80 shadow-sm scale-[1.02]'
                      : isGroupActive && (!isNotesView || sidebarFocusMode === 'note')
                        ? 'h-32 bg-white dark:bg-[#1A2437] border-zinc-300 dark:border-indigo-500/80 text-zinc-700 dark:text-zinc-200 shadow-sm hover:border-indigo-400/60 dark:hover:border-[#3D3E89]/60 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 hover:scale-[1.04]'
                        : isGroupLastUsed
                          ? 'h-24 bg-white dark:bg-[#1A2437] border-zinc-300 dark:border-indigo-500/80 text-zinc-700 dark:text-zinc-200 shadow-sm hover:border-indigo-400/60 dark:hover:border-[#3D3E89]/60 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 hover:scale-[1.04]'
                          : 'h-24 bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-indigo-500/80 text-zinc-500 hover:border-indigo-400/60 dark:hover:border-[#3D3E89]/60 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-sm hover:scale-[1.04]'}
                  `}
                  title={group.title}
                >
                  <div className="absolute top-1.5 w-4 h-[3px] rounded-full bg-current opacity-30"></div>
                  <span className="writing-vertical-rl rotate-180 text-xs font-normal tracking-widest uppercase truncate max-h-[85%] py-1">
                    {group.title}
                  </span>
                </button>
              </div>

              {(() => {
                const dockedNotes = group.notes?.filter(n => n.is_docked) || [];
                if (dockedNotes.length === 0) return null;

                return (
                  <div className="flex flex-col items-center gap-2 mt-2 mb-1">
                    {dockedNotes.map(note => {
                      const isFocused = note.id === focusedNoteId;
                      const isActiveFocus = isFocused && isNotesView && sidebarFocusMode === 'note';
                      
                      const bubbleClass = isActiveFocus
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/40 shadow-sm scale-[1.15]'
                        : isGroupActive || (isFocused && isNotesView && sidebarFocusMode === 'group')
                          ? 'bg-white dark:bg-[#1A2437] border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 shadow-sm hover:border-indigo-400/60 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:border-[#3D3E89]/60 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 hover:scale-110'
                          : 'bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-indigo-400/60 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:border-[#3D3E89]/60 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 hover:shadow-sm hover:scale-110';

                      const linkedTask = globalTasks?.find(t => t.id === note.id);
                      let dotColorClass = null;
                      if (linkedTask) {
                          switch (linkedTask.status) {
                              case 'backlog': dotColorClass = { bg: 'bg-[#9E9E9E]', hex: '#9E9E9E' }; break;
                              case 'todo': dotColorClass = { bg: 'bg-[#FFD60A]', hex: '#FFD60A' }; break;
                              case 'in_progress': dotColorClass = { bg: 'bg-[#38BDF8]', hex: '#38BDF8' }; break;
                              case 'done': dotColorClass = { bg: 'bg-[#4ADE80]', hex: '#4ADE80' }; break;
                          }
                      }

                      return (
                        <div key={note.id} className="relative group/bubble">
                          <button
                            onClick={() => {
                              onSelectDockedNote(group.id, note.id);
                              setSidebarFocusMode('note');
                            }}
                            data-sidebar-active={isActiveFocus ? 'true' : undefined}
                            className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] font-bold uppercase transition-all duration-200 active:scale-95 ${bubbleClass}`}
                            title={note.title || 'Sin título'}
                          >
                            {note.title ? note.title.substring(0, 2) : <StickyNote size={12} />}
                          </button>
                          
                          {dotColorClass && (
                              <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border border-white dark:border-[#112240] z-10 shadow-sm transition-transform hover:scale-110 ${(dotColorClass as any).bg}`} style={{ boxShadow: `0 0 6px ${(dotColorClass as any).hex}88` }} title={`Estado Kanban`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            );
          })}
          </div>

          <div className={`absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-zinc-50 dark:from-[#112240] to-transparent z-10 flex items-end justify-center pb-1 pointer-events-none transition-opacity duration-200 ${canScrollDown ? 'opacity-100' : 'opacity-0'}`}>
            <button 
              onClick={() => scrollGroups('down')} 
              className={`p-1 rounded-full bg-white dark:bg-[#1A2437] border border-zinc-200 dark:border-[#2D2D42] shadow-md text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-95 ${canScrollDown ? 'pointer-events-auto' : 'pointer-events-none'}`}
            >
              <ChevronDown size={14} />
            </button>
          </div>
        </div>

        {/* Bottom Area: Settings & Logout */}
        <div className="mt-auto pt-3 shrink-0 flex flex-col items-center gap-3">
          <div className="w-6 h-px bg-zinc-200 dark:bg-zinc-800/80 rounded-full"></div>
          <button
            onClick={onOpenSettings}
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-indigo-400/60 dark:hover:border-[#3D3E89]/60 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm transition-all duration-300 hover:scale-105 active:scale-95"
            title="Configuración"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={onLogout}
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-red-500/40 dark:hover:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 shadow-sm transition-all duration-300 hover:scale-105 active:scale-95"
            title="Cerrar Sesión"
          >
            <LogOut size={18} />
          </button>
        </div>

      </div>

      <GroupLauncher
        groups={groups}
        isOpen={isLauncherOpen}
        onClose={() => setIsLauncherOpen(false)}
        onTogglePin={onTogglePin}
        onToggleFavorite={onToggleFavorite}
      />
    </>
  );
};
