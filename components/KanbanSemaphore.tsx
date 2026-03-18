import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import { TaskStatus } from '../types';

interface KanbanSemaphoreProps {
    sourceId: string;
    sourceTitle: string;
    onInteract?: () => void;
}

// Configuración de los 5 estados (incluyendo "Quitar" en Negro)
const STATUS_CONFIG = [
    { status: 'remove', label: 'Quitar de Kanban', color: 'bg-zinc-800 dark:bg-black ring-1 ring-zinc-500' },
    { status: 'backlog', label: 'Backlog', color: 'bg-[#9E9E9E]' },
    { status: 'todo', label: 'Pendiente', color: 'bg-[#FBC02D]' },
    { status: 'in_progress', label: 'En Proceso', color: 'bg-[#1E88E5]' },
    { status: 'done', label: 'Terminado', color: 'bg-[#43A047]' },
];

export const KanbanSemaphore: React.FC<KanbanSemaphoreProps> = ({ sourceId, sourceTitle, onInteract }) => {
    const [currentStatus, setCurrentStatus] = useState<TaskStatus | 'none'>('none');
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Consultar el estado actual en la base de datos al cargar
    useEffect(() => {
        const fetchStatus = async () => {
            // Buscamos si existe una tarea donde el ID sea el sourceId, 
            // O esté vinculada como nota o como pizarrón
            const { data } = await supabase
                .from('tasks')
                .select('id, status')
                .or(`id.eq.${sourceId},linked_note_id.eq.${sourceId},linked_board_id.eq.${sourceId}`)
                .maybeSingle();
            
            if (data) {
                setCurrentStatus(data.status as TaskStatus);
            } else {
                setCurrentStatus('none');
            }
        };
        fetchStatus();
    }, [sourceId]);

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

        // Primero buscamos la tarea existente
        const { data: existing } = await supabase
            .from('tasks')
            .select('id')
            .or(`id.eq.${sourceId},linked_note_id.eq.${sourceId},linked_board_id.eq.${sourceId}`)
            .maybeSingle();

        if (status === 'remove') {
            setCurrentStatus('none');
            if (existing) {
                await supabase.from('tasks').delete().eq('id', existing.id);
            }
        } else {
            setCurrentStatus(status as TaskStatus);
            const user = (await supabase.auth.getUser()).data.user;
            
            if (existing) {
                // Actualizar existente
                await supabase.from('tasks').update({ status: status }).eq('id', existing.id);
            } else {
                // Crear nueva vinculada (siempre lo vinculamos como Pizarrón por defecto en este contexto, 
                // o intentamos detectar si el sourceId es de una Nota o Pizarrón)
                // Usamos upsert con id: sourceId para mantener compatibilidad si no hay linked_ids
                // Pero como ya existe el migration, mejor usamos las columnas nuevas.
                // Para simplificar, si no existe y estamos en PizarrónApp, lo vinculamos como pizarrón.
                // Nota: sourceTitle se pasa desde el componente padre.
                const newTask: any = {
                    title: sourceTitle || 'Sin título',
                    status: status,
                    user_id: user?.id,
                    linked_board_id: sourceId // Por defecto asumimos Pizarrón si viene de BrainDumpApp
                };
                
                // Si preferimos mantener el ID igual (legacy), podemos hacerlo, pero es redundante ahora.
                // Sin embargo, para evitar romper Lógica previa, usaremos la columna correspondiente.
                // ¿Cómo sabemos si es nota o pizarrón? 
                // Podríamos pasar un prop 'type', pero el sourceId suele ser suficiente para distinguir en BD si se consulta.
                // Por ahora, vincularemos como board si no se especifica.
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
                    if (onInteract) onInteract(); // Aquí le decimos a la nota que se abra
                    setIsOpen(!isOpen);
                }}
                className={`w-3.5 h-3.5 rounded-full transition-transform hover:scale-110 ${currentConfig.color}`}
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
