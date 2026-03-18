import React, { useState, useRef, useEffect } from 'react';
import { Plus, Settings, Grid, X, LogOut, StickyNote, KanbanSquare, Clock, Bell, PenTool, Languages, ChevronUp, ChevronDown } from 'lucide-react';
import { Group } from '../types';
import { GroupLauncher } from './GroupLauncher';
import { useUIStore } from '../src/lib/store';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  groups: Group[]; // All groups (needed for Launcher)
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
  const { dockedGroupIds, closeGroup, globalView, setGlobalView, activeTimersCount, overdueRemindersCount, overdueRemindersList, imminentRemindersCount, lastAppView, kanbanTodoCount, kanbanInProgressCount, kanbanDoneCount, lastUsedApp, globalTasks, lastActiveNoteByGroup } = useUIStore();
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const { t } = useTranslation();

  // Filter groups to only show docked ones
  const dockedGroups = groups.filter(g => dockedGroupIds.includes(g.id));

  // Maintain order based on dockedGroupIds to prevent jumping when valid
  // (Optional: Re-sort dockedGroups based on index in dockedGroupIds if strict order is needed)
  const sortedDockedGroups = dockedGroupIds
    .map(id => groups.find(g => g.id === id))
    .filter((g): g is Group => !!g);

  const getAppStyle = (appId: string) => {
    // Identity mapping for each app
    const APP_IDENTITY: Record<string, { bg: string, hover: string, shadow: string, text: string }> = {
      notes: { bg: 'bg-[#4940D9]', hover: 'hover:bg-[#3D35C0]', shadow: 'shadow-[#4940D9]/30', text: 'text-white' },
      reminders: { bg: 'bg-[#1F3760]', hover: 'hover:bg-[#152643]', shadow: 'shadow-[#1F3760]/30', text: 'text-white' },
      timers: { bg: 'bg-[#2563EB]', hover: 'hover:bg-[#1D4ED8]', shadow: 'shadow-[#2563EB]/30', text: 'text-white' },
      kanban: { bg: 'bg-[#10B981]', hover: 'hover:bg-[#059669]', shadow: 'shadow-[#10B981]/30', text: 'text-emerald-950' },
      braindump: { bg: 'bg-[#FFD700]', hover: 'hover:bg-[#E5C100]', shadow: 'shadow-[#FFD700]/30', text: 'text-amber-950' },
      translator: { bg: 'bg-[#8B5CF6]', hover: 'hover:bg-[#7C3AED]', shadow: 'shadow-[#8B5CF6]/30', text: 'text-white' }
    };

    // ESTADO 1: ACTIVO (Color de Identidad) - Es la app que estás mirando en este momento exacto
    if (globalView === appId) {
      const identity = APP_IDENTITY[appId] || APP_IDENTITY.notes;
      return `${identity.bg} ${identity.hover} ${identity.text} shadow-md hover:shadow-lg hover:${identity.shadow} scale-105 active:scale-95 transition-all`;
    }

    // ESTADO 2: RECIÉN PERDIÓ EL FOCO (Gris Medio) - Fue la última app en la que estuviste
    if (lastUsedApp === appId) {
      return 'bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 shadow-inner ring-1 ring-zinc-400/30 hover:bg-white dark:hover:bg-zinc-600 hover:shadow-sm hover:ring-0 hover:scale-105 active:scale-95';
    }

    // ESTADO 3: MUERTO / INACTIVO (Gris Oscuro)
    return 'bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-700 hover:shadow-sm hover:scale-105 active:scale-95';
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      setCanScrollUp(scrollTop > 0);
      setCanScrollDown(Math.ceil(scrollTop + clientHeight) < scrollHeight - 1); // tolerance
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [sortedDockedGroups.length, globalView, activeGroupId, focusedNoteId]);

  const scrollGroups = (direction: 'up' | 'down') => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ top: direction === 'up' ? -150 : 150, behavior: 'smooth' });
    }
  };

  return (
    <>
      <div className="w-12 md:w-16 bg-zinc-200 dark:bg-[#13131A] border-r border-zinc-300 dark:border-[#2D2D42] flex flex-col items-center py-3 gap-4 h-full shrink-0 z-50 overflow-visible">

        {/* Reminders Button */}
        <button
          onClick={() => setGlobalView('reminders')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all shrink-0 ${getAppStyle('reminders')}`}
          title={t('sidebar.reminders')}
        >
          <Bell size={20} />
          {overdueRemindersList.length > 0 && (
            <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-[#DC2626] text-white brightness-110 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] text-[10px] md:text-[12px] font-bold min-w-[16px] md:min-w-[20px] h-4 md:h-5 px-1 md:px-1.5 flex items-center justify-center rounded-md shadow-md ring-1 ring-red-600/50 animate-pulse z-30"
              style={{ animationDuration: '1s' }}
            >
              {overdueRemindersList.length}
            </div>
          )}
        </button>

        {/* Timer Button with Badge */}
        <button
          onClick={() => setGlobalView('timers')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all shrink-0 ${getAppStyle('timers')}`}
          title={t('sidebar.timers')}
        >
          <Clock size={20} />
          {activeTimersCount > 0 && (
            <div
              className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-[#DC2626] text-white brightness-110 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] text-[10px] md:text-[12px] font-bold min-w-[16px] md:min-w-[20px] h-4 md:h-5 px-1 md:px-1.5 flex items-center justify-center rounded-md shadow-md ring-1 ring-red-600/50 animate-pulse z-30"
              style={{ animationDuration: '1s' }}
            >
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
          {(kanbanTodoCount > 0 || kanbanInProgressCount > 0 || kanbanDoneCount > 0) && (
            <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 flex items-center gap-px">
              {kanbanTodoCount > 0 && (
                <div 
                  className="bg-[#FBC02D] text-amber-950 text-[10px] md:text-[12px] font-bold min-w-[16px] md:min-w-[20px] h-4 md:h-5 px-1 md:px-1.5 flex items-center justify-center rounded-md shadow-md ring-1 ring-[#FBC02D]/50 z-30" 
                  title={t('sidebar.pending')}
                >
                  {kanbanTodoCount}
                </div>
              )}
              {kanbanInProgressCount > 0 && (
                <div 
                  className="bg-[#1E88E5] text-white brightness-110 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)] text-[10px] md:text-[12px] font-bold min-w-[16px] md:min-w-[20px] h-4 md:h-5 px-1 md:px-1.5 flex items-center justify-center rounded-md shadow-md ring-1 ring-[#1E88E5]/50 z-20" 
                  title={t('sidebar.in_progress')}
                >
                  {kanbanInProgressCount}
                </div>
              )}
              {kanbanDoneCount > 0 && (
                <div 
                  className="bg-[#43A047] text-white brightness-110 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)] text-[10px] md:text-[12px] font-bold min-w-[16px] md:min-w-[20px] h-4 md:h-5 px-1 md:px-1.5 flex items-center justify-center rounded-md shadow-md ring-1 ring-[#43A047]/50 z-10" 
                  title={t('sidebar.done')}
                >
                  {kanbanDoneCount}
                </div>
              )}
            </div>
          )}
        </button>

        {/* Botón Pizarrón */}
        <button
          onClick={() => setGlobalView('braindump')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all shrink-0 ${getAppStyle('braindump')}`}
          title={t('sidebar.braindump')}
        >
          <PenTool size={20} />
        </button>

        {/* Translator Button */}
        <button
          onClick={() => setGlobalView('translator')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all shrink-0 ${getAppStyle('translator')}`}
          title={t('sidebar.translator')}
        >
          <Languages size={20} />
        </button>

        <div className="w-8 h-0.5 bg-zinc-300 dark:bg-[#2D2D42] rounded-full shrink-0"></div>

        {/* New Group Button (Quick Add) */}
        <button
          onClick={onAddGroup}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-[#4940D9] hover:bg-[#3D35C0] text-white shadow-md hover:shadow-lg hover:shadow-[#4940D9]/30 transition-all duration-300 shrink-0 hover:scale-105 active:scale-95"
          title={t('sidebar.new_group')}
        >
          <Plus size={18} />
        </button>

        {/* Launcher Button */}
        <button
          onClick={() => setIsLauncherOpen(true)}
          className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 hover:bg-[#4940D9] dark:hover:bg-[#4940D9] hover:text-white dark:hover:text-white shadow-md hover:shadow-lg hover:shadow-[#4940D9]/30 transition-all duration-300 hover:scale-105 active:scale-95 shrink-0"
          title={t('sidebar.launcher')}
        >
          <Grid size={20} />
        </button>

        <div className="w-8 h-0.5 bg-zinc-300 dark:bg-[#2D2D42] rounded-full shrink-0"></div>

        {/* CONTENEDOR DE GRUPOS CON FLECHAS */}
        <div className="relative flex-1 w-full flex flex-col group/sidebar min-h-0 min-w-0">
          
          {/* Flecha Arriba */}
          {canScrollUp && (
            <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-zinc-200 dark:from-[#13131A] to-transparent z-10 flex items-start justify-center pt-1">
              <button onClick={() => scrollGroups('up')} className="p-1 rounded-full bg-white dark:bg-zinc-800 shadow-md text-zinc-500 hover:text-indigo-600 transition-colors">
                <ChevronUp size={16} />
              </button>
            </div>
          )}

          {/* Docked Groups List */}
          <div 
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="flex flex-col gap-4 w-full items-center flex-1 overflow-y-auto hidden-scrollbar pb-2 scroll-smooth"
          >
          {sortedDockedGroups.map((group) => {
            const isGroupActive = activeGroupId === group.id;
            const isNotesView = globalView === 'notes';
            const focusedNoteIsDocked = focusedNoteId ? group.notes?.some(n => n.id === focusedNoteId && n.is_docked) : false;

            return (
            <div key={group.id} className="flex flex-col items-center shrink-0">
              <div className="relative group w-10 md:w-12">
                {/* Close Button (Hover) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeGroup(group.id);
                  }}
                  className="absolute top-0 right-0 z-20 w-4 h-4 bg-zinc-500 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md text-[10px]"
                  title={t('sidebar.close_dock')}
                >
                  <X size={12} />
                </button>

                <button
                  onClick={() => {
                    onSelectGroup(group.id);
                    setGlobalView('notes');
                  }}
                  className={`
                    relative flex items-center justify-center w-full transition-all duration-300 overflow-hidden rounded-xl group/dockedbtn
                    ${isGroupActive && isNotesView && !focusedNoteIsDocked
                      ? 'h-32 bg-[#4940D9] hover:bg-[#3D35C0] text-white shadow-md hover:shadow-lg hover:shadow-[#4940D9]/30 scale-[1.02] active:scale-95'
                      : isGroupActive && (!isNotesView || focusedNoteIsDocked)
                        ? 'h-32 bg-zinc-300 dark:bg-[#2D2D42] text-zinc-700 dark:text-zinc-200 shadow-inner ring-1 ring-zinc-400/30 hover:bg-white dark:hover:bg-zinc-600 hover:shadow-sm hover:ring-0 hover:scale-[1.04] active:scale-95'
                        : 'h-24 bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-white dark:hover:bg-zinc-600 hover:shadow-sm hover:scale-[1.04] active:scale-95'}
                    `}
                  title={group.title}
                >
                  <div className="absolute top-1.5 w-6 h-0.5 rounded-full bg-current opacity-30"></div>
                  <span className="writing-vertical-rl rotate-180 text-xs font-normal tracking-wide uppercase truncate max-h-[85%] py-1">
                    {group.title}
                  </span>
                </button>
              </div>

              {/* Docked Notes for this Group */}
              {(() => {
                const dockedNotes = group.notes?.filter(n => n.is_docked) || [];
                if (dockedNotes.length === 0) return null;

                return (
                  <div className="flex flex-col items-center gap-1.5 mt-1.5 mb-1">
                    {dockedNotes.map(note => {

                      // LOGICA DE COLOR Y RASTRO
                      const isFocused = note.id === focusedNoteId;
                      const isActiveFocus = isFocused && isNotesView;
                      
                      const bubbleClass = isActiveFocus
                        ? 'bg-[#4940D9] hover:bg-[#3D35C0] text-white shadow-md hover:shadow-lg hover:shadow-[#4940D9]/30 scale-[1.15] active:scale-95' // Activa enfocada
                        : isGroupActive
                          ? 'bg-zinc-300 dark:bg-[#2D2D42] text-zinc-700 dark:text-zinc-200 shadow-inner ring-1 ring-zinc-400/30 hover:bg-white dark:hover:bg-zinc-600 hover:shadow-sm hover:ring-0 hover:scale-110 active:scale-95' // Parte de grupo activo o rastro (Gris Medio)
                          : 'bg-zinc-200/80 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-white dark:hover:bg-zinc-600 hover:shadow-sm hover:scale-110 active:scale-95'; // Muerta / Inactiva

                      // NUEVO: LÓGICA DEL SEMÁFORO KANBAN
                      const linkedTask = globalTasks?.find(t => t.id === note.id);
                      let dotColorClass = null;
                      
                      if (linkedTask) {
                          switch (linkedTask.status) {
                              case 'backlog': dotColorClass = 'bg-[#9E9E9E]'; break;
                              case 'todo': dotColorClass = 'bg-[#FBC02D]'; break;
                              case 'in_progress': dotColorClass = 'bg-[#1E88E5]'; break;
                              case 'done': dotColorClass = 'bg-[#43A047]'; break;
                              // 'archived' ignora el color como solicitaste
                          }
                      }

                      return (
                        <div key={note.id} className="relative group/bubble">
                          <button
                            onClick={() => onSelectDockedNote(group.id, note.id)}
                            className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] font-normal uppercase transition-all duration-200 ${bubbleClass}`}
                            title={note.title || 'Sin título'}
                          >
                            {note.title ? note.title.substring(0, 2) : <StickyNote size={12} />}
                          </button>
                          
                          {/* El punto flotante del Kanban */}
                          {dotColorClass && (
                              <div 
                                className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border border-[#9F9FA8]/50 z-10 shadow-sm transition-transform hover:scale-110 ${dotColorClass}`} 
                                title={`Estado Kanban`}
                              />
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

          {/* Flecha Abajo */}
          {canScrollDown && (
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-zinc-200 dark:from-[#13131A] to-transparent z-10 flex items-end justify-center pb-1">
              <button onClick={() => scrollGroups('down')} className="p-1 rounded-full bg-white dark:bg-zinc-800 shadow-md text-zinc-500 hover:text-indigo-600 transition-colors">
                <ChevronDown size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Bottom Area: Settings */}
        <div className="mt-auto pt-3 shrink-0 flex flex-col items-center gap-4">
          <div className="w-8 h-0.5 bg-zinc-300 dark:bg-[#2D2D42] rounded-full"></div>
          <button
            onClick={onOpenSettings}
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 hover:shadow-sm transition-all duration-300 hover:scale-105 active:scale-95"
            title="Configuración"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={onLogout}
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 hover:shadow-sm transition-all duration-300 hover:scale-105 active:scale-95"
            title="Cerrar Sesión"
          >
            <LogOut size={18} />
          </button>
        </div>

      </div>

      {/* Launcher Modal */}
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
