import React, { useState } from 'react';
import { Plus, Settings, Grid, X } from 'lucide-react';
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  groups,
  activeGroupId,
  onSelectGroup,
  onAddGroup,
  onOpenSettings,
  onTogglePin,
}) => {
  const { dockedGroupIds, closeGroup } = useUIStore();
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
      <div className="w-16 md:w-20 bg-slate-200 dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800 flex flex-col items-center py-4 gap-4 h-full shrink-0 z-40 overflow-hidden">

        {/* Launcher Button (Top) */}
        <button
          onClick={() => setIsLauncherOpen(true)}
          className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 hover:scale-105 transition-all mb-2 shrink-0"
          title="Abrir Launcher de Grupos"
        >
          <Grid size={24} />
        </button>

        <div className="w-10 h-0.5 bg-slate-300 dark:bg-slate-700 rounded-full mb-1 shrink-0"></div>

        {/* Docked Groups List */}
        <div className="flex flex-col gap-3 w-full items-center flex-1 overflow-y-auto hidden-scrollbar py-2">
          {/* New Group Button (Quick Add) */}
          <button
            onClick={onAddGroup}
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-400 dark:border-slate-700 text-slate-400 dark:text-slate-600 hover:border-indigo-500 hover:text-indigo-500 transition-colors shrink-0"
            title="Crear Nuevo Grupo"
          >
            <Plus size={20} />
          </button>

          {/* Separator if we have groups */}
          {sortedDockedGroups.length > 0 && <div className="w-6 h-px bg-slate-300 dark:bg-slate-800 shrink-0"></div>}

          {sortedDockedGroups.map((group) => (
            <div key={group.id} className="relative group w-12 md:w-14 shrink-0">
              {/* Close Button (Hover) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeGroup(group.id);
                }}
                className="absolute -top-1 -right-1 z-20 w-5 h-5 bg-slate-500 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md text-xs"
                title="Cerrar del Dock"
              >
                <X size={12} />
              </button>

              <button
                onClick={() => onSelectGroup(group.id)}
                className={`
                    relative flex items-center justify-center w-full transition-all duration-300 overflow-hidden
                    ${activeGroupId === group.id
                    ? 'h-32 bg-white dark:bg-slate-800 text-indigo-600 shadow-md ring-2 ring-indigo-500/50'
                    : 'h-14 bg-slate-300 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-400 dark:hover:bg-slate-700'}
                    rounded-lg
                    `}
                title={group.title}
              >
                {/* Active State Details */}
                {activeGroupId === group.id ? (
                  <>
                    <div className="absolute top-2 w-8 h-1 rounded-full bg-indigo-200 dark:bg-indigo-900/50"></div>
                    <span className="writing-vertical-rl rotate-180 text-sm font-bold tracking-wide uppercase truncate max-h-[80%] py-2">
                      {group.title}
                    </span>
                  </>
                ) : (
                  <span className="text-lg font-bold uppercase">
                    {group.title.substring(0, 2)}
                  </span>
                )}

                {/* Active Indicator Dot */}
                {activeGroupId === group.id && (
                  <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-indigo-500 rounded-l-full"></div>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Bottom Area: Settings */}
        <div className="mt-auto pt-4 shrink-0 flex flex-col items-center gap-2">
          <div className="w-10 h-0.5 bg-slate-300 dark:bg-slate-700 rounded-full"></div>
          <button
            onClick={onOpenSettings}
            className="w-12 h-12 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-800 transition-colors"
            title="Configuración"
          >
            <Settings size={22} />
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
