import { useState, useEffect, useCallback, useMemo } from 'react';
import { BrainDump } from '../../types';
import { useUIStore } from './store';

export function useBrainDumpTree(focusedDumpId: string | null) {
  const dumps = useUIStore(state => state.brainDumps);
  const [activeDumpId, setActiveDumpId] = useState<string | null>(focusedDumpId);

  // Derive activeDump and breadcrumbPath from local state (no more Supabase calls here)
  const { activeDump, breadcrumbPath } = useMemo(() => {
    if (!activeDumpId) return { activeDump: null, breadcrumbPath: [] };
    
    const current = dumps.find(d => d.id === activeDumpId) || null;
    const path: BrainDump[] = [];
    let curr = current;
    
    while (curr) {
      path.unshift(curr);
      if (!curr.parent_id) break;
      const parent = dumps.find(d => d.id === curr!.parent_id);
      curr = parent || null;
    }
    
    return { activeDump: current, breadcrumbPath: path };
  }, [activeDumpId, dumps]);

  const navigate = useCallback((id: string | null) => {
    setActiveDumpId(id);
  }, []);

  // Si el foco externo cambia, reseteamos la navegación interna
  useEffect(() => {
    setActiveDumpId(focusedDumpId);
  }, [focusedDumpId]);

  return {
    activeDumpId,
    activeDump,
    breadcrumbPath,
    navigate,
    refresh: () => {} // No longer needed as it uses reactive store state
  };
}
