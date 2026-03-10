import React, { useState } from 'react';
import { Loader2, Sparkles, X, ChevronDown, ArrowUpRight, RefreshCw } from 'lucide-react';
import { useSummaries } from '../src/lib/useSummaries';

interface NoteAIPanelProps {
  noteId: string;
  userId: string;
  noteStatus: string;
  onPromoteToNote?: (content: string, title: string) => void;
}

export const NoteAIPanel: React.FC<NoteAIPanelProps> = ({
  noteId,
  userId,
  noteStatus,
  onPromoteToNote,
}) => {
  const [objectiveInput, setObjectiveInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const { summaries, generateSummary, deleteSummary } = useSummaries(noteId);

  const completed = summaries.filter(s => s.status === 'completed');
  const pending = summaries.filter(s => s.status === 'pending' || s.status === 'processing');
  const selected = completed[selectedIdx] ?? null;

  const handleGenerate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    await generateSummary(objectiveInput.trim());
    setObjectiveInput('');
    setSelectedIdx(0);
    setIsCreating(false);
  };

  const handleDelete = (id: string) => {
    deleteSummary(id);
    setSelectedIdx(0);
  };

  const handlePromote = () => {
    if (!selected || !onPromoteToNote) return;
    const title = selected.target_objective
      ? `✨ ${selected.target_objective.slice(0, 50)}`
      : `✨ Nota AI`;
    onPromoteToNote(selected.content, title);
  };

  return (
    <div className="flex flex-col gap-3">

      {/* Estado motor */}
      {noteStatus === 'queued' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <Loader2 size={12} className="animate-spin text-amber-400" />
          <span className="text-xs font-bold text-amber-400">En cola — esperando motor AI</span>
        </div>
      )}
      {noteStatus === 'processing' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-xl">
          <Loader2 size={12} className="animate-spin text-violet-400" />
          <span className="text-xs font-bold text-violet-400">Motor AI procesando...</span>
        </div>
      )}

      {/* Input + Generar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={objectiveInput}
          onChange={e => setObjectiveInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
          placeholder="¿Qué quieres analizar de esta nota?"
          className="flex-1 min-w-0 bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 transition-all"
        />
        <button
          onClick={handleGenerate}
          disabled={isCreating}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all active:scale-95 whitespace-nowrap"
        >
          {isCreating
            ? <Loader2 size={15} className="animate-spin" />
            : <Sparkles size={15} />}
          Generar
        </button>
      </div>

      {/* Jobs en curso */}
      {pending.map(s => (
        <div key={s.id} className="flex items-center gap-3 px-4 py-3 bg-violet-500/10 border border-violet-500/20 rounded-xl">
          <Loader2 size={13} className="animate-spin text-violet-400 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-violet-400">
              {s.status === 'processing' ? '⚙️ Procesando...' : '⏳ En cola...'}
            </span>
            {s.target_objective && (
              <span className="text-[11px] text-zinc-500 truncate">{s.target_objective}</span>
            )}
          </div>
        </div>
      ))}

      {/* Chips de acceso rápido */}
      {completed.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {completed.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setSelectedIdx(idx)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                selectedIdx === idx
                  ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-500/20'
                  : 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-violet-500/50 hover:text-violet-400'
              }`}
            >
              <Sparkles size={10} />
              <span className="max-w-[120px] truncate">
                {s.target_objective || `Análisis ${completed.length - idx}`}
              </span>
              <span className="opacity-50 font-normal">
                {new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Resumen protagonista */}
      {selected && (
        <div className="group bg-zinc-50 dark:bg-[#1A1A2E] border border-violet-500/20 rounded-2xl overflow-hidden">

          {/* Barra de acciones */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-violet-500/5 border-b border-violet-500/10">
            <div className="flex items-center gap-2">
              <Sparkles size={12} className="text-violet-400" />
              <span className="text-[11px] font-bold text-violet-400">
                {selected.target_objective || 'Análisis AI'}
              </span>
              <span className="text-[10px] text-zinc-500">
                {new Date(selected.created_at).toLocaleDateString('es-ES', {
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {onPromoteToNote && (
                <button
                  onClick={handlePromote}
                  title="Convertir en nueva nota"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                >
                  <ArrowUpRight size={13} />
                  Nueva nota
                </button>
              )}
              <button
                onClick={() => handleDelete(selected.id)}
                title="Eliminar este análisis"
                className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Contenido */}
          <div className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {selected.content}
          </div>
        </div>
      )}
    </div>
  );
};