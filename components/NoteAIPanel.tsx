import React, { useState } from 'react';
import { Loader2, Sparkles, X, RotateCcw, AlertCircle, MessageSquare } from 'lucide-react';
import { useSummaries, SummaryStatus } from '../src/lib/useSummaries';

interface NoteAIPanelProps {
  noteId: string;
  userId: string;
  noteStatus: string;
}

const STATUS_CONFIG: Record<SummaryStatus, { label: string; color: string; spinner: boolean }> = {
  pending:    { label: '⏳ En cola...',    color: 'text-amber-500',  spinner: true  },
  processing: { label: '⚙️ Procesando...', color: 'text-violet-400', spinner: true  },
  completed:  { label: '✨ Completado',     color: 'text-emerald-400', spinner: false },
  failed:     { label: '⚠️ Error',          color: 'text-red-400',     spinner: false },
};

/**
 * Función utilitaria para romper la regla de bloques de código en el renderizado.
 */
const neutralizeCodeBlocks = (text: string) => {
  if (!text) return '';
  return text.replace(/```/g, '`\u200B`\u200B`');
};

export const NoteAIPanel: React.FC<NoteAIPanelProps> = ({ noteId, userId, noteStatus }) => {
  const [objectiveInput, setObjectiveInput] = useState('');
  const { summaries, loading, generateSummary, deleteSummary } = useSummaries(noteId);
  const [isCreating, setIsCreating] = useState(false);

  const handleGenerate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    await generateSummary(objectiveInput.trim());
    setObjectiveInput('');
    setIsCreating(false);
  };

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800 mt-4 pt-4 space-y-4">
      {/* Badge estado de la nota */}
      {noteStatus === 'queued' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <Loader2 size={12} className="animate-spin text-amber-400" />
          <span className="text-xs font-bold text-amber-400">Nota en cola — esperando motor AI</span>
        </div>
      )}
      {noteStatus === 'processing' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-xl">
          <Loader2 size={12} className="animate-spin text-violet-400" />
          <span className="text-xs font-bold text-violet-400">Motor AI procesando esta nota...</span>
        </div>
      )}

      {/* Input de Objetivo + Botón Generar */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <Sparkles size={10} className="text-violet-500" />
          Enfoque del Resumen AI
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={objectiveInput}
            onChange={e => setObjectiveInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
            placeholder="¿Qué quieres resumir?"
            className="flex-1 min-w-0 bg-zinc-800/40 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/10 transition-all"
          />
          <button
            onClick={handleGenerate}
            disabled={isCreating}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-violet-900/20 whitespace-nowrap"
          >
            {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            <span>Generar Resumen</span>
          </button>
        </div>
      </div>

      {/* Lista de Resúmenes */}
      <div className="space-y-3">
        {loading && summaries.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-zinc-700" />
          </div>
        )}

        {summaries.map(summary => {
          const cfg = STATUS_CONFIG[summary.status];
          return (
            <div
              key={summary.id}
              className="group bg-zinc-800/30 border border-zinc-700/30 rounded-2xl p-4 transition-all hover:bg-zinc-800/40"
            >
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className={`flex items-center gap-1.5 text-[10px] b-fit font-bold px-2 py-1 rounded-full bg-zinc-900/50 ${cfg.color} border border-white/5 whitespace-nowrap`}>
                    {cfg.spinner && <Loader2 size={10} className="animate-spin" />}
                    {cfg.label}
                  </div>
                  {summary.target_objective && (
                    <span className="text-[11px] text-zinc-500 font-medium flex items-center gap-1 bg-zinc-900/30 px-2 py-1 rounded-md">
                      <MessageSquare size={10} />
                      {summary.target_objective}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => deleteSummary(summary.id)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <X size={16} />
                </button>
              </div>

              {summary.status === 'completed' && summary.content ? (
                <div className="raw-note-content text-zinc-300 text-sm leading-relaxed">
                  {neutralizeCodeBlocks(summary.content)}
                </div>
              ) : summary.status === 'pending' || summary.status === 'processing' ? (
                <div className="h-20 flex flex-col items-center justify-center gap-3 bg-zinc-900/20 rounded-xl border border-dashed border-zinc-700/50">
                   <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 animate-loading-bar" />
                   </div>
                   <span className="text-[11px] text-zinc-500 animate-pulse font-medium">Escaneando contenido y extrayendo ideas clave...</span>
                </div>
              ) : (
                <div className="text-zinc-500 text-xs italic py-2">
                  {summary.status === 'failed' ? 'Hubo un problema al generar este resumen. Por favor, intenta de nuevo.' : 'Esperando contenido...'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};