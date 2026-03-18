import React, { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useBrainDumpSummaries } from '../src/lib/useBrainDumpSummaries';

interface BrainDumpAIPanelProps {
  dumpId: string;
  noteStatus?: string;
}

export const BrainDumpAIPanel: React.FC<BrainDumpAIPanelProps> = ({ dumpId, noteStatus }) => {
  const [objectiveInput, setObjectiveInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { generateSummary } = useBrainDumpSummaries(dumpId);

  const handleGenerate = async () => {
    if (isCreating || !objectiveInput.trim()) return;
    setIsCreating(true);
    await generateSummary(objectiveInput.trim());
    setObjectiveInput('');
    setIsCreating(false);
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
          className="flex-1 min-w-0 bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 transition-all font-medium shadow-sm"
        />
        <button
          onClick={handleGenerate}
          disabled={isCreating || !objectiveInput.trim()}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all active:scale-95 whitespace-nowrap shadow-sm shadow-violet-500/20"
        >
          {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Generar
        </button>
      </div>
    </div>
  );
};
