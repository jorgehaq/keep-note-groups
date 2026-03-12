import React, { useState, useEffect, useRef, useCallback, useImperativeHandle } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, CheckSquare, Square, ListTodo } from 'lucide-react';

interface ChecklistEditorProps {
    idPrefix: string;
    initialContent: string;
    onUpdate: (newContent: string) => void;
    noteLineHeight?: string;
    noteFont?: string;
    noteFontSize?: string;
    searchQuery?: string;
}

interface ChecklistItem {
    id: string;
    text: string;
    isChecked: boolean;
}

// Generador de ID corto estable
const generateId = () => Math.random().toString(36).substr(2, 9);

export const parseMarkdownToChecklist = (markdown: string): ChecklistItem[] => {
    if (!markdown.trim()) return [];
    return markdown.split('\n').filter(line => line.trim() !== '').map(line => {
        const isChecked = /^\s*[-*]?\s*\[[xX]\]\s*/.test(line);
        const text = line.replace(/^\s*[-*]?\s*\[[xX ]\]\s*/, '').trimStart();
        return { id: generateId(), text, isChecked };
    });
};

export const serializeChecklistToMarkdown = (items: ChecklistItem[]): string => {
    if (items.length === 0) return '';
    return items.map(item => `${item.isChecked ? '[x] ' : '[ ] '}${item.text}`).join('\n');
};

export const serializeChecklistToPlainMarkdown = (items: ChecklistItem[]): string => {
    if (items.length === 0) return '';
    return items.map(item => item.isChecked ? `~~${item.text}~~` : item.text).join('\n');
};

const highlightText = (text: string, highlight?: string): React.ReactNode => {
    if (!highlight || !highlight.trim()) return text;
    const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, index) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={index} className="bg-yellow-200 dark:bg-yellow-500/40 text-yellow-900 dark:text-yellow-100 px-0.5 font-medium">
                {part}
            </mark>
        ) : (
            part
        )
    );
};

const ChecklistItemRow = ({
    item, index, idPrefix, onToggle, onUpdateText, onEnter, onDeleteIfEmpty, noteLineHeight, noteFont, noteFontSize, searchQuery
}: {
    item: ChecklistItem; index: number; idPrefix: string;
    onToggle: (id: string) => void;
    onUpdateText: (id: string, text: string) => void;
    onEnter: (id: string) => void;
    onDeleteIfEmpty: (id: string) => void;
    noteLineHeight?: string;
    noteFont?: string;
    noteFontSize?: string;
    searchQuery?: string;
}) => {
    const [localText, setLocalText] = useState(item.text);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Solo sincronizar del item de forma forzada si cambia su id base,
    // o si cambió pero no desde nosotros (ej sync server)
    useEffect(() => {
        if (item.text !== localText) {
            setLocalText(item.text);
        }
    }, [item.text]);

    // Ajustar altura inicial y cuando cambie el texto remotamente
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
        }
    }, [localText, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setLocalText(e.target.value);
        onUpdateText(item.id, e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onEnter(item.id);
        } else if (e.key === 'Backspace' && localText === '') {
            e.preventDefault();
            onDeleteIfEmpty(item.id);
        }
    };

    return (
        <Draggable draggableId={`checklist-item-${idPrefix}-${item.id}`} index={index}>
            {(provided, snapshot) => (
                <div 
                    ref={provided.innerRef} 
                    {...provided.draggableProps} 
                    className={`flex items-start gap-1.5 group rounded-md px-1 py-0.5 transition-colors ${snapshot.isDragging ? 'bg-zinc-100 dark:bg-zinc-800 shadow-md ring-1 ring-zinc-200 dark:ring-zinc-700 z-50' : ''}`}
                >
                    <div 
                        {...provided.dragHandleProps} 
                        className="mt-2.5 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 cursor-grab active:cursor-grabbing shrink-0"
                    >
                        <GripVertical size={14} />
                    </div>
                    
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggle(item.id); }} 
                        className={`mt-2.5 shrink-0 rounded transition-colors ${item.isChecked ? 'text-emerald-500' : 'text-zinc-400 hover:text-[#1F3760]'}`}
                    >
                        {item.isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                    
                    <div className="relative flex-1 min-w-0 flex flex-col justify-center">
                        {/* Overlay para resaltado de búsqueda */}
                        {!isFocused && searchQuery && (
                            <div 
                                className={`absolute inset-0 pointer-events-none whitespace-pre-wrap break-words ${item.isChecked ? 'line-through text-zinc-400 dark:text-zinc-500 opacity-60' : 'text-zinc-700 dark:text-zinc-300'}`}
                                style={{ 
                                    lineHeight: noteLineHeight === 'more' ? '2.0' : noteLineHeight === 'large' ? '2.5' : '1.6',
                                    fontFamily: noteFont === 'serif' ? 'var(--font-serif)' : noteFont === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)',
                                    fontSize: noteFontSize === 'small' ? '13px' : noteFontSize === 'large' ? '18px' : '15px',
                                    paddingTop: '6px' // Alineación aproximada al textarea
                                }}
                            >
                                {highlightText(localText, searchQuery)}
                            </div>
                        )}
                        <textarea 
                            ref={inputRef}
                            rows={1}
                            value={localText}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            className={`w-full bg-transparent outline-none resize-none overflow-hidden m-0 p-0 py-1.5 ${item.isChecked ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-700 dark:text-zinc-300'} ${!isFocused && searchQuery && localText.toLowerCase().includes(searchQuery.toLowerCase()) ? 'text-transparent' : ''}`}
                            style={{ 
                                lineHeight: noteLineHeight === 'more' ? '2.0' : noteLineHeight === 'large' ? '2.5' : '1.6',
                                fontFamily: noteFont === 'serif' ? 'var(--font-serif)' : noteFont === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)',
                                fontSize: noteFontSize === 'small' ? '13px' : noteFontSize === 'large' ? '18px' : '15px',
                                minHeight: '1.5rem'
                            }}
                        />
                    </div>
                </div>
            )}
        </Draggable>
    );
};

export interface ChecklistEditorRef {
    getItems: () => ChecklistItem[];
}

export const ChecklistEditor = React.forwardRef<ChecklistEditorRef, ChecklistEditorProps>(({ idPrefix, initialContent, onUpdate, noteLineHeight = 'standard', noteFont = 'sans', noteFontSize = 'medium', searchQuery }, ref) => {
    const [items, setItems] = useState<ChecklistItem[]>(() => parseMarkdownToChecklist(initialContent));
    const prevInitialContent = useRef(initialContent);

    useImperativeHandle(ref, () => ({
        getItems: () => items,
    }), [items]);

    useEffect(() => {
        if (initialContent !== prevInitialContent.current) {
            // Sincronización real-time o rescate de server
            const newParsed = parseMarkdownToChecklist(initialContent);
            const contentMarkdown = serializeChecklistToMarkdown(items);
            // Solo si difiere del markdown actual local
            if (initialContent !== contentMarkdown) {
                setItems(newParsed);
            }
            prevInitialContent.current = initialContent;
        }
    }, [initialContent]);

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, []);

    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const triggerUpdate = useCallback((newItems: ChecklistItem[]) => {
        setItems(newItems);
        const newMarkdown = serializeChecklistToMarkdown(newItems);
        prevInitialContent.current = newMarkdown;
        
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        // Time de debouncing (2 segundos de estabilización, pedido x el usuario)
        debounceTimerRef.current = setTimeout(() => {
            onUpdate(newMarkdown);
        }, 2000); 
    }, [onUpdate]);

    const handleToggle = useCallback((id: string) => {
        triggerUpdate(items.map(item => item.id === id ? { ...item, isChecked: !item.isChecked } : item));
    }, [items, triggerUpdate]);

    const handleUpdateText = useCallback((id: string, text: string) => {
        triggerUpdate(items.map(item => item.id === id ? { ...item, text } : item));
    }, [items, triggerUpdate]);

    const handleEnter = useCallback((id: string) => {
        const index = items.findIndex(item => item.id === id);
        if (index === -1) return;
        const newItems = [...items];
        newItems.splice(index + 1, 0, { id: generateId(), text: '', isChecked: false });
        triggerUpdate(newItems);
        
        setTimeout(() => {
            // Un poco de hardcodeo robusto para enfocar el siguiente input
            const container = document.getElementById(`checklist-droppable-${idPrefix}`);
            if (container) {
                 const inputs = container.querySelectorAll('input[type="text"]');
                 if (inputs[index + 1]) (inputs[index + 1] as HTMLInputElement).focus();
            }
        }, 50);
    }, [items, idPrefix, triggerUpdate]);

    const handleDeleteIfEmpty = useCallback((id: string) => {
        const index = items.findIndex(item => item.id === id);
        if (index === -1) return;
        const newItems = items.filter(item => item.id !== id);
        triggerUpdate(newItems);
        
        setTimeout(() => {
            const container = document.getElementById(`checklist-droppable-${idPrefix}`);
            if (container) {
                 const inputs = container.querySelectorAll('input[type="text"]');
                 if (index > 0 && inputs[index - 1]) (inputs[index - 1] as HTMLInputElement).focus();
            }
        }, 50);
    }, [items, idPrefix, triggerUpdate]);

    const handleAddLast = useCallback(() => {
        const newItems = [...items, { id: generateId(), text: '', isChecked: false }];
        triggerUpdate(newItems);
        setTimeout(() => {
            const container = document.getElementById(`checklist-droppable-${idPrefix}`);
            if (container) {
                 const inputs = container.querySelectorAll('input[type="text"]');
                 if (inputs[newItems.length - 1]) (inputs[newItems.length - 1] as HTMLInputElement).focus();
            }
        }, 50);
    }, [items, idPrefix, triggerUpdate]);

    const handleDragEnd = useCallback((result: any) => {
        if (!result.destination) return;
        const sourceIndex = result.source.index;
        const destinationIndex = result.destination.index;
        if (sourceIndex === destinationIndex) return;

        const newItems = Array.from(items);
        const [reorderedItem] = newItems.splice(sourceIndex, 1);
        newItems.splice(destinationIndex, 0, reorderedItem);

        triggerUpdate(newItems);
    }, [items, triggerUpdate]);

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId={`checklist-droppable-${idPrefix}`}>
                {(provided) => (
                    <div id={`checklist-droppable-${idPrefix}`} ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1 w-full relative">
                        {items.map((item, index) => (
                            <ChecklistItemRow 
                                key={item.id} 
                                item={item} 
                                index={index} 
                                idPrefix={idPrefix}
                                onToggle={handleToggle}
                                onUpdateText={handleUpdateText}
                                onEnter={handleEnter}
                                onDeleteIfEmpty={handleDeleteIfEmpty}
                                noteLineHeight={noteLineHeight}
                                noteFont={noteFont}
                                noteFontSize={noteFontSize}
                                searchQuery={searchQuery}
                            />
                        ))}
                        {provided.placeholder}
                        
                        <button 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddLast(); }} 
                            className="flex items-center gap-2 mt-2 text-sm text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 font-medium py-1 px-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors w-fit"
                        >
                            <ListTodo size={14} />
                            Añadir elemento
                        </button>
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    );
});
