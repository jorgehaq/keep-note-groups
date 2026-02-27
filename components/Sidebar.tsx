import React, { useState } from 'react';
import { Plus, Settings, Grid, X, LogOut, StickyNote, KanbanSquare, Clock, Bell, Zap, Languages } from 'lucide-react';
import { Group } from '../types';
import { GroupLauncher } from './GroupLauncher';
import { useUIStore } from '../src/lib/store';

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
      return 'bg-[#1F3760] text-white shadow-lg shadow-[#1F3760]/30 ring-2 ring-white/30';
    }

    // ESTADO 2: RECIÉN PERDIÓ EL FOCO (Gris Medio) - Fue la última app en la que estuviste
    if (lastUsedApp === appId) {
      return 'bg-zinc-400 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-inner ring-1 ring-zinc-500/20';
    }

    // ESTADO 3: MUERTO / INACTIVO (Gris Oscuro)
    return 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-400 dark:hover:bg-zinc-700';
  };

  return (
    <>
      <div className="w-12 md:w-16 bg-zinc-200 dark:bg-zinc-900 border-r border-zinc-300 dark:border-zinc-800 flex flex-col items-center py-3 gap-3 h-full shrink-0 z-50 overflow-visible">

        {/* Timer Button with Badge */}
        <button
          onClick={() => setGlobalView('timers')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all mb-1 shrink-0 ${getAppStyle('timers')}`}
          title="Cronómetros"
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

        {/* Reminders Button */}
        <button
          onClick={() => setGlobalView('reminders')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all mb-1 shrink-0 ${getAppStyle('reminders')}`}
          title="Recordatorios"
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

        {/* Kanban Button */}
        <button
          onClick={() => setGlobalView('kanban')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all mb-1 shrink-0 ${getAppStyle('kanban')}`}
          title="Tablero Kanban"
        >
          <KanbanSquare size={20} />
          {(kanbanTodoCount > 0 || kanbanInProgressCount > 0 || kanbanDoneCount > 0) && (
            <div className="absolute -top-2 -right-8 flex items-center gap-0.5 shadow-sm">
              {kanbanTodoCount > 0 && (
                <div className="bg-blue-500 text-white text-[12px] font-bold min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-md shadow-md ring-1 ring-blue-600/50 z-30" title="Pendientes">
                  {kanbanTodoCount}
                </div>
              )}
              {kanbanInProgressCount > 0 && (
                <div className="bg-amber-500 text-white text-[12px] font-bold min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-md shadow-md ring-1 ring-amber-600/50 z-20" title="En Proceso">
                  {kanbanInProgressCount}
                </div>
              )}
              {kanbanDoneCount > 0 && (
                <div className="bg-emerald-500 text-white text-[12px] font-bold min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-md shadow-md ring-1 ring-emerald-600/50 z-10" title="Terminados">
                  {kanbanDoneCount}
                </div>
              )}
            </div>
          )}
        </button>

        {/* BrainDump Button (El Rayo) */}
        <button
          onClick={() => setGlobalView('braindump')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all mb-1 shrink-0 ${getAppStyle('braindump')}`}
          title="Patio de Recreo mental (Rayo)"
        >
          <Zap size={20} />
        </button>

        {/* Translator Button */}
        <button
          onClick={() => setGlobalView('translator')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all mb-1 shrink-0 ${getAppStyle('translator')}`}
          title="Traductor AI"
        >
          <Languages size={20} />
        </button>

        {/* Launcher Button */}
        <button
          onClick={() => setIsLauncherOpen(true)}
          className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-zinc-300 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-400 dark:hover:bg-zinc-700 transition-all mb-1 shrink-0"
          title="Abrir Launcher de Grupos"
        >
          <Grid size={20} />
        </button>

        <div className="w-8 h-0.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mb-1 shrink-0"></div>

        {/* Docked Groups List */}
        <div className="flex flex-col gap-3 w-full items-center flex-1 overflow-y-auto hidden-scrollbar py-2">
          {/* New Group Button (Quick Add) */}
          <button
            onClick={onAddGroup}
            className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg bg-[#1F3760] text-white shadow-md hover:bg-[#152643] transition-all shrink-0 focus:outline-none focus:ring-2 focus:ring-[#1F3760]/50"
            title="Crear Nuevo Grupo"
          >
            <Plus size={18} />
          </button>

          {/* Separator if we have groups */}
          {sortedDockedGroups.length > 0 && <div className="w-6 h-px bg-zinc-300 dark:bg-zinc-800 shrink-0"></div>}

          {sortedDockedGroups.map((group) => (
            <div key={group.id} className="flex flex-col items-center shrink-0">
              <div className="relative group w-10 md:w-12">
                {/* Close Button (Hover) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeGroup(group.id);
                  }}
                  className="absolute -top-1 -right-1 z-20 w-5 h-5 bg-zinc-500 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md text-xs"
                  title="Cerrar del Dock"
                >
                  <X size={12} />
                </button>

                <button
                  onClick={() => {
                    onSelectGroup(group.id);
                    setGlobalView('notes');
                  }}
                  className={`
                    relative flex items-center justify-center w-full transition-all duration-300 overflow-hidden rounded-lg
                    ${activeGroupId === group.id && !focusedNoteId && globalView === 'notes'
                      ? 'h-32 bg-[#1F3760] text-white shadow-lg ring-2 ring-white/50 scale-[1.02]'
                      : activeGroupId === group.id && (focusedNoteId || globalView !== 'notes')
                        ? 'h-32 bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 shadow-inner'
                        : 'h-24 bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700'}
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
                      const isGroupActive = activeGroupId === group.id;
                      const isNotesView = globalView === 'notes';
                      const isFocused = note.id === focusedNoteId;

                      const isActiveFocus = isFocused && isNotesView;
                      const isTrailFocus = isFocused && !isNotesView;
                      const isGroupDefaultActive = isGroupActive && isNotesView && !focusedNoteId;
                      const isGroupDefaultTrail = isGroupActive && !isNotesView && !focusedNoteId;

                      const bubbleClass = isActiveFocus
                        ? 'bg-[#1F3760] text-white ring-2 ring-white/50 shadow-lg scale-110' // Activa enfocada
                        : isTrailFocus
                          ? 'bg-zinc-400 dark:bg-zinc-600 text-zinc-800 dark:text-zinc-100 shadow-inner scale-110' // Rastro enfocada
                          : isGroupDefaultActive
                            ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 ring-1 ring-zinc-300 dark:ring-zinc-600' // Activa sin enfocar
                            : isGroupDefaultTrail
                              ? 'bg-zinc-400 dark:bg-zinc-600 text-zinc-800 dark:text-zinc-100 shadow-inner' // Rastro sin enfocar (GRIS MEDIO)
                              : 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-400 dark:hover:bg-zinc-700'; // Muerta

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
          ))}
        </div>

        {/* Bottom Area: Settings */}
        <div className="mt-auto pt-3 shrink-0 flex flex-col items-center gap-1.5">
          <div className="w-8 h-0.5 bg-zinc-300 dark:bg-zinc-700 rounded-full"></div>
          <button
            onClick={onOpenSettings}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            title="Configuración"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={onLogout}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
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
