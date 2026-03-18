import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { BrainDump } from '../types';

interface BrainDumpBreadcrumbProps {
  path: BrainDump[];
  activeDumpId: string;
  onNavigate: (id: string | null) => void;
}

export const BrainDumpBreadcrumb: React.FC<BrainDumpBreadcrumbProps> = ({ path, activeDumpId, onNavigate }) => {
  if (path.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/30 dark:bg-transparent overflow-x-auto hidden-scrollbar shrink-0">
      <button
        onClick={() => onNavigate(path[0].id)}
        className="p-1 text-zinc-400 hover:text-amber-500 transition-colors shrink-0"
        title="Nivel Raíz"
      >
        <Home size={14} />
      </button>

      {path.map((dump, index) => (
        <React.Fragment key={dump.id}>
          <ChevronRight size={12} className="text-zinc-300 shrink-0" />
          <button
            onClick={() => onNavigate(dump.id)}
            disabled={dump.id === activeDumpId}
            className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap px-1.5 py-0.5 rounded transition-all ${
              dump.id === activeDumpId
                ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer'
            }`}
          >
            {dump.title || 'Pizarrón'}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};
