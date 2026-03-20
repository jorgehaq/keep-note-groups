import React, { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useSummaries } from '../src/lib/useSummaries';

interface NoteAIPanelProps {
  noteId: string;
  userId: string;
  noteStatus: string;
  customOrderIndex?: number;
  getNewOrderIndex?: () => number;
  onPromoteToNote?: (content: string, title: string) => void;
  onCancel?: () => void;
  onGenerate?: (objective: string) => Promise<void>;
}

export const NoteAIPanel: React.FC<NoteAIPanelProps> = ({ noteId, customOrderIndex, getNewOrderIndex, onGenerate, onCancel }) => {
  const [objectiveInput, setObjectiveInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { generateSummary } = useSummaries(noteId);

  const handleGenerate = async () => {
    if (isCreating || !objectiveInput.trim()) return;
    setIsCreating(true);
    
    const orderIndex = customOrderIndex !== undefined ? customOrderIndex : (getNewOrderIndex ? getNewOrderIndex() : undefined);
    
    if (onGenerate) {
      await onGenerate(objectiveInput.trim());
    } else {
      await generateSummary(objectiveInput.trim(), orderIndex);
    }
    
    setObjectiveInput('');
    setIsCreating(false);
    if (onCancel) onCancel();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={objectiveInput}
          onChange={e => setObjectiveInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
          placeholder="¿Qué quieres analizar de esta nota?"
          className="flex-1 min-w-0 bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 transition-all"
        />
        <button
          onClick={handleGenerate}
          disabled={isCreating}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all active:scale-95 whitespace-nowrap"
        >
          {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Generar
        </button>
      </div>
    </div>
  );
};