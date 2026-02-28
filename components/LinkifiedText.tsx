import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Highlighter, Languages, Loader2, X, Heading1, Bold, Trash2 } from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient';
import TextareaAutosize from 'react-textarea-autosize';

interface LinkifiedTextProps {
    noteId: string;
    content: string;
    searchQuery?: string;
    onUpdate: (id: string, updates: any) => void;
}

// OBJETO MAESTRO: Obliga a que la lectura y el editor midan EXACTAMENTE lo mismo (Cero Saltos)
const EXACT_STYLES: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: '15px',
    lineHeight: '24px', // Fijo en píxeles para evitar redondeos decimales del navegador
    padding: 0,
    margin: 0,
    borderWidth: 0,
    outline: 'none',
    boxSizing: 'border-box',
    verticalAlign: 'top',
    width: '100%',
    backgroundColor: 'transparent',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    tabSize: 4,
};

const highlightSegment = (text: string, highlight?: string): React.ReactNode => {
    if (!highlight || !highlight.trim()) return text;
    const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-yellow-300 text-black rounded-sm px-0.5 font-bold transition-colors">
                {part}
            </mark>
        ) : (
            part
        )
    );
};

const parseAugmentedText = (text: string) => {
    const regex = /(https?:\/\/[^\s]+)|\{=(.+?)=\}|\[\[tr:([^|]+)\|(.+?)\]\]|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
        }
        if (match[1]) parts.push({ type: 'link', content: match[1], raw: match[0] });
        else if (match[2]) parts.push({ type: 'highlight', content: match[2], raw: match[0] });
        else if (match[3] && match[4]) parts.push({ type: 'translation', id: match[3], content: match[4], raw: match[0] });
        else if (match[5]) parts.push({ type: 'bold', content: match[5], raw: match[0] });
        else if (match[6]) parts.push({ type: 'italic', content: match[6], raw: match[0] });
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
        parts.push({ type: 'text', content: text.substring(lastIndex) });
    }
    return parts;
};

const InlineEditor = ({
    initialValue,
    onSave,
    onClose,
    onSplitLine,
    onMergeWithPrevious,
    onMoveUp,
    onMoveDown,
    cursorOffset
}: any) => {
    const [val, setVal] = useState(initialValue);
    const ref = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (ref.current) {
            ref.current.focus({ preventScroll: true });
            if (cursorOffset !== undefined && cursorOffset >= 0 && cursorOffset <= val.length) {
                ref.current.setSelectionRange(cursorOffset, cursorOffset);
            } else {
                const len = ref.current.value.length;
                ref.current.setSelectionRange(len, len);
            }
        }
    }, [cursorOffset]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const target = e.target as HTMLTextAreaElement;
            const currentVal = target.value;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const newVal = currentVal.substring(0, start) + "\t" + currentVal.substring(end);
            setVal(newVal);
            onSave(newVal);
            setTimeout(() => {
                target.selectionStart = target.selectionEnd = start + 1;
            }, 0);
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const target = e.target as HTMLTextAreaElement;
            const currentVal = target.value;
            const start = target.selectionStart;

            const val1 = currentVal.substring(0, start);
            const val2 = currentVal.substring(start);

            // Captura espacios y tabs iniciales
            const bulletMatch = val1.match(/^([ \t]*)([-*])\s(.*)/);
            const numberMatch = val1.match(/^([ \t]*)(\d+)\.\s(.*)/);
            const indentMatch = val1.match(/^([ \t]+)(.*)/);

            if (bulletMatch) {
                if (!bulletMatch[3].trim() && val2.trim() === '') {
                    const newVal = val1.substring(0, start - bulletMatch[0].length) + val2;
                    setVal(newVal);
                    onSave(newVal);
                    setTimeout(() => target.setSelectionRange(start - bulletMatch[0].length, start - bulletMatch[0].length), 0);
                } else {
                    const prefix = `${bulletMatch[1]}${bulletMatch[2]} `;
                    onSplitLine(val1, prefix + val2, prefix.length);
                }
            } else if (numberMatch) {
                if (!numberMatch[3].trim() && val2.trim() === '') {
                    const newVal = val1.substring(0, start - numberMatch[0].length) + val2;
                    setVal(newVal);
                    onSave(newVal);
                    setTimeout(() => target.setSelectionRange(start - numberMatch[0].length, start - numberMatch[0].length), 0);
                } else {
                    const nextNum = parseInt(numberMatch[2], 10) + 1;
                    const prefix = `${numberMatch[1]}${nextNum}. `;
                    onSplitLine(val1, prefix + val2, prefix.length);
                }
            } else if (indentMatch) {
                onSplitLine(val1, indentMatch[1] + val2, indentMatch[1].length);
            } else {
                onSplitLine(val1, val2, 0);
            }
        } else if (e.key === 'Backspace') {
            const target = e.target as HTMLTextAreaElement;
            if (target.selectionStart === 0 && target.selectionEnd === 0) {
                e.preventDefault();
                onMergeWithPrevious(val);
            }
        } else if (e.key === 'ArrowUp') {
            const target = e.target as HTMLTextAreaElement;
            if (target.selectionStart === 0) {
                e.preventDefault();
                onMoveUp(val);
            }
        } else if (e.key === 'ArrowDown') {
            const target = e.target as HTMLTextAreaElement;
            if (target.selectionEnd === val.length) {
                e.preventDefault();
                onMoveDown(val);
            }
        }
    };

    const isHeading = val.match(/^(#{1,6})\s/);
    const textColor = isHeading ? 'text-zinc-900 dark:text-white font-bold' : 'text-zinc-800 dark:text-zinc-200';

    return (
        <TextareaAutosize
            ref={ref}
            value={val}
            onChange={e => {
                setVal(e.target.value);
                onSave(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            style={{ ...EXACT_STYLES, resize: 'none', overflow: 'hidden', display: 'block' }}
            className={`font-sans ${textColor}`}
        />
    );
};

export const LinkifiedText: React.FC<LinkifiedTextProps> = ({ noteId, content, searchQuery, onUpdate }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectionMenu, setSelectionMenu] = useState<{ text: string; top: number; left: number; selectionState?: { startOffset: number, endOffset: number } } | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [translationsMap, setTranslationsMap] = useState<Record<string, string>>({});
    const [hasFetchedTranslations, setHasFetchedTranslations] = useState(false);

    const [editingLine, setEditingLine] = useState<{ index: number, offset?: number } | null>(null);

    useEffect(() => {
        const fetchTranslations = async () => {
            const trIds = [...content.matchAll(/\[\[tr:([^|]+)\|/g)].map(m => m[1]);
            if (trIds.length === 0) {
                setHasFetchedTranslations(true);
                return;
            }
            const uniqueIds = Array.from(new Set(trIds));
            const missingIds = uniqueIds.filter(id => !(id in translationsMap));
            if (missingIds.length > 0) {
                const { data, error } = await supabase.from('translations').select('id, translated_text').in('id', missingIds);
                if (data && !error) {
                    const newMap = { ...translationsMap };
                    data.forEach(tr => { newMap[tr.id] = tr.translated_text; });
                    setTranslationsMap(newMap);
                }
            }
            setHasFetchedTranslations(true);
        };
        fetchTranslations();
    }, [content]);

    // Función auxiliar para obtener el offset absoluto en el contenido crudo basado en el DOM
    const getAbsoluteOffset = (node: Node, offset: number, container: Node): number => {
        let absoluteOffset = 0;
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
        let currentNode = walker.nextNode();

        while (currentNode) {
            if (currentNode === node) {
                // Detectamos si estamos dentro de un título (los # están ocultos en el render, hay que sumarlos)
                let parentLine = currentNode.parentElement?.closest('[data-lineindex]');
                let offsetCompensation = 0;

                if (parentLine) {
                    const lineIndex = parseInt(parentLine.getAttribute('data-lineindex') || '0', 10);
                    const lineText = content.split('\n')[lineIndex];
                    if (lineText) {
                        const headingMatch = lineText.match(/^(#{1,6})\s+(.*)/);
                        // Solo compensamos en el primer nodo de texto de esta línea
                        if (headingMatch && currentNode === parentLine.firstChild?.firstChild) {
                            offsetCompensation = headingMatch[1].length + 1; // "# "
                        }
                    }
                }

                return absoluteOffset + offset + offsetCompensation;
            }
            // Mismo parche visual para los títulos si estamos saltando un nodo previo
            let parentLine = currentNode.parentElement?.closest('[data-lineindex]');
            let offsetCompensation = 0;
            if (parentLine) {
                const lineIndex = parseInt(parentLine.getAttribute('data-lineindex') || '0', 10);
                const lineText = content.split('\n')[lineIndex];
                if (lineText) {
                    const headingMatch = lineText.match(/^(#{1,6})\s+(.*)/);
                    if (headingMatch && currentNode === parentLine.firstChild?.firstChild) {
                        offsetCompensation = headingMatch[1].length + 1;
                    }
                }
            }

            // Usamos `.length` normal si es texto visible, o 1 si es el espacio invisible de línea vacía
            const nodeContent = currentNode.textContent || '';
            absoluteOffset += (!nodeContent || nodeContent === '\u200B' ? 1 : nodeContent.length) + offsetCompensation;

            currentNode = walker.nextNode();
        }
        return absoluteOffset;
    };


    const handleMouseUp = () => {
        setTimeout(() => {
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed) {
                const text = selection.toString().trim();

                // Verificamos si la selección está dentro de nuestro contenedor
                if (text && containerRef.current && containerRef.current.contains(selection.anchorNode) && containerRef.current.contains(selection.focusNode)) {
                    let range;
                    try {
                        range = selection.getRangeAt(0);
                    } catch (e) {
                        return; // Ocurrió un error al obtener el rango
                    }

                    // Calculamos los offsets exactos del principio y fin de la selección en el DOM
                    const startRaw = getAbsoluteOffset(range.startContainer, range.startOffset, containerRef.current);
                    const endRaw = getAbsoluteOffset(range.endContainer, range.endOffset, containerRef.current);

                    const startOffset = Math.min(startRaw, endRaw);
                    const endOffset = Math.max(startRaw, endRaw);

                    const rects = range.getClientRects();
                    if (rects.length > 0) {
                        // Usamos el primer rectángulo visualmente para colocar el menú en la parte superior izquierda
                        // de la selección, funciona mejor para múltiples líneas
                        const rect = rects[0];
                        setSelectionMenu({
                            text,
                            selectionState: { startOffset, endOffset },
                            top: rect.top - 55,
                            left: rect.left + (rect.width > 100 ? 50 : rect.width / 2)
                        });
                        return;
                    }
                }
            }
        }, 50); // Aumentado ligeramente para dar más tiempo al nav tras selección múltiple
    };

    const executeDelete = () => {
        if (!selectionMenu) return;

        let newContent = content;

        // Estrategia 1: Uso exacto de Offsets (Ideal para múltiples líneas y texto problemático visual)
        if (selectionMenu.selectionState) {
            const { startOffset, endOffset } = selectionMenu.selectionState;
            // Quitamos los saltos de línea de la contabilidad de índices para alinear con createTreeWalker
            let domContent = "";
            let newLinesPositions: number[] = [];

            for (let i = 0; i < content.length; i++) {
                if (content[i] === '\n') {
                    newLinesPositions.push(i);
                    // Insertamos el caracter invisible \u200B que usa el renderizador para simular líneas
                    // si la línea estaba vacía, o lo ignoramos si estaba concatenado
                    if (i === 0 || content[i - 1] === '\n') domContent += '\u200B';
                } else {
                    domContent += content[i];
                }
            }

            // Función inversa básica aproximada para encontrar la posición real en el texto crudo
            let realStart = 0;
            let realEnd = content.length;

            // Dado que el mapeo inverso 1:1 es propenso a errores por los parseAugmentedText (marcas ==, **), 
            // la estrategia regex en fallback (antigua) será superior si el offset exacto falla.
        }

        const textToReplace = selectionMenu.text;

        // Estrategia más robusta para múltiples líneas: 
        // 1. Intentamos reemplazo exacto global primero
        newContent = content.replace(textToReplace, '');

        // 2. Si falló (ej. por diferencias de saltos de línea invisibles o dobles espacios), 
        // limpiamos los saltos extras en el texto original y la zona seleccionada
        if (newContent === content || newContent.length === content.length) {
            // Simplificamos los espacios extra para hacer la comparacion más permisiva
            const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Extraemos fragmentos de palabras largas y buscamos secuencias difusas
            const words = textToReplace.split(/\s+/).filter(w => w.trim().length > 0);
            if (words.length > 0) {
                const regexFriendly = words.map(escapeRegExp).join('[\\s\\n]*'); // Tolera saltos de línea y múltiples espacios entre palabras
                const regex = new RegExp(regexFriendly, 'g');
                newContent = content.replace(regex, '');
            }
        }

        onUpdate(noteId, { content: newContent });
        setSelectionMenu(null);
        window.getSelection()?.removeAllRanges();
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Backspace' || e.key === 'Delete') && selectionMenu) {
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

                e.preventDefault();
                e.stopPropagation();
                // Usamos un ligero retraso para asegurar que React procesó toda la cadena de eventos 
                // antes de borrar, de esa forma previene que la selección local rompa o cierre el dom prematuramente
                setTimeout(() => executeDelete(), 0);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectionMenu, content, noteId, onUpdate]);

    useEffect(() => {
        // Limpiamos los timeouts para evitar fugas y condiciones de carrera en selecciones seguidas
        let timeoutId: NodeJS.Timeout;

        const handleMouseDown = (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('.floating-menu-container')) return;

            // Cierre global del editor si hacemos clic afuera de la nota
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setEditingLine(null);
                setSelectionMenu(null);
            } else {
                // Al hacer mousedown dentro del contenedor, esperamos a que el usuario termine la selección
                // pero por precaución ocultamos el menú si el usuario hace clic simple (para escribir)
                timeoutId = setTimeout(() => {
                    const sel = window.getSelection();
                    if (!sel || sel.isCollapsed) setSelectionMenu(null);
                }, 100);
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            clearTimeout(timeoutId);
        };
    }, []);

    const removeMarkup = (rawSyntax: string, plainText: string) => {
        const newContent = content.replace(rawSyntax, plainText);
        onUpdate(noteId, { content: newContent });
    };

    const doDelete = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        executeDelete();
    };

    const doFormat = (type: 'highlight' | 'bold' | 'h1') => {
        if (!selectionMenu) return;
        let newContent = content;

        const textToReplace = selectionMenu.text;
        const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        let targetTextToReplace = textToReplace;
        let exactMatch = content.includes(textToReplace);

        // Si la constante literal sin saltos no hace coincidencia (pasa usando el ratón en múltiples renglones)
        // Buscamos cuál es la sub-cadena original con sus saltos \n que el usuario refería
        if (!exactMatch) {
            const words = textToReplace.split(/\s+/).filter(w => w.trim().length > 0);
            if (words.length > 0) {
                const regexFriendly = words.map(escapeRegExp).join('([\\s\\n]*)');
                const regex = new RegExp(`(${regexFriendly})`, ''); // match only first
                const match = newContent.match(regex);
                if (match) {
                    targetTextToReplace = match[0];
                }
            }
        }

        if (type === 'highlight') {
            // Para abarcar un bloque multimedias, inyectamos {= al principio y =} al fin de su match crudo
            newContent = newContent.replace(targetTextToReplace, `{=${targetTextToReplace}=}`);
        }
        else if (type === 'bold') {
            newContent = newContent.replace(targetTextToReplace, `**${targetTextToReplace}**`);
        }
        else if (type === 'h1') {
            const lines = content.split('\n');
            // Mapeamos los sub strings para ver si alguna línea los contiene
            const newLines = lines.map(line => {
                if (targetTextToReplace.includes(line.trim()) || line.includes(targetTextToReplace.trim())) {
                    return !line.startsWith('#') && line.trim() !== '' ? `# ${line}` : line;
                }
                return line;
            });
            newContent = newLines.join('\n');
        }
        onUpdate(noteId, { content: newContent });
        setSelectionMenu(null);
        window.getSelection()?.removeAllRanges();
    };

    const doTranslate = async (sourceLang: 'es' | 'en', targetLang: 'es' | 'en') => {
        if (!selectionMenu) return;
        const textToTranslate = selectionMenu.text;
        setIsTranslating(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No hay sesión activa');
            const { data, error } = await supabase.functions.invoke('translateMyAppNotes', {
                body: { sourceLang, targetLang, text: textToTranslate }, headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (error) throw error;
            const translatedText = data.translation;
            const { data: insertData, error: insertError } = await supabase.from('translations').insert([{
                user_id: session.user.id, source_text: textToTranslate, translated_text: translatedText, source_lang: sourceLang, target_lang: targetLang
            }]).select().single();
            if (insertError) throw insertError;
            const newContent = content.replace(textToTranslate, `[[tr:${insertData.id}|${textToTranslate}]]`);
            onUpdate(noteId, { content: newContent });
        } catch (e: any) {
            alert('Error al traducir: ' + e.message);
        } finally {
            setIsTranslating(false);
            setSelectionMenu(null);
            window.getSelection()?.removeAllRanges();
        }
    };

    const deleteLine = (lineIndexToRemove: number) => {
        const lines = content.split('\n');
        lines.splice(lineIndexToRemove, 1);
        onUpdate(noteId, { content: lines.join('\n') });
    };

    const handleBlockClick = (lineIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
            return;
        }

        let clickedOffset: number | undefined = undefined;

        // CÁLCULO SEGURO (Evita pantalla negra o bloqueos si el DOM es complejo)
        try {
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (e.currentTarget.contains(range.endContainer)) {
                    const preCaretRange = range.cloneRange();
                    preCaretRange.selectNodeContents(e.currentTarget);
                    preCaretRange.setEnd(range.endContainer, range.endOffset);
                    clickedOffset = preCaretRange.toString().length;
                }
            }
        } catch (err) {
            clickedOffset = undefined;
        }

        // Compensamos los '#' que están ocultos visualmente pero existen en la cadena real
        if (clickedOffset !== undefined) {
            const lineText = content.split('\n')[lineIndex];
            const headingMatch = lineText.match(/^(#{1,6})\s/);
            if (headingMatch && clickedOffset > 0) {
                clickedOffset += headingMatch[1].length + 1;
            }
        }

        setEditingLine({ index: lineIndex, offset: clickedOffset });
    };

    const saveInlineEditRealTime = (val: string, lineIndex: number) => {
        const lines = content.split('\n');
        lines[lineIndex] = val;
        onUpdate(noteId, { content: lines.join('\n') });
    };

    const splitLine = (lineIndex: number, val1: string, val2: string, newOffset: number = 0) => {
        const lines = content.split('\n');
        lines.splice(lineIndex, 1, val1, val2);
        onUpdate(noteId, { content: lines.join('\n') });
        setEditingLine({ index: lineIndex + 1, offset: newOffset });
    };

    const mergeWithPrevious = (lineIndex: number, currentVal: string) => {
        if (lineIndex === 0) return;
        const lines = content.split('\n');
        const previousLength = lines[lineIndex - 1].length;
        lines[lineIndex - 1] += currentVal;
        lines.splice(lineIndex, 1);
        onUpdate(noteId, { content: lines.join('\n') });
        setEditingLine({ index: lineIndex - 1, offset: previousLength });
    };

    const handleMoveUp = (val: string, lineIndex: number) => {
        saveInlineEditRealTime(val, lineIndex);
        if (lineIndex > 0) {
            const lines = content.split('\n');
            setEditingLine({ index: lineIndex - 1, offset: lines[lineIndex - 1].length });
        }
    };

    const handleMoveDown = (val: string, lineIndex: number) => {
        saveInlineEditRealTime(val, lineIndex);
        const lines = content.split('\n');
        if (lineIndex < lines.length - 1) {
            setEditingLine({ index: lineIndex + 1, offset: 0 });
        }
    };

    const handleContainerClick = (e: React.MouseEvent) => {
        if (e.target === containerRef.current) {
            const lines = content.split('\n');
            if (lines[lines.length - 1] !== '') {
                onUpdate(noteId, { content: content + '\n' });
                setEditingLine({ index: lines.length, offset: 0 });
            } else {
                setEditingLine({ index: lines.length - 1, offset: 0 });
            }
        }
    };

    const renderSegments = (text: string) => {
        const segments = parseAugmentedText(text);
        return segments.map((segment, idx) => {
            if (segment.type === 'link') {
                return (
                    <a key={idx} href={segment.content} target="_blank" rel="noopener noreferrer" className="inline break-all text-blue-500 hover:text-blue-700 hover:underline font-medium px-1 rounded transition-colors" onClick={(e) => e.stopPropagation()}>
                        {segment.content} <ExternalLink size={12} className="inline-block ml-1 align-text-bottom" />
                    </a>
                );
            }
            if (segment.type === 'bold') {
                return <strong key={idx} className="font-bold text-zinc-900 dark:text-white">{highlightSegment(segment.content, searchQuery)}</strong>;
            }
            if (segment.type === 'italic') {
                return <em key={idx} className="italic text-zinc-900 dark:text-white">{highlightSegment(segment.content, searchQuery)}</em>;
            }

            // MARCAS ESTABLES (Sin Padding vertical que rompa la altura)
            if (segment.type === 'highlight') {
                return (
                    <mark key={idx} className="relative bg-[#ccff00] dark:bg-[#ccff00]/30 text-black dark:text-inherit rounded px-0.5 font-bold group/hl cursor-pointer transition-colors mx-0.5">
                        {highlightSegment(segment.content, searchQuery)}
                        <button onClick={(e) => { e.stopPropagation(); removeMarkup(segment.raw!, segment.content); }} className="absolute -top-2.5 -right-2 bg-zinc-900 text-white rounded-full w-[16px] h-[16px] flex items-center justify-center opacity-0 group-hover/hl:opacity-100 transition-opacity shadow-lg active:scale-90" title="Quitar resaltado">
                            <X size={10} strokeWidth={3} />
                        </button>
                    </mark>
                );
            }

            if (segment.type === 'translation') {
                const trText = translationsMap[segment.id!];
                const isMissing = hasFetchedTranslations && !trText;
                if (isMissing) return <span key={idx}>{highlightSegment(segment.content, searchQuery)}</span>;

                return (
                    <mark key={idx} className="relative bg-[#60A5FA] dark:bg-[#60A5FA]/35 text-black dark:text-inherit rounded px-0.5 font-bold group/tr cursor-help transition-colors mx-0.5">
                        {highlightSegment(segment.content, searchQuery)}
                        <button onClick={(e) => { e.stopPropagation(); removeMarkup(segment.raw!, segment.content); }} className="absolute -top-2.5 -right-2 bg-zinc-900 text-white rounded-full w-[16px] h-[16px] flex items-center justify-center opacity-0 group-hover/tr:opacity-100 transition-opacity shadow-lg active:scale-90" title="Quitar traducción">
                            <X size={10} strokeWidth={3} />
                        </button>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[250px] bg-zinc-900 text-white font-sans text-xs p-3 rounded-xl shadow-2xl opacity-0 group-hover/tr:opacity-100 transition-all z-50 pointer-events-none whitespace-pre-wrap leading-relaxed ring-1 ring-white/10">
                            {trText ? trText : 'Cargando...'}
                            <svg className="absolute text-zinc-900 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0" /></svg>
                        </span>
                    </mark>
                );
            }
            return <span key={idx}>{highlightSegment(segment.content, searchQuery)}</span>;
        });
    };

    if (!content) {
        return (
            <div onClick={() => { onUpdate(noteId, { content: '\n' }); setEditingLine({ index: 0, offset: 0 }); }} className="w-full h-24 flex items-start text-zinc-400 italic text-sm cursor-text py-2">
                Haz clic aquí para escribir...
            </div>
        );
    }

    return (
        <>
            <div ref={containerRef} onClick={handleContainerClick} onMouseUp={handleMouseUp} onTouchEnd={handleMouseUp} className="whitespace-pre-wrap break-words overflow-hidden relative py-2 pb-24 cursor-text">
                {content.split('\n').map((line, lineIndex) => {

                    if (editingLine?.index === lineIndex) {
                        return (
                            <InlineEditor
                                key={lineIndex}
                                initialValue={line}
                                cursorOffset={editingLine.offset}
                                onSave={(val: string) => saveInlineEditRealTime(val, lineIndex)}
                                onClose={() => setEditingLine(null)}
                                onSplitLine={(v1: string, v2: string, offset: number) => splitLine(lineIndex, v1, v2, offset)}
                                onMergeWithPrevious={(v: string) => mergeWithPrevious(lineIndex, v)}
                                onMoveUp={(v: string) => handleMoveUp(v, lineIndex)}
                                onMoveDown={(v: string) => handleMoveDown(v, lineIndex)}
                            />
                        );
                    }

                    // Línea Vacía (Usa un espacio invisible para mantener el salto sin aplastarse)
                    if (line === '') {
                        return (
                            <div key={lineIndex} data-lineindex={lineIndex} onClick={(e) => handleBlockClick(lineIndex, e)} style={EXACT_STYLES} className="cursor-text text-zinc-800 dark:text-zinc-200 font-sans">
                                {'\u200B'}
                            </div>
                        );
                    }

                    // Separador
                    if (line.trim() === '---') {
                        return (
                            <div key={lineIndex} data-lineindex={lineIndex} onClick={(e) => handleBlockClick(lineIndex, e)} style={EXACT_STYLES} className="relative group flex items-center justify-center cursor-text">
                                <hr className="border-t border-zinc-200 dark:border-zinc-700 w-full" />
                                <button onClick={(e) => { e.stopPropagation(); deleteLine(lineIndex); }} className="absolute bg-zinc-900 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md" title="Eliminar separador">
                                    <X size={12} strokeWidth={3} />
                                </button>
                            </div>
                        );
                    }

                    // Títulos Discretos (Sin "#" visibles, solo Negrita)
                    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
                    if (headingMatch) {
                        return (
                            <div key={lineIndex} data-lineindex={lineIndex} onClick={(e) => handleBlockClick(lineIndex, e)} style={EXACT_STYLES} className="cursor-text font-bold text-zinc-900 dark:text-white font-sans">
                                {renderSegments(headingMatch[2])}
                            </div>
                        );
                    }

                    // Todo lo demás (Listas y Párrafos Normales) fluyen nativamente como texto
                    return (
                        <div key={lineIndex} data-lineindex={lineIndex} onClick={(e) => handleBlockClick(lineIndex, e)} style={EXACT_STYLES} className="cursor-text text-zinc-800 dark:text-zinc-200 font-sans">
                            {renderSegments(line)}
                        </div>
                    );
                })}
            </div>

            {/* MENÚ FLOTANTE ALTO CONTRASTE */}
            {selectionMenu && (
                <div
                    className="floating-menu-container fixed z-[100] bg-white dark:bg-zinc-900 text-zinc-800 dark:text-white p-1.5 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center gap-1 border border-zinc-200 dark:border-zinc-700 animate-fadeIn origin-bottom"
                    style={{ top: selectionMenu.top, left: selectionMenu.left, transform: 'translateX(-50%)' }}
                >
                    {isTranslating ? (
                        <div className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-blue-500">
                            <Loader2 size={16} className="animate-spin" /> Traduciendo...
                        </div>
                    ) : (
                        <>
                            <button onClick={() => doFormat('h1')} className="p-2 text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors" title="Convertir en Título">
                                <Heading1 size={16} />
                            </button>
                            <button onClick={() => doFormat('bold')} className="p-2 text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors" title="Negrita">
                                <Bold size={16} />
                            </button>
                            <button onClick={doDelete} className="p-2 text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors" title="Eliminar Texto">
                                <Trash2 size={16} />
                            </button>

                            <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-0.5"></div>

                            <button onClick={() => doFormat('highlight')} className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-black rounded-lg text-xs font-bold transition-colors text-zinc-800 dark:text-white active:scale-95" title="Resaltar">
                                <Highlighter size={14} className="text-[#6B8E23] dark:text-[#ccff00]" /> Resaltar
                            </button>

                            <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-0.5"></div>

                            <button onClick={() => doTranslate('es', 'en')} className="flex items-center gap-1 px-3 py-2 bg-blue-500/10 dark:bg-blue-500/20 hover:bg-blue-500/20 dark:hover:bg-blue-500/40 rounded-lg text-xs font-bold transition-colors text-blue-500 dark:text-blue-400 active:scale-95" title="Traducir a Inglés">
                                <Languages size={14} /> EN
                            </button>
                            <button onClick={() => doTranslate('en', 'es')} className="flex items-center gap-1 px-3 py-2 bg-blue-500/10 dark:bg-blue-500/20 hover:bg-blue-500/20 dark:hover:bg-blue-500/40 rounded-lg text-xs font-bold transition-colors text-blue-500 dark:text-blue-400 active:scale-95" title="Traducir a Español">
                                ES
                            </button>
                        </>
                    )}
                </div>
            )}
        </>
    );
};