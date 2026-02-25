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
    { status: 'backlog', label: 'Backlog', color: 'bg-white dark:bg-zinc-200 ring-1 ring-zinc-300' },
    { status: 'todo', label: 'Pendiente', color: 'bg-blue-500' },
    { status: 'in_progress', label: 'En Proceso', color: 'bg-amber-500' },
    { status: 'done', label: 'Terminado', color: 'bg-emerald-500' },
];

export const KanbanSemaphore: React.FC<KanbanSemaphoreProps> = ({ sourceId, sourceTitle, onInteract }) => {
    const [currentStatus, setCurrentStatus] = useState<TaskStatus | 'none'>('none');
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Consultar el estado actual en la base de datos al cargar
    useEffect(() => {
        const fetchStatus = async () => {
            const { data } = await supabase.from('tasks').select('status').eq('id', sourceId).maybeSingle();
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
        setIsOpen(false); // Cerrar paleta tras la selección

        if (status === 'remove') {
            setCurrentStatus('none');
            // Eliminar la tarea del Kanban
            await supabase.from('tasks').delete().eq('id', sourceId);
        } else {
            setCurrentStatus(status as TaskStatus);
            // Crear o actualizar la tarea usando el ID de la nota
            const { error } = await supabase.from('tasks').upsert({
                id: sourceId,
                title: sourceTitle || 'Sin título',
                status: status
            });
            if (error) console.error("Error al actualizar Kanban:", error);
        }

        // ¡LA MAGIA INSTANTÁNEA! Avisarle a App.tsx que recargue los números
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
