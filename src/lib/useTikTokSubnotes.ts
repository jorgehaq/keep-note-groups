import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { Note } from '../../types';

export function useTikTokSubnotes(videoId: string | null) {
  const [subnotes, setSubnotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSubnotes = useCallback(async () => {
    if (!videoId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('tiktok_video_id', videoId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setSubnotes(data);
    }
    setLoading(false);
  }, [videoId]);

  useEffect(() => {
    if (!videoId) {
      setSubnotes([]);
      return;
    }
    fetchSubnotes();
    
    // Realtime subscription
    const channel = supabase.channel(`tiktok_subnotes_${videoId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notes',
        filter: `tiktok_video_id=eq.${videoId}`
      }, () => {
        fetchSubnotes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [videoId, fetchSubnotes]);

  const createSubnote = async (title: string, groupId?: string | null, content: string = '', createdAt?: string) => {
    if (!videoId) return null;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user found for sub-note creation');
      return null;
    }

    const insertData: any = {
      tiktok_video_id: videoId,
      title: title || 'Nueva Sub-nota',
      content: content,
      user_id: user.id,
      group_id: groupId || null,
      position: 0
    };

    if (createdAt) {
      insertData.created_at = createdAt;
    }

    const { data: newNote, error } = await supabase.from('notes').insert([insertData]).select().single();
    
    if (error) {
      console.error('Error creating sub-note:', error);
      alert('Error al crear sub-nota: ' + error.message);
      return null;
    }

    if (newNote) {
      setSubnotes(prev => [...prev, newNote]);
    }
    return newNote;
  };

  const deleteSubnote = async (id: string) => {
    setSubnotes(prev => prev.filter(n => n.id !== id));
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) {
      console.error('Error deleting sub-note:', error);
      fetchSubnotes(); // Rollback on error
    }
  };

  const updateSubnote = async (id: string, updates: Partial<Note>) => {
    setSubnotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    const { error } = await supabase.from('notes').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating sub-note:', error);
      fetchSubnotes(); // Rollback on error
    }
  };

  return {
    subnotes,
    loading,
    createSubnote,
    deleteSubnote,
    updateSubnote
  };
}
