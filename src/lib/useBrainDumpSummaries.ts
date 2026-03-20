import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { Summary } from '../../types';

export function useBrainDumpSummaries(dumpId: string | null) {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchSummaries = useCallback(async () => {
    if (!dumpId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('summaries')
      .select('*')
      .eq('brain_dump_id', dumpId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSummaries(data);
    }
    setLoading(false);
    setHasFetched(true);
  }, [dumpId]);

  useEffect(() => {
    fetchSummaries();
    
    // Realtime subscription for this specific dump
    if (!dumpId) return;
    const channel = supabase.channel(`summaries_${dumpId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'summaries',
        filter: `brain_dump_id=eq.${dumpId}`
      }, () => {
        fetchSummaries();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dumpId, fetchSummaries]);

  const generateSummary = async (objective: string) => {
    if (!dumpId) return;
    const { error } = await supabase.from('summaries').insert([{
      brain_dump_id: dumpId,
      target_objective: objective,
      status: 'pending',
      content: ''
    }]);
    if (error) console.error('Error generating summary:', error);
  };

  const deleteSummary = async (summaryId: string) => {
    const { error } = await supabase.from('summaries').delete().eq('id', summaryId);
    if (error) console.error('Error deleting summary:', error);
    else setSummaries(prev => prev.filter(s => s.id !== summaryId));
  };

  const updateScratchpad = async (summaryId: string, text: string) => {
    await supabase.from('summaries').update({ scratchpad: text }).eq('id', summaryId);
    setSummaries(prev => prev.map(s => s.id === summaryId ? { ...s, scratchpad: text } : s));
  };

  const updateSummaryMetadata = async (summaryId: string, updates: Partial<Summary>) => {
    await supabase.from('summaries').update(updates).eq('id', summaryId);
    setSummaries(prev => prev.map(s => s.id === summaryId ? { ...s, ...updates } : s));
  };

  const updateSummaryContent = async (summaryId: string, text: string) => {
    await supabase.from('summaries').update({ content: text }).eq('id', summaryId);
    setSummaries(prev => prev.map(s => s.id === summaryId ? { ...s, content: text } : s));
  };

  return { 
    summaries, 
    loading, 
    hasFetched, 
    generateSummary, 
    deleteSummary, 
    updateScratchpad, 
    updateSummaryContent,
    updateSummaryMetadata
  };
}
