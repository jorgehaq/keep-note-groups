import React, { useState } from 'react';
import { Loader2, Sparkles, Send } from 'lucide-react';
import { useBrainDumpSummaries } from '../src/lib/useBrainDumpSummaries';

interface BrainDumpAIPanelProps {
  dumpId: string;
  noteStatus?: string;
  onGenerate?: () => void;
  getNewOrderIndex?: () => number;
}

export const BrainDumpAIPanel: React.FC<BrainDumpAIPanelProps> = ({ dumpId, noteStatus, onGenerate, getNewOrderIndex }) => {
  const [objectiveInput, setObjectiveInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { generateSummary } = useBrainDumpSummaries(dumpId);

  const handleGenerate = async () => {
    if (isCreating || !objectiveInput.trim()) return;
    setIsCreating(true);
    const orderIndex = getNewOrderIndex ? getNewOrderIndex() : undefined;
    await generateSummary(objectiveInput.trim(), orderIndex);
    setObjectiveInput('');
    setIsCreating(false);
    if (onGenerate) onGenerate();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={objectiveInput}
          onChange={e => setObjectiveInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
          placeholder="¿Qué quieres analizar de este pizarrón?"
          className="flex-1 min-w-0 bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 rounded-lg px-4 h-10 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 transition-all"
        />
        <button
          onClick={handleGenerate}
          disabled={isCreating}
          className="flex items-center justify-center gap-2 px-4 h-10 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/40 rounded-lg text-sm font-medium transition-all active:scale-95 whitespace-nowrap disabled:opacity-50"
        >
          {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Generar
        </button>
      </div>
    </div>
  );
};
