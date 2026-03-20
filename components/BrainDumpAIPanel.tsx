import React, { useState } from 'react';
import { Loader2, Sparkles, Send } from 'lucide-react';
import { useBrainDumpSummaries } from '../src/lib/useBrainDumpSummaries';

interface BrainDumpAIPanelProps {
  dumpId: string;
  noteStatus?: string;
  onGenerate?: () => void;
  getRelativeCreatedAt?: () => string;
}

export const BrainDumpAIPanel: React.FC<BrainDumpAIPanelProps> = ({ dumpId, noteStatus, onGenerate, getRelativeCreatedAt }) => {
  const [objectiveInput, setObjectiveInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { generateSummary } = useBrainDumpSummaries(dumpId);

  const handleGenerate = async () => {
    if (isCreating || !objectiveInput.trim()) return;
    setIsCreating(true);
    const createdAt = getRelativeCreatedAt ? getRelativeCreatedAt() : undefined;
    await generateSummary(objectiveInput.trim(), createdAt);
    setObjectiveInput('');
    setIsCreating(false);
    if (onGenerate) onGenerate();
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-zinc-50 dark:bg-[#1A1A24] rounded-2xl border border-zinc-200 dark:border-[#2D2D42] shadow-sm">
      <div className="flex items-center gap-2 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] px-1">
        <Sparkles size={12} className="text-violet-500" /> Consultar con IA (Pizarrón)
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={objectiveInput}
          onChange={e => setObjectiveInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
          placeholder="¿Qué quieres analizar de este pizarrón?"
          className="flex-1 min-w-0 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 outline-none focus:border-violet-500/50 transition-all font-medium"
        />
        <button
          onClick={handleGenerate}
          disabled={isCreating || !objectiveInput.trim()}
          className="flex items-center justify-center p-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl transition-all active:scale-95 shadow-md shadow-violet-600/10"
        >
          {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
};
