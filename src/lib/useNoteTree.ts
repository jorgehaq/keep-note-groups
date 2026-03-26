import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

interface NoteNode {
  id: string;
  title: string;
  content: string;
  subtitle?: string;
  parent_note_id: string | null;
  generation_level: number;
  focus_prompt: string | null;
  ai_generated: boolean;
  generation_status: string;
  created_at: string;
}

export const useNoteTree = (rootNoteId: string | null) => {
  const [tree, setTree] = useState<NoteNode[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(rootNoteId);
  const [activeNote, setActiveNote] = useState<NoteNode | null>(null);

  const fetchTree = useCallback(async () => {
    if (!rootNoteId) return;
    // Cargar todos los descendientes de la nota raíz
    const collectIds = async (parentId: string, collected: NoteNode[] = []): Promise<NoteNode[]> => {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('parent_note_id', parentId)
        .order('created_at');
      if (!data?.length) return collected;
      for (const node of data) {
        collected.push(node);
        await collectIds(node.id, collected);
      }
      return collected;
    };

    const { data: root } = await supabase.from('notes').select('*').eq('id', rootNoteId).single();
    if (!root) return;
    const descendants = await collectIds(rootNoteId);
    setTree([root, ...descendants]);
  }, [rootNoteId]);

  useEffect(() => {
    fetchTree();
    setActiveNoteId(rootNoteId);
  }, [rootNoteId]);

  // Actualizar activeNote cuando cambia activeNoteId o tree
  useEffect(() => {
    if (!activeNoteId) return;
    const found = tree.find(n => n.id === activeNoteId);
    if (found) setActiveNote(found);
    else if (activeNoteId === rootNoteId && tree.length > 0) setActiveNote(tree[0]);
  }, [activeNoteId, tree]);

  // Construir el path (breadcrumb) desde raíz hasta el nodo activo
  const buildPath = (targetId: string): NoteNode[] => {
    const path: NoteNode[] = [];
    let current = tree.find(n => n.id === targetId);
    while (current) {
      path.unshift(current);
      if (!current.parent_note_id) break;
      current = tree.find(n => n.id === current!.parent_note_id);
    }
    return path;
  };

  const navigate = (noteId: string) => setActiveNoteId(noteId);

  return {
    tree,
    activeNoteId: activeNoteId || rootNoteId,
    activeNote,
    breadcrumbPath: activeNoteId ? buildPath(activeNoteId) : [],
    navigate,
    refresh: fetchTree,
  };
};