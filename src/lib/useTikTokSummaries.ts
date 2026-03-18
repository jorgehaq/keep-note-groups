import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { TikTokVideo } from '../../types';

export function useTikTokSummaries(videoId: string | null) {
  const [loading, setLoading] = useState(false);

  const generateAnalysis = useCallback(async (objective: string) => {
    if (!videoId) return;
    setLoading(true);

    try {
      // 1. Marcar como procesando
      await supabase
        .from('tiktok_videos')
        .update({ ai_summary_status: 'processing' })
        .eq('id', videoId);

      // 2. Llamada a la IA (provisionalmente vía Edge Function para seguridad)
      // Nota: El usuario pidió "dentro de la app", si se prefiere SDK directo, 
      // se requeriría GEMINI_API_KEY en .env. Por ahora usamos el patrón seguro de Supabase.
      const { data: video } = await supabase
        .from('tiktok_videos')
        .select('transcript, title, description')
        .eq('id', videoId)
        .single();

      if (!video) throw new Error("Video no encontrado");

      const prompt = `Analiza el siguiente contenido de un video de TikTok con el objetivo: "${objective}".
      
      Contenido (Transcripción/Descripción):
      ${video.transcript || video.description || "Sin contenido disponible"}
      
      Devuelve un JSON con:
      {
        "summary": "resumen ejecutivo",
        "key_points": ["punto 1", "punto 2", ...],
        "category": "categoría",
        "suggested_title": "título mejorado"
      }`;

      // 🚀 NOTA: Aquí llamaremos a la Edge Function 'analyze-video' o similar.
      // Si no existe, la crearemos en el siguiente paso.
      const { data, error: aiError } = await supabase.functions.invoke('analyze-tiktok', {
        body: { prompt, videoId }
      });

      if (aiError) throw aiError;

      // 3. Actualizar con resultados
      await supabase
        .from('tiktok_videos')
        .update({
          summary: data.summary,
          key_points: data.key_points,
          category: data.category,
          ai_summary_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);

    } catch (err) {
      console.error('Error en generateAnalysis:', err);
      await supabase
        .from('tiktok_videos')
        .update({ ai_summary_status: 'failed' })
        .eq('id', videoId);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  return {
    loading,
    generateAnalysis
  };
}
