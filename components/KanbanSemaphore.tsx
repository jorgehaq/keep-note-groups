import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import { TaskStatus } from '../types';
import { useUIStore } from '../src/lib/store';

interface KanbanSemaphoreProps {
    sourceId?: string;
    sourceTitle?: string;
    sourceType?: 'note' | 'board' | 'tiktok';
    onInteract?: () => void;
    status?: TaskStatus;
    onStatusChange?: (status: TaskStatus) => void;
}

// Configuración de los 5 estados (incluyendo "Quitar" en Negro)
const STATUS_CONFIG = [
    { status: 'remove', label: 'Quitar / Archivar', color: 'bg-zinc-800 dark:bg-black ring-1 ring-zinc-500', hex: '' },
    { status: 'backlog', label: 'Backlog', color: 'bg-[#9E9E9E]', hex: '#9E9E9E' },
    { status: 'todo', label: 'Pendiente', color: 'bg-[#FFD60A]', hex: '#FFD60A' },
    { status: 'in_progress', label: 'En Proceso', color: 'bg-[#38BDF8]', hex: '#38BDF8' },
    { status: 'done', label: 'Terminado', color: 'bg-[#4ADE80]', hex: '#4ADE80' },
];

export const KanbanSemaphore: React.FC<KanbanSemaphoreProps> = ({ 
    sourceId, 
    sourceTitle, 
    sourceType, 
    onInteract,
    status: manualStatus,
    onStatusChange
}) => {
    const { globalTasks } = useUIStore();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Si se pasa un status manual, lo usamos. Si no, buscamos en globalTasks.
    let currentStatus: TaskStatus | 'none' | 'remove' = 'none';
    
    if (manualStatus) {
        currentStatus = manualStatus;
    } else if (sourceId && sourceType) {
        const task = globalTasks?.find(t => 
            (sourceType === 'note' && (t.id === sourceId || t.linked_note_id === sourceId)) ||
            (sourceType === 'board' && (t.id === sourceId || t.linked_board_id === sourceId)) ||
            (sourceType === 'tiktok' && (t.id === sourceId || t.linked_tiktok_id === sourceId))
        );
        currentStatus = task ? (task.status as TaskStatus) : 'none';
    }

    // Cerrar la paleta si se hace clic afuera
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleSetStatus = async (status: string) => {
        setIsOpen(false);

        if (onStatusChange) {
            onStatusChange(status as TaskStatus);
            return;
        }

        if (!sourceId || !sourceType) return;

        // Primero buscamos la tarea existente
        const query = supabase.from('tasks').select('id, linked_note_id, linked_board_id, linked_tiktok_id');
        if (sourceType === 'note') {
            query.or(`id.eq.${sourceId},linked_note_id.eq.${sourceId}`);
        } else if (sourceType === 'board') {
            query.or(`id.eq.${sourceId},linked_board_id.eq.${sourceId}`);
        } else {
            query.or(`id.eq.${sourceId},linked_tiktok_id.eq.${sourceId}`);
        }
        const { data: existing } = await query.maybeSingle();

        if (status === 'remove') {
            if (existing) {
                if (existing.id === sourceId) {
                    // LEGACY: Creada via upsert con id=noteId → eliminar para que isInKanban vuelva a false
                    await supabase.from('tasks').delete().eq('id', existing.id);
                } else {
                    // MODERN: Creada via KanbanLinkerModal con id diferente → solo quitar el FK
                    const updates: any = {};
                    if (sourceType === 'note') updates.linked_note_id = null;
                    else if (sourceType === 'board') updates.linked_board_id = null;
                    else updates.linked_tiktok_id = null;
                    await supabase.from('tasks').update(updates).eq('id', existing.id);
                }
            }
        } else {
            const user = (await supabase.auth.getUser()).data.user;
            
            if (existing) {
                // Actualizar existente
                await supabase.from('tasks').update({ status: status }).eq('id', existing.id);
            } else {
                // Crear nueva vinculada
                const newTask: any = {
                    title: sourceTitle || 'Sin título',
                    status: status,
                    user_id: user?.id,
                };
                
                if (sourceType === 'note') newTask.linked_note_id = sourceId;
                else if (sourceType === 'board') newTask.linked_board_id = sourceId;
                else newTask.linked_tiktok_id = sourceId;

                await supabase.from('tasks').insert([newTask]);
            }
        }

        window.dispatchEvent(new CustomEvent('kanban-updated'));
    };

    // Estado visual por defecto si no está en Kanban
    const currentConfig = STATUS_CONFIG.find(c => c.status === currentStatus) || {
        label: 'Añadir a Kanban',
        color: 'bg-transparent border-2 border-dashed border-zinc-400'
    };

    return (
        <div className="relative flex items-center" ref={menuRef}>
            {/* El Círculo Principal (Solo muestra Tooltip al pasar el mouse, abre paleta al clic) */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (onInteract) onInteract(); 
                    setIsOpen(!isOpen);
                }}
                className={`w-3.5 h-3.5 rounded-full transition-transform hover:scale-110 ${currentConfig.color}`}
                style={{ 
                    boxShadow: (currentConfig as any).hex ? `0 0 6px ${(currentConfig as any).hex}88` : 'none' 
                }}
                title={currentConfig.label}
            />

            {/* La Paleta Desplegable (Solo aparece al hacer clic) */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-zinc-800 shadow-xl rounded-lg border border-zinc-200 dark:border-zinc-700 p-1.5 flex gap-1.5 animate-fadeIn">
                    {STATUS_CONFIG.map(cfg => (
                        <button
                            key={cfg.status}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSetStatus(cfg.status);
                            }}
                            className={`w-4 h-4 rounded-full transition-transform hover:scale-125 ${cfg.color} ${currentStatus === cfg.status ? 'ring-2 ring-offset-1 ring-zinc-400 dark:ring-offset-zinc-800' : ''}`}
                            title={cfg.label}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
