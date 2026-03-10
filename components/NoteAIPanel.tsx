import React, { useState, useEffect } from 'react';
import { Loader2, Sparkles, X, RotateCcw, AlertCircle, ChevronRight } from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient';

interface NoteNode {
  id: string;
  title: string;
  content: string;
  parent_note_id: string | null;
  generation_level: number;
  focus_prompt: string | null;
  ai_generated: boolean;
  generation_status: 'idle' | 'queued' | 'processing' | 'done' | 'error' | 'stale';
  created_at: string;
}

interface NoteAIPanelProps {
  rootNoteId: string;                    // ID de la nota original (raíz)
  activeNoteId: string;                  // Nota que se está mostrando ahora
  onNavigate: (noteId: string) => void;  // Cambiar nota activa
  onChildCreated?: (note: NoteNode) => void;
  userId: string;
  groupId?: string;
}

const STATUS_CONFIG = {
  idle:       { label: '🤖 Generar resumen AI',     disabled: false, spinner: false },
  queued:     { label: '⏳ En cola...',              disabled: true,  spinner: true  },
  processing: { label: '⚙️ Procesando...',           disabled: true,  spinner: true  },
  done:       { label: '🔄 Regenerar',               disabled: false, spinner: false },
  error:      { label: '⚠️ Error — Reintentar',      disabled: false, spinner: false },
  stale:      { label: '🔄 Regenerar (desactualizado)', disabled: false, spinner: false },
};

export const NoteAIPanel: React.FC<NoteAIPanelProps> = ({
  rootNoteId, activeNoteId, onNavigate, onChildCreated, userId, groupId
}) => {
  const [focusInput, setFocusInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [directChildren, setDirectChildren] = useState<NoteNode[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);

  // Cargar hijos directos de la nota activa
  useEffect(() => {
    let isMounted = true;
    const fetchChildren = async () => {
      setLoadingChildren(true);
      const { data } = await supabase
        .from('notes')
        .select('id, title, content, parent_note_id, generation_level, focus_prompt, ai_generated, generation_status, created_at')
        .eq('parent_note_id', activeNoteId)
        .eq('ai_generated', true)
        .order('created_at', { ascending: true });
      if (isMounted) {
        setDirectChildren(data || []);
        setLoadingChildren(false);
      }
    };
    fetchChildren();

    // Realtime: actualizar cuando cambia generation_status de un hijo
    const channel = supabase
      .channel(`children-${activeNoteId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notes',
        filter: `parent_note_id=eq.${activeNoteId}`
      }, () => fetchChildren())
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [activeNoteId]);

  const handleGenerate = async () => {
    if (!focusInput.trim() || isCreating) return;
    setIsCreating(true);

    try {
      // 1. Crear la nota hija vacía
      const { data: newNote, error: noteError } = await supabase
        .from('notes')
        .insert({
          user_id: userId,
          group_id: groupId || null,
          title: focusInput.trim().slice(0, 80),
          content: '',
          parent_note_id: activeNoteId,
          generation_level: (directChildren[0]?.generation_level ?? 0) + 1,
          focus_prompt: focusInput.trim(),
          ai_generated: true,
          generation_status: 'queued',
        })
        .select()
        .single();

      if (noteError || !newNote) throw noteError;

      // 2. Encolar el job de procesamiento
      await supabase.from('processing_jobs').insert({
        user_id: userId,
        note_id: newNote.id,
        fase: 1,
        status: 'pending',
        priority: 3,
      });

      setFocusInput('');
      onChildCreated?.(newNote);
      // Navegar automáticamente al hijo recién creado
      onNavigate(newNote.id);
    } catch (e: any) {
      alert('Error al crear resumen: ' + (e?.message || 'desconocido'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Borrar este resumen y todos sus descendientes?')) return;
    await supabase.from('notes').delete().eq('id', noteId);
    // Si la nota activa era la que se borró, volver a la raíz
    if (activeNoteId === noteId) onNavigate(rootNoteId);
  };

  const handleRegenerate = async (child: NoteNode, e: React.MouseEvent) => {
    e.stopPropagation();
    // Marcar hijos del hijo como 'stale'
    await supabase
      .from('notes')
      .update({ generation_status: 'stale' })
      .eq('parent_note_id', child.id);

    // Resetear a queued y encolar nuevo job
    await supabase
      .from('notes')
      .update({ generation_status: 'queued', content: '' })
      .eq('id', child.id);

    await supabase.from('processing_jobs').insert({
      user_id: userId,
      note_id: child.id,
      fase: 1,
      status: 'pending',
      priority: 3,
    });
  };

  return (
    <div className="border-t border-zinc-800 mt-4 pt-4 space-y-3">
      {/* Input de enfoque + botón generar */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
          Enfoque del resumen AI
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={focusInput}
            onChange={e => setFocusInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); }}}
            placeholder="ej: ¿por qué me debería gustar Dostoievsky?"
            className="flex-1 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors"
          />
          <button
            onClick={handleGenerate}
            disabled={isCreating || !focusInput.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm font-semibold transition-colors active:scale-95 whitespace-nowrap"
          >
            {isCreating
              ? <><Loader2 size={14} className="animate-spin" /> Creando...</>
              : <><Sparkles size={14} /> Generar</>
            }
          </button>
        </div>
      </div>

      {/* Lista de hijos directos */}
      {!loadingChildren && directChildren.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-zinc-600 uppercase tracking-wide font-medium">
            Resúmenes generados desde esta nota
          </p>
          {directChildren.map(child => {
            const cfg = STATUS_CONFIG[child.generation_status] ?? STATUS_CONFIG.idle;
            const isActive = child.id === activeNoteId;
            return (
              <div
                key={child.id}
                onClick={() => onNavigate(child.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group ${
                  isActive
                    ? 'bg-violet-600/20 border border-violet-600/40 text-violet-300'
                    : 'bg-zinc-800/40 border border-zinc-700/50 hover:bg-zinc-700/40 text-zinc-300'
                }`}
              >
                {cfg.spinner
                  ? <Loader2 size={13} className="animate-spin text-violet-400 shrink-0" />
                  : <Sparkles size={13} className="text-violet-400 shrink-0" />
                }
                <span className="flex-1 text-sm truncate">
                  {child.focus_prompt || child.title || 'Resumen'}
                </span>
                {child.generation_status === 'stale' && (
                  <span className="text-[10px] text-amber-500 shrink-0">desact.</span>
                )}
                {child.generation_status === 'error' && (
                  <AlertCircle size={13} className="text-red-400 shrink-0" />
                )}
                {/* Botón regenerar */}
                {(child.generation_status === 'done' || child.generation_status === 'error' || child.generation_status === 'stale') && (
                  <button
                    onClick={e => handleRegenerate(child, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-violet-300 transition-all"
                    title="Regenerar"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
                {/* Botón borrar */}
                <button
                  onClick={e => handleDelete(child.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
                  title="Borrar resumen"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};