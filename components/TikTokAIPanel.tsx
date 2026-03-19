import React, { useState } from 'react';
import { Loader2, Sparkles, Send } from 'lucide-react';

interface TikTokAIPanelProps {
  videoId: string;
  onGenerate: (objective: string) => void;
}

export const TikTokAIPanel: React.FC<TikTokAIPanelProps> = ({ onGenerate }) => {
  const [objectiveInput, setObjectiveInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    if (!objectiveInput.trim()) return;
    setLoading(true);
    onGenerate(objectiveInput.trim());
    setObjectiveInput('');
    // Loading state is handled by the parent/hook usually, 
    // but we can set it to false after a short delay or if parent provides feedback.
    setTimeout(() => setLoading(false), 1000);
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-zinc-50 dark:bg-[#1A1A24] rounded-2xl border border-zinc-200 dark:border-[#2D2D42] shadow-sm">
      <div className="flex items-center gap-2 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] px-1">
        <Sparkles size={12} className="text-indigo-500" /> Consultar con IA (TikTok specialized)
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={objectiveInput}
          onChange={e => setObjectiveInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
          placeholder="¿Qué quieres extraer de este video?"
          className="flex-1 min-w-0 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 outline-none focus:border-indigo-500/50 transition-all font-medium"
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !objectiveInput.trim()}
          className="flex items-center justify-center p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-all active:scale-95 shadow-md shadow-indigo-600/10"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
};
