import React, { useState } from 'react';
import { Plus, Settings, Grid, X, LogOut, StickyNote, KanbanSquare, Clock, Bell, Zap } from 'lucide-react';
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
  const { dockedGroupIds, closeGroup, globalView, setGlobalView, activeTimersCount, overdueRemindersCount, imminentRemindersCount } = useUIStore();
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);

  // Filter groups to only show docked ones
  const dockedGroups = groups.filter(g => dockedGroupIds.includes(g.id));

  // Maintain order based on dockedGroupIds to prevent jumping when valid
  // (Optional: Re-sort dockedGroups based on index in dockedGroupIds if strict order is needed)
  const sortedDockedGroups = dockedGroupIds
    .map(id => groups.find(g => g.id === id))
    .filter((g): g is Group => !!g);

  return (
    <>
      <div className="w-12 md:w-16 bg-zinc-200 dark:bg-zinc-900 border-r border-zinc-300 dark:border-zinc-800 flex flex-col items-center py-3 gap-3 h-full shrink-0 z-40 overflow-hidden">

        {/* Global Apps */}
        <button
          onClick={() => setGlobalView('kanban')}
          className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all mb-1 shrink-0 ${globalView === 'kanban'
            ? 'bg-[#1F3760] text-white shadow-lg shadow-[#1F3760]/30 ring-2 ring-white/30'
            : 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-400 dark:hover:bg-zinc-700'
            }`}
          title="Tablero Kanban"
        >
          <KanbanSquare size={20} />
        </button>

        {/* Timer Button with Badge */}
        <button
          onClick={() => setGlobalView('timers')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all mb-1 shrink-0 ${globalView === 'timers'
            ? 'bg-[#1F3760] text-white shadow-lg shadow-[#1F3760]/30 ring-2 ring-white/30'
            : 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-400 dark:hover:bg-zinc-700'
            }`}
          title="Cronómetros"
        >
          <Clock size={20} />
          {activeTimersCount > 0 && (
            <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm">
              {activeTimersCount}
            </div>
          )}
        </button>

        {/* Reminders Button */}
        <button
          onClick={() => setGlobalView('reminders')}
          className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all mb-1 shrink-0 ${globalView === 'reminders'
            ? 'bg-[#1F3760] text-white shadow-lg shadow-[#1F3760]/30 ring-2 ring-white/30'
            : 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-400 dark:hover:bg-zinc-700'
            }`}
          title="Recordatorios"
        >
          <Bell size={20} />
          {overdueRemindersCount > 0 ? (
            <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm animate-pulse">
              {overdueRemindersCount}
            </div>
          ) : imminentRemindersCount > 0 ? (
            <div className="absolute -top-1 -right-1 bg-amber-500 text-amber-950 text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm">
              {imminentRemindersCount}
            </div>
          ) : null}
        </button>

        {/* BrainDump Button (El Rayo) */}
        <button
          onClick={() => setGlobalView('braindump')}
          className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all mb-1 shrink-0 ${globalView === 'braindump'
            ? 'bg-[#1F3760] text-white shadow-lg shadow-[#1F3760]/30 ring-2 ring-white/30'
            : 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-400 dark:hover:bg-zinc-700'
            }`}
          title="Patio de Recreo mental (Rayo)"
        >
          <Zap size={20} />
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
                    {dockedNotes.map(note => (
                      <button
                        key={note.id}
                        onClick={() => onSelectDockedNote(group.id, note.id)}
                        className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] font-semibold uppercase transition-all duration-200
                          ${note.id === focusedNoteId
                            ? 'bg-[#1F3760] text-white ring-2 ring-white/50 shadow-lg scale-110'
                            : activeGroupId === group.id
                              ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 ring-1 ring-zinc-300 dark:ring-zinc-600'
                              : 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-400 dark:hover:bg-zinc-700'
                          }`}
                        title={note.title || 'Sin título'}
                      >
                        {note.title ? note.title.substring(0, 2) : <StickyNote size={12} />}
                      </button>
                    ))}
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
