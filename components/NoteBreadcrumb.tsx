import React from 'react';
import { ChevronRight, FileText, Sparkles } from 'lucide-react';

interface BreadcrumbNode {
  id: string;
  title: string;
  focus_prompt: string | null;
  ai_generated: boolean;
  generation_status: string;
}

interface NoteBreadcrumbProps {
  path: BreadcrumbNode[];        // de raíz a nota activa
  activeNoteId: string;
  onNavigate: (noteId: string) => void;
}

export const NoteBreadcrumb: React.FC<NoteBreadcrumbProps> = ({ path, activeNoteId, onNavigate }) => {
  if (path.length <= 1) return null; // Solo mostrar si hay más de un nivel

  return (
    <div className="flex items-center gap-0.5 flex-wrap px-1 py-1.5 mb-2">
      {path.map((node, idx) => {
        const isActive = node.id === activeNoteId;
        const isLast = idx === path.length - 1;
        const label = node.ai_generated
          ? (node.focus_prompt?.slice(0, 30) || 'Resumen')
          : (node.title?.slice(0, 30) || 'Original');

        return (
          <React.Fragment key={node.id}>
            <button
              onClick={() => !isActive && onNavigate(node.id)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-violet-600/20 text-violet-300 cursor-default'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 cursor-pointer'
              }`}
            >
              {node.ai_generated
                ? <Sparkles size={10} className="shrink-0" />
                : <FileText size={10} className="shrink-0" />
              }
              <span className="max-w-[120px] truncate">{label}</span>
            </button>
            {!isLast && <ChevronRight size={12} className="text-zinc-700 shrink-0" />}
          </React.Fragment>
        );
      })}
    </div>
  );
};