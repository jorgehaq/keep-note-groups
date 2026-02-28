import React, { useState } from 'react';
import { Plus, Settings, Grid, X, LogOut, StickyNote, KanbanSquare, Clock, Bell, PenTool, Languages } from 'lucide-react';
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
  onLogout,
  onSelectDockedNote,
  focusedNoteId,
}) => {
  const { dockedGroupIds, closeGroup, globalView, setGlobalView, activeTimersCount, overdueRemindersCount, imminentRemindersCount, lastAppView, kanbanTodoCount, kanbanInProgressCount, kanbanDoneCount, lastUsedApp, globalTasks } = useUIStore();
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
    // ESTADO 1: ACTIVO (Azul) - Es la app que estás mirando en este momento exacto
    if (globalView === appId) {
      return 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] ring-2 ring-indigo-400/50 scale-105';
    }

    // ESTADO 2: RECIÉN PERDIÓ EL FOCO (Gris Medio) - Fue la última app en la que estuviste
    if (lastUsedApp === appId) {
      return 'bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 shadow-inner ring-1 ring-zinc-400/30 hover:bg-white dark:hover:bg-zinc-600 hover:shadow-sm hover:ring-0 hover:scale-105 active:scale-95';
    }

    // ESTADO 3: MUERTO / INACTIVO (Gris Oscuro)
    return 'bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-700 hover:shadow-sm hover:scale-105 active:scale-95';
  };

  return (
    <>
      <div className="w-12 md:w-16 bg-zinc-200 dark:bg-zinc-900 border-r border-zinc-300 dark:border-zinc-800 flex flex-col items-center py-3 gap-3 h-full shrink-0 z-50 overflow-visible">

        {/* Reminders Button */}
        <button
          onClick={() => setGlobalView('reminders')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all mb-1 shrink-0 ${getAppStyle('reminders')}`}
          title={t('sidebar.reminders')}
        >
          <Bell size={20} />
          {overdueRemindersCount > 0 ? (
            <div className="absolute -top-2 -right-2 bg-[#DC2626] text-white text-[12px] font-bold min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-md shadow-md ring-1 ring-red-600/50 animate-pulse z-30"
              style={{ animationDuration: '1s' }}
            >
              {overdueRemindersCount}
            </div>
          ) : imminentRemindersCount > 0 ? (
            <div className="absolute -top-2 -right-2 bg-[#FFFD55] text-[#451a03] text-[12px] font-bold min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-md shadow-md ring-1 ring-amber-500/50 animate-pulse z-30"
              style={{ animationDuration: '1s' }}
            >
              {imminentRemindersCount}
            </div>
          ) : null}
        </button>

        {/* Timer Button with Badge */}
        <button
          onClick={() => setGlobalView('timers')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all mb-1 shrink-0 ${getAppStyle('timers')}`}
          title={t('sidebar.timers')}
        >
          <Clock size={20} />
          {activeTimersCount > 0 && (
            <div
              className="absolute -top-2 -right-2 bg-[#DC2626] text-white text-[12px] font-bold min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-md shadow-md ring-1 ring-red-600/50 animate-pulse z-30"
              style={{ animationDuration: '1s' }}
            >
              {activeTimersCount}
            </div>
          )}
        </button>

        {/* Kanban Button */}
        <button
          onClick={() => setGlobalView('kanban')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all mb-1 shrink-0 ${getAppStyle('kanban')}`}
          title={t('sidebar.kanban')}
        >
          <KanbanSquare size={20} />
          {(kanbanTodoCount > 0 || kanbanInProgressCount > 0 || kanbanDoneCount > 0) && (
            <div className="absolute -top-2 -right-2 flex items-center gap-px">
              {kanbanTodoCount > 0 && (
                <div className="bg-blue-500 text-white text-[10px] font-bold min-w-[16px] h-4 px-1 flex items-center justify-center rounded-md shadow-md ring-1 ring-blue-600/50 z-30" title={t('sidebar.pending')}>
                  {kanbanTodoCount}
                </div>
              )}
              {kanbanInProgressCount > 0 && (
                <div className="bg-amber-500 text-white text-[10px] font-bold min-w-[16px] h-4 px-1 flex items-center justify-center rounded-md shadow-md ring-1 ring-amber-600/50 z-20" title={t('sidebar.in_progress')}>
                  {kanbanInProgressCount}
                </div>
              )}
              {kanbanDoneCount > 0 && (
                <div className="bg-emerald-500 text-white text-[10px] font-bold min-w-[16px] h-4 px-1 flex items-center justify-center rounded-md shadow-md ring-1 ring-emerald-600/50 z-10" title={t('sidebar.done')}>
                  {kanbanDoneCount}
                </div>
              )}
            </div>
          )}
        </button>

        {/* Botón Pizarrón */}
        <button
          onClick={() => setGlobalView('braindump')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all mb-1 shrink-0 ${getAppStyle('braindump')}`}
          title={t('sidebar.braindump')}
        >
          <PenTool size={20} />
        </button>

        {/* Translator Button */}
        <button
          onClick={() => setGlobalView('translator')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all mb-1 shrink-0 ${getAppStyle('translator')}`}
          title={t('sidebar.translator')}
        >
          <Languages size={20} />
        </button>

        <div className="w-8 h-0.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mb-1 shrink-0"></div>

        {/* New Group Button (Quick Add) */}
        <button
          onClick={onAddGroup}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800 text-white shadow-md hover:from-indigo-600 hover:to-indigo-700 hover:shadow-lg transition-all duration-300 shrink-0 hover:scale-105 active:scale-95 mb-1"
          title={t('sidebar.new_group')}
        >
          <Plus size={18} />
        </button>

        {/* Launcher Button */}
        <button
          onClick={() => setIsLauncherOpen(true)}
          className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all duration-300 hover:scale-105 active:scale-95 mb-1 shrink-0"
          title={t('sidebar.launcher')}
        >
          <Grid size={20} />
        </button>

        <div className="w-8 h-0.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mb-1 shrink-0"></div>

        {/* Docked Groups List */}
        <div className="flex flex-col gap-3 w-full items-center flex-1 overflow-y-auto hidden-scrollbar py-2">
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
                  className="absolute -top-1 -right-1 z-20 w-5 h-5 bg-zinc-500 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md text-xs"
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
                      ? 'h-32 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] ring-2 ring-indigo-400/50 scale-[1.02]'
                      : isGroupActive && (!isNotesView || focusedNoteIsDocked)
                        ? 'h-32 bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 shadow-inner ring-1 ring-zinc-400/30 hover:bg-white dark:hover:bg-zinc-600 hover:shadow-sm hover:ring-0 hover:scale-[1.04] active:scale-95'
                        : 'h-24 bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-white dark:hover:bg-zinc-600 hover:shadow-sm hover:scale-[1.04] active:scale-95'}
                    `}
                  title={group.title}
                >
                  <div className="absolute top-1.5 w-6 h-0.5 rounded-full bg-current opacity-30"></div>
                  <span className="writing-vertical-rl rotate-180 text-xs font-bold tracking-wide uppercase truncate max-h-[85%] py-1">
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
                        ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-[0_0_10px_rgba(99,102,241,0.5)] ring-2 ring-indigo-400/50 scale-[1.15]' // Activa enfocada (Azul)
                        : isGroupActive
                          ? 'bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 shadow-inner ring-1 ring-zinc-400/30 scale-105 hover:bg-white dark:hover:bg-zinc-600 hover:shadow-sm hover:ring-0 hover:scale-110 active:scale-95' // Parte de grupo activo o rastro (Gris Medio)
                          : 'bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-white dark:hover:bg-zinc-600 hover:shadow-sm hover:scale-110 active:scale-95'; // Muerta / Inactiva

                      // NUEVO: LÓGICA DEL SEMÁFORO KANBAN
                      const linkedTask = globalTasks?.find(t => t.id === note.id);
                      let dotColorClass = null;
                      
                      if (linkedTask) {
                          switch (linkedTask.status) {
                              case 'backlog': dotColorClass = 'bg-white dark:bg-zinc-200 ring-1 ring-zinc-300'; break;
                              case 'todo': dotColorClass = 'bg-blue-500'; break;
                              case 'in_progress': dotColorClass = 'bg-amber-500'; break;
                              case 'done': dotColorClass = 'bg-emerald-500'; break;
                              // 'archived' ignora el color como solicitaste
                          }
                      }

                      return (
                        <div key={note.id} className="relative group/bubble">
                          <button
                            onClick={() => onSelectDockedNote(group.id, note.id)}
                            className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] font-semibold uppercase transition-all duration-200 ${bubbleClass}`}
                            title={note.title || 'Sin título'}
                          >
                            {note.title ? note.title.substring(0, 2) : <StickyNote size={12} />}
                          </button>
                          
                          {/* El punto flotante del Kanban */}
                          {dotColorClass && (
                              <div 
                                className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border border-[#9F9FA8] z-10 shadow-sm transition-transform hover:scale-110 ${dotColorClass}`} 
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

        {/* Bottom Area: Settings */}
        <div className="mt-auto pt-3 shrink-0 flex flex-col items-center gap-1.5">
          <div className="w-8 h-0.5 bg-zinc-300 dark:bg-zinc-700 rounded-full"></div>
          <button
            onClick={onOpenSettings}
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 hover:shadow-sm transition-all duration-300 hover:scale-105 active:scale-95"
            title="Configuración"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={onLogout}
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 hover:shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 mb-2"
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
      />
    </>
  );
};
