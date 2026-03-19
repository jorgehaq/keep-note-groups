import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { Summary } from '../../types';

export function useTikTokSummaries(videoId: string | null) {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchSummaries = useCallback(async () => {
    if (!videoId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('summaries')
      .select('*')
      .eq('tiktok_video_id', videoId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSummaries(data);
    }
    setLoading(false);
    setHasFetched(true);
  }, [videoId]);

  useEffect(() => {
    if (!videoId) {
      setSummaries([]);
      setHasFetched(false);
      return;
    }
    fetchSummaries();
    
    // Realtime subscription
    const channel = supabase.channel(`tiktok_summaries_${videoId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'summaries',
        filter: `tiktok_video_id=eq.${videoId}`
      }, () => {
        fetchSummaries();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [videoId, fetchSummaries]);

  const generateSummary = async (objective: string) => {
    if (!videoId) return;
    
    // 1. Insert pending record
    const { data: newSummary, error: insertError } = await supabase
      .from('summaries')
      .insert([{
        tiktok_video_id: videoId,
        target_objective: objective,
        status: 'pending',
        content: ''
      }])
      .select()
      .single();

    if (insertError || !newSummary) {
      console.error('Error creating TikTok summary record:', insertError);
      return null;
    }

    setSummaries(prev => [newSummary, ...prev]);
    const summaryId = newSummary.id;

    try {
      // 2. Get video info for prompt
      const { data: video } = await supabase
        .from('tiktok_videos')
        .select('transcript, title, author, description')
        .eq('id', videoId)
        .single();

      if (!video) throw new Error("Video no encontrado");

      const prompt = `Analiza el video de TikTok "${video.title}" de @${video.author} con el objetivo: "${objective}".
      
      CONTENIDO:
      ${video.transcript || video.description || "Sin contenido disponible"}
      
      POR FAVOR, GENERA UN ANÁLISIS ESPECIALIZADO QUE INCLUYA:
      1. RESUMEN EJECUTIVO: Una síntesis potente del mensaje central.
      2. EL GANCHO (HOOK): Identifica cómo el video capta la atención en los primeros segundos.
      3. PUNTOS CLAVE: Los insights o lecciones más importantes.
      4. VALOR AGREGADO: Qué información nueva o ángulo único aporta.
      5. CALL TO ACTION: Qué se espera que haga el espectador después.

      Responde ESTRICTAMENTE con este JSON:
      {
        "summary": "Resumen ejecutivo detallado...",
        "key_points": ["Insight 1", "Insight 2", "Gancho: ...", "CTA: ..."],
        "category": "Categoría temática",
        "suggested_title": "Título optimizado para retención"
      }`;

      // 3. Invoke Edge Function
      const { data, error: aiError } = await supabase.functions.invoke('analyze-tiktok', {
        body: { prompt }
      });

      if (aiError) throw aiError;

      // 4. Format as Markdown for the 'content' field
      const formattedContent = `
# 🎬 ${data.suggested_title || video.title}
**Objetivo:** ${objective} | **Categoría:** ${data.category || 'TikTok Analysis'}

## 📝 RESUMEN EJECUTIVO
${data.summary}

## ⚡ EL GANCHO (HOOK)
${data.key_points?.find((p: string) => p.toLowerCase().includes('gancho')) || 'No identificado'}

## 💡 PUNTOS CLAVE
${data.key_points?.filter((p: string) => !p.toLowerCase().includes('gancho') && !p.toLowerCase().includes('cta')).map((p: string) => `- ${p}`).join('\n')}

## 🚀 CALL TO ACTION (CTA)
${data.key_points?.find((p: string) => p.toLowerCase().includes('cta')) || 'No identificado'}
`.trim();

      // 5. Update summary record
      const updatePayload = {
        content: formattedContent,
        status: 'completed' as const
      };
      
      console.log('📝 Actualizando resumen en DB:', newSummary.id, updatePayload);
      const { error: updateError, data: updateData } = await supabase
        .from('summaries')
        .update(updatePayload)
        .eq('id', newSummary.id)
        .select();

      if (updateError) {
        console.error('❌ Error actualizando resumen (Success path):', updateError);
      } else {
        console.log('✅ Resumen actualizado con éxito:', updateData);
        // Optimistic local update
        setSummaries(prev => prev.map(s => s.id === newSummary.id ? { ...s, ...updatePayload } : s));
      }

    } catch (err: any) {
      console.error('Error en generateSummary (Catch block):', err);
      if (err.context && typeof err.context.json === 'function') {
        try {
          const errorBody = await err.context.json();
          console.error('Detalles del error de la función AI:', errorBody);
        } catch (jsonErr) {
          console.error('No se pudo leer el cuerpo JSON del error de la función');
        }
      }
      
      const errorPayload = { status: 'failed' as any };
      const { error: patchError } = await supabase
        .from('summaries')
        .update(errorPayload)
        .eq('id', newSummary.id);
        
      if (patchError) {
        console.error('❌ Error actualizando resumen a estado "failed":', patchError);
      } else {
        setSummaries(prev => prev.map(s => s.id === newSummary.id ? { ...s, ...errorPayload } : s));
      }
    }
    return newSummary;
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
    updateSummaryMetadata,
    updateSummaryContent 
  };
}
