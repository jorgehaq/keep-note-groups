import React, { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useTikTokSummaries } from '../src/lib/useTikTokSummaries';

interface TikTokAIPanelProps {
  videoId: string;
}

export const TikTokAIPanel: React.FC<TikTokAIPanelProps> = ({ videoId }) => {
  const [objectiveInput, setObjectiveInput] = useState('');
  const { loading, generateAnalysis } = useTikTokSummaries(videoId);

  const handleGenerate = async () => {
    if (loading || !objectiveInput.trim()) return;
    await generateAnalysis(objectiveInput.trim());
    setObjectiveInput('');
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-zinc-900/40 rounded-3xl border border-zinc-800/50 shadow-inner">
      <div className="flex items-center gap-2 mb-2 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] px-1">
        <Sparkles size={12} className="text-violet-400" /> Nuevo Análisis AI
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={objectiveInput}
          onChange={e => setObjectiveInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
          placeholder="¿Qué quieres extraer de este video?"
          className="flex-1 min-w-0 bg-[#13131A] dark:bg-zinc-950/50 border border-zinc-700/50 rounded-2xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all font-medium"
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !objectiveInput.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-2xl text-sm font-bold transition-all active:scale-95 whitespace-nowrap shadow-lg shadow-violet-600/10"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Analizar
        </button>
      </div>
    </div>
  );
};
