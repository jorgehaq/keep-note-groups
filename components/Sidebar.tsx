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
      <div className="w-16 md:w-20 bg-zinc-200 dark:bg-zinc-900 border-r border-zinc-300 dark:border-zinc-800 flex flex-col items-center py-4 gap-4 h-full shrink-0 z-40 overflow-hidden">

        {/* Launcher Button (Top) */}
        <button
          onClick={() => setIsLauncherOpen(true)}
          className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-xl bg-[#1F3760] text-white shadow-lg shadow-[#1F3760]/30 hover:bg-[#152643] hover:scale-105 transition-all mb-2 shrink-0"
          title="Abrir Launcher de Grupos"
        >
          <Grid size={24} />
        </button>

        <div className="w-10 h-0.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mb-1 shrink-0"></div>

        {/* Docked Groups List */}
        <div className="flex flex-col gap-3 w-full items-center flex-1 overflow-y-auto hidden-scrollbar py-2">
          {/* New Group Button (Quick Add) */}
          <button
            onClick={onAddGroup}
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-lg bg-[#1F3760] text-white shadow-md hover:bg-[#152643] transition-all shrink-0 focus:outline-none focus:ring-2 focus:ring-[#1F3760]/50"
            title="Crear Nuevo Grupo"
          >
            <Plus size={20} />
          </button>

          {/* Separator if we have groups */}
          {sortedDockedGroups.length > 0 && <div className="w-6 h-px bg-zinc-300 dark:bg-zinc-800 shrink-0"></div>}

          {sortedDockedGroups.map((group) => (
            <div key={group.id} className="relative group w-12 md:w-14 shrink-0">
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
                onClick={() => onSelectGroup(group.id)}
                className={`
                    relative flex items-center justify-center w-full transition-all duration-300 overflow-hidden
                    ${activeGroupId === group.id
                    ? 'h-32 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md ring-2 ring-zinc-300 dark:ring-zinc-500'
                    : 'h-14 bg-zinc-200 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-800'}
                    rounded-lg
                    `}
                title={group.title}
              >
                {/* Active State Details */}
                {activeGroupId === group.id ? (
                  <>
                    <div className="absolute top-2 w-8 h-1 rounded-full bg-zinc-200 dark:bg-zinc-600"></div>
                    <span className="writing-vertical-rl rotate-180 text-sm font-bold tracking-wide uppercase truncate max-h-[80%] py-2">
                      {group.title}
                    </span>
                  </>
                ) : (
                  <span className="text-lg font-bold uppercase">
                    {group.title.substring(0, 2)}
                  </span>
                )}

                {/* Active Indicator Dot - Removed for cleaner look or kept as neutral? 
                   Let's keep it but neutral or remove. The ring is enough. 
                   Let's remove the dot as per "monochromatic and clean" preference.
                   Or make it black/white? 
                   Let's remove it for now to match "Gemini/Notion" cleanliness.
                */}
              </button>
            </div>
          ))}
        </div>

        {/* Bottom Area: Settings */}
        <div className="mt-auto pt-4 shrink-0 flex flex-col items-center gap-2">
          <div className="w-10 h-0.5 bg-zinc-300 dark:bg-zinc-700 rounded-full"></div>
          <button
            onClick={onOpenSettings}
            className="w-12 h-12 flex items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-colors"
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
