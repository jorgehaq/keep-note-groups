import React from 'react';
import { Plus, Settings } from 'lucide-react';
import { Group } from '../types';

interface SidebarProps {
  groups: Group[];
  activeGroupId: string | null;
  onSelectGroup: (id: string) => void;
  onAddGroup: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  groups,
  activeGroupId,
  onSelectGroup,
  onAddGroup,
  onOpenSettings,
}) => {
  return (
    <div className="w-16 md:w-20 bg-slate-200 dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800 flex flex-col items-center py-4 gap-4 h-full shrink-0 z-40 overflow-y-auto hidden-scrollbar">
      
      {/* Settings Button (Top or specific spot as requested) */}
      <button
        onClick={onOpenSettings}
        className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm transition-all hover:scale-105 mb-4"
        title="Configuración"
      >
        <Settings size={24} />
      </button>

      <div className="w-10 h-0.5 bg-slate-300 dark:bg-slate-700 rounded-full mb-2"></div>

      {/* Groups List */}
      <div className="flex flex-col gap-4 w-full items-center flex-1">
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => onSelectGroup(group.id)}
            className={`
              relative group flex items-center justify-center w-12 md:w-14 transition-all duration-300
              ${activeGroupId === group.id 
                ? 'h-40 bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
                : 'h-32 bg-slate-300 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-400 dark:hover:bg-slate-700'}
              rounded-lg
            `}
            title={group.title}
          >
            {/* Window/App aesthetic indicator */}
            <div className={`absolute top-2 w-8 h-1 rounded-full ${activeGroupId === group.id ? 'bg-white/30' : 'bg-slate-400/30'}`}></div>

            <span className="writing-vertical-rl rotate-180 text-sm font-bold tracking-wide uppercase truncate max-h-[80%]">
              {group.title}
            </span>
            
            {/* Active Indicator dot */}
            {activeGroupId === group.id && (
              <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-white rounded-l-full"></div>
            )}
          </button>
        ))}

        {/* Add Group Button */}
        <button
          onClick={onAddGroup}
          className="w-12 h-12 md:w-14 md:h-14 mt-2 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-400 dark:border-slate-700 text-slate-400 dark:text-slate-600 hover:border-indigo-500 hover:text-indigo-500 transition-colors"
          title="Crear Nuevo Grupo"
        >
          <Plus size={24} />
        </button>
      </div>
    </div>
  );
};
