import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { ExternalLink, Highlighter, Languages, Loader2, X, Heading1, Bold, Trash2, Maximize2, MoreHorizontal, Strikethrough, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient';
import TextareaAutosize from 'react-textarea-autosize';

interface LinkifiedTextProps {
    noteId: string;
    content: string;
    searchQuery?: string;
    onUpdate: (id: string, updates: any) => void;
}

interface Segment {
  type: 'text' | 'link' | 'highlight' | 'translation' | 'bold' | 'italic' | 'marker' | 'strikethrough';
  content: string;
  raw?: string;
  id?: string; // used for translation id
  meta?: string; // used for marker type or translation legacy
  timestamp?: string; // for marker
}

const MARKER_TYPES = {
  ins:   { label: 'Insight',   color: '#7C3AED', emoji: '💡' },
  idea:  { label: 'Idea',      color: '#DC2626', emoji: '🔥' },
  op:    { label: 'Opinión',   color: '#65A30D', emoji: '🌱' },
  duda:  { label: 'Duda',      color: '#0EA5E9', emoji: '💧' },
  wow:   { label: 'Sorpresa',  color: '#DB2777', emoji: '✨' },
  pat:   { label: 'Patrón',    color: '#6D28D9', emoji: '🌀' },
  yo:    { label: 'Yo',        color: '#F59E0B', emoji: '⭐' },
  ruido: { label: 'Ruido',     color: '#6B7280', emoji: '🔇' },
} as const;

type MarkerType = keyof typeof MARKER_TYPES;

const generateMarkerTimestamp = (): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  const hh   = String(now.getHours()).padStart(2, '0');
  const min  = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}`;
};

const formatMarkerTimestamp = (ts: string): string => {
  if (!ts || ts.length < 13) return ts;
  return `${ts.slice(6,8)}/${ts.slice(4,6)}/${ts.slice(0,4)} ${ts.slice(9,11)}:${ts.slice(11,13)}`;
};

export const extractMarkersFromContent = (content: string) => {
  const regex = /\[\[(ins|idea|op|duda|wow|pat|yo|ruido|idioma):([^\|]+)\|([^\]]+)\]\]/g;
  const markers = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    markers.push({
      tipo:      match[1],
      timestamp: match[2],
      texto:     match[3],
      posicion:  match.index,
    });
  }
  return markers;
};

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

const parseAugmentedText = (text: string): Segment[] => {
    const regex = /(https?:\/\/[^\s]+)|\{=(.+?)=\}|\[\[tr:([^|]+)\|(.+?)\]\]|\[\[(ins|idea|op|duda|wow|pat|yo|ruido):([^|]+)\|([^\]]+)\]\]|\*\*([^*]+)\*\*|\*([^*]+)\*|~~([^~]+)~~/g;
    const parts: Segment[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
        }
        if (match[1]) parts.push({ type: 'link', content: match[1], raw: match[0] });
        else if (match[2]) parts.push({ type: 'highlight', content: match[2], raw: match[0] });
        else if (match[3] && match[4]) parts.push({ type: 'translation', id: match[3], content: match[4], raw: match[0] });
        else if (match[5]) parts.push({ type: 'marker', meta: match[5], timestamp: match[6], content: match[7], raw: match[0] });
        else if (match[8]) parts.push({ type: 'bold', content: match[8], raw: match[0] });
        else if (match[9]) parts.push({ type: 'italic', content: match[9], raw: match[0] });
        else if (match[10]) parts.push({ type: 'strikethrough', content: match[10], raw: match[0] });
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
    const [showHlOptions, setShowHlOptions] = useState(false);
    const [showTagOptions, setShowTagOptions] = useState(false);
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

    // Refs para posicionamiento dinámico de submenús
    const hlMenuRef = useRef<HTMLDivElement>(null);
    const tagMenuRef = useRef<HTMLDivElement>(null);
    const moreMenuRef = useRef<HTMLDivElement>(null);
    const [hlShift, setHlShift] = useState(0);
    const [tagShift, setTagShift] = useState(0);
    const [moreShift, setMoreShift] = useState(0);

    const adjustMenuPosition = (isOpen: boolean, menuRef: React.RefObject<HTMLDivElement>, containerRef: React.RefObject<HTMLDivElement>, setShift: React.Dispatch<React.SetStateAction<number>>) => {
        useLayoutEffect(() => {
            if (isOpen && menuRef.current && containerRef.current) {
                const menuRect = menuRef.current.getBoundingClientRect();
                const containerRect = containerRef.current.getBoundingClientRect();
                const margin = 8;
                
                // 🎯 Solo ajustamos si se sale por la DERECHA del contenedor del editor
                if (menuRect.right > containerRect.right - margin) {
                    const diff = (containerRect.right - margin) - menuRect.right;
                    setShift(prev => prev + diff);
                }
            } else {
                setShift(0);
            }
        }, [isOpen]);
    };

    adjustMenuPosition(showHlOptions, hlMenuRef, containerRef, setHlShift);
    adjustMenuPosition(showTagOptions, tagMenuRef, containerRef, setTagShift);
    adjustMenuPosition(showMoreOptions, moreMenuRef, containerRef, setMoreShift);

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
        const isMobile = window.innerWidth < 768;
        setTimeout(() => {
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed) {
                const text = selection.toString().trim();

                // Verificamos si la selección está dentro de nuestro contenedor
                if (text && containerRef.current && containerRef.current.contains(selection.anchorNode)) {
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
                        const containerRect = containerRef.current.getBoundingClientRect();
                        const rect = rects[0];
                        
                        // 🚀 CÁLCULO RELATIVO: Resolvemos el problema de "vuelo" a la esquina
                        const relativeTop = rect.top - containerRect.top;
                        const relativeLeft = (rect.left + rect.width / 2) - containerRect.left;

                        // Clamping horizontal (evitar que el menú se salga por los lados)
                        const isMobile = window.innerWidth < 768;
                        const menuWidth = isMobile ? 120 : 140; // 🎯 Mas ajustado a su tamaño real
                        const halfMenu = menuWidth / 2;
                        let finalLeft = relativeLeft;

                        if (finalLeft < halfMenu + 10) finalLeft = halfMenu + 10;
                        if (finalLeft > containerRect.width - halfMenu - 10) finalLeft = containerRect.width - halfMenu - 10;

                        setSelectionMenu({
                            text,
                            selectionState: { startOffset, endOffset },
                            top: relativeTop - 12, // 🚀 Ajustado: El margen real se da con el transform translateY
                            left: finalLeft
                        });
                        return;
                    }
                }
            }
        }, isMobile ? 400 : 50);
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
                const isMobile = window.innerWidth < 768;
                timeoutId = setTimeout(() => {
                    const sel = window.getSelection();
                    // 🚀 FIX: En móvil NO cerramos el menú simplemente por un colapso post-clic, 
                    // porque los handles disparan eventos que pueden parecer clics.
                    if (!sel || (sel.isCollapsed && !isMobile)) setSelectionMenu(null);
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

    const doFormat = (type: 'highlight' | 'bold' | 'h1' | 'strikethrough' | 'link' | MarkerType) => {
        if (!selectionMenu) return;
        let newContent = content;

        const textToReplace = selectionMenu.text;
        const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        let targetTextToReplace = textToReplace;
        let exactMatch = content.includes(textToReplace);

        if (!exactMatch) {
            const words = textToReplace.split(/\s+/).filter(w => w.trim().length > 0);
            if (words.length > 0) {
                const regexFriendly = words.map(escapeRegExp).join('([\\s\\n]*)');
                const regex = new RegExp(`(${regexFriendly})`, '');
                const match = newContent.match(regex);
                if (match) {
                    targetTextToReplace = match[0];
                }
            }
        }

        // Anti-mescolanza: si el texto seleccionado ya está dentro de un marcador,
        // buscar el marcador completo en el raw y reemplazarlo (no anidar)
        const markerWrapRegex = /\[\[(ins|idea|op|duda|wow|pat|yo|ruido):[^\|]+\|([^\]]+)\]\]/g;
        let markerMatch;
        while ((markerMatch = markerWrapRegex.exec(content)) !== null) {
            if (markerMatch[2] === targetTextToReplace || markerMatch[0].includes(targetTextToReplace)) {
                targetTextToReplace = markerMatch[0]; // reemplazar el marcador completo
                break;
            }
        }
        // El innerText limpio para usar como contenido del nuevo marcador
        const innerClean = targetTextToReplace.replace(/\[\[(ins|idea|op|duda|wow|pat|yo|ruido):[^\|]+\|([^\]]+)\]\]/g, '$2');

        if (type === 'highlight') {
            newContent = newContent.replace(targetTextToReplace, `{=${innerClean}=}`);
        }
        else if (type === 'bold') {
            newContent = newContent.replace(targetTextToReplace, `**${innerClean}**`);
        }
        else if (type === 'strikethrough') {
            newContent = newContent.replace(targetTextToReplace, `~~${innerClean}~~`);
        }
        else if (type === 'link') {
            const url = prompt("Introduce la URL:", "https://");
            if (url) {
                newContent = newContent.replace(targetTextToReplace, `[${innerClean}](${url})`);
            } else {
              return; // Cancelado
            }
        }
        else if (type in MARKER_TYPES) {
            const ts = generateMarkerTimestamp();
            newContent = newContent.replace(targetTextToReplace, `[[${type}:${ts}|${innerClean}]]`);
        }
        else if (type === 'h1') {
            const lines = content.split('\n');
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
            if (segment.type === 'strikethrough') {
                return <del key={idx} className="line-through text-zinc-500">{highlightSegment(segment.content, searchQuery)}</del>;
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
                    <mark key={idx} className="relative bg-[#FACC15] dark:bg-[#FACC15]/80 text-black rounded px-0.5 font-semibold group/hl cursor-pointer transition-colors mx-0.5">
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
                    <mark key={idx} className="relative bg-[#10B981] dark:bg-[#10B981]/80 text-white rounded px-0.5 font-semibold group/tr cursor-help transition-colors mx-0.5 leading-none">
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

            if (segment.type === 'marker') {
                const mType = segment.meta as MarkerType;
                const cfg   = MARKER_TYPES[mType] ?? { label: mType, color: '#6B7280', emoji: '?' };
                const ts    = formatMarkerTimestamp(segment.timestamp ?? '');
                return (
                  <mark
                    key={idx}
                    className="relative rounded px-0.5 font-bold group/mk cursor-default transition-colors mx-0.5 inline-block"
                    style={{ backgroundColor: cfg.color + '33', color: cfg.color, border: `1px solid ${cfg.color}55` }}
                  >
                    {highlightSegment(segment.content, searchQuery)}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[220px] bg-zinc-900 text-white font-sans text-xs p-2 rounded-xl shadow-2xl opacity-0 group-hover/mk:opacity-100 transition-all z-50 pointer-events-none whitespace-pre-wrap leading-relaxed ring-1 ring-white/10">
                      <span style={{ color: cfg.color }}>{cfg.emoji} {cfg.label}</span>
                      {ts && <><br/><span className="text-zinc-400 text-[10px]">{ts}</span></>}
                      <svg className="absolute text-zinc-900 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0" /></svg>
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeMarkup(segment.raw!, segment.content); }}
                      className="absolute -top-2.5 -right-2 bg-zinc-900 text-white rounded-full w-[16px] h-[16px] flex items-center justify-center opacity-0 group-hover/mk:opacity-100 transition-opacity shadow-lg active:scale-90"
                      title={`Quitar ${cfg.label}`}
                    >
                      <X size={9} />
                    </button>
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
            <div 
                ref={containerRef} 
                onClick={handleContainerClick} 
                onMouseUp={handleMouseUp} 
                onTouchEnd={handleMouseUp} 
                className="whitespace-pre-wrap break-words overflow-visible relative py-2 pb-24 cursor-text select-text touch-auto"
                style={{ WebkitUserSelect: 'text', userSelect: 'text' } as any}
            >
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
                                <div key={lineIndex} data-lineindex={lineIndex} onClick={(e) => handleBlockClick(lineIndex, e)} style={EXACT_STYLES} className="cursor-text text-zinc-800 dark:text-zinc-200 font-sans select-text">
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
                        <div key={lineIndex} data-lineindex={lineIndex} onClick={(e) => handleBlockClick(lineIndex, e)} style={EXACT_STYLES} className="cursor-text text-zinc-800 dark:text-zinc-200 font-sans select-text">
                            {renderSegments(line)}
                        </div>
                    );
                })}
            </div>

            {/* MENÚ FLOTANTE ALTO CONTRASTE */}
            {selectionMenu && (
                <div
                    className="floating-menu-container absolute z-[500] bg-white dark:bg-zinc-900 text-zinc-800 dark:text-white p-1.5 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center gap-1 border border-zinc-200 dark:border-zinc-700 animate-fadeIn origin-bottom"
                    style={{ top: selectionMenu.top, left: selectionMenu.left, transform: 'translate(-50%, -100%)' }}
                >
                    {/* Menú Principal — aparece directamente al seleccionar */}
                    {isTranslating ? (
                        <div className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-blue-500">
                            <Loader2 size={16} className="animate-spin" /> Traduciendo...
                        </div>
                    ) : (
                        <>


                            {/* RESALTADOR */}
                            <div 
                              className="relative group/hl flex items-center"
                              onMouseEnter={() => window.innerWidth >= 768 && setShowHlOptions(true)}
                              onMouseLeave={() => window.innerWidth >= 768 && setShowHlOptions(false)}
                            >
                                <button 
                                    onClick={() => {
                                        if (window.innerWidth < 768) {
                                            setShowHlOptions(!showHlOptions);
                                            setShowTagOptions(false);
                                            setShowMoreOptions(false);
                                        } else {
                                            doFormat('highlight');
                                        }
                                    }}
                                    title="Resaltar"
                                    className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${showHlOptions ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                >
                                    <Highlighter size={18} className="text-[#6B8E23] dark:text-[#ccff00]" />
                                </button>
                                {showHlOptions && (
                                    <div 
                                        ref={hlMenuRef}
                                        className="absolute bottom-full left-1/2 mb-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-1.5 z-[100] animate-fadeIn"
                                        style={{ transform: `translate(calc(-50% + ${hlShift}px), 0)` }}
                                    >
                                        <div className="absolute top-full left-0 w-full h-[12px] bg-transparent" />
                                        <button onClick={() => { doFormat('highlight'); setShowHlOptions(false); }} className="w-8 h-8 rounded-full border-2 border-zinc-400 bg-[#FACC15] transition-transform hover:scale-110" />
                                    </div>
                                )}
                            </div>

                            {/* ETIQUETAS */}
                            <div 
                              className="relative group/tags flex items-center"
                              onMouseEnter={() => window.innerWidth >= 768 && setShowTagOptions(true)}
                              onMouseLeave={() => window.innerWidth >= 768 && setShowTagOptions(false)}
                            >
                                <button 
                                    onClick={() => {
                                        if (window.innerWidth < 768) {
                                            setShowTagOptions(!showTagOptions);
                                            setShowHlOptions(false);
                                            setShowMoreOptions(false);
                                        }
                                    }}
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-zinc-500 transition-colors ${showTagOptions ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                    title="Etiquetar"
                                >
                                    <span>🏷️</span>
                                </button>

                                {showTagOptions && (
                                    <div 
                                        ref={tagMenuRef}
                                        className="absolute bottom-full left-1/2 mb-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-1.5 z-[100] animate-fadeIn min-w-[160px]"
                                        style={{ transform: `translate(calc(-50% + ${tagShift}px), 0)` }}
                                    >
                                        <div className="absolute top-full left-0 w-full h-[12px] bg-transparent" />
                                        <div className="grid grid-cols-2 gap-0.5">
                                            {(Object.entries(MARKER_TYPES) as [MarkerType, typeof MARKER_TYPES[MarkerType]][]).map(([key, cfg]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => { doFormat(key); setShowTagOptions(false); }}
                                                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                                                    style={{ color: cfg.color }}
                                                >
                                                    <span>{cfg.emoji}</span>
                                                    <span>{cfg.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* MÁS (Revelar, Link, Tachado, Título, Traducción) */}
                            <div className="relative group/more flex items-center">
                                <button 
                                    onClick={() => {
                                        setShowMoreOptions(!showMoreOptions);
                                        setShowHlOptions(false);
                                        setShowTagOptions(false);
                                    }}
                                    onMouseEnter={() => window.innerWidth >= 768 && setShowMoreOptions(true)}
                                    onMouseLeave={() => window.innerWidth >= 768 && setShowMoreOptions(false)}
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-zinc-500 transition-colors ${showMoreOptions ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                    title="Más opciones"
                                >
                                    <MoreHorizontal size={18} />
                                </button>

                                {showMoreOptions && (
                                    <div 
                                        ref={moreMenuRef}
                                        className="absolute bottom-full left-1/2 mb-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-1 flex flex-row items-center gap-0.5 z-[100] animate-fadeIn"
                                        style={{ transform: `translate(calc(-50% + ${moreShift}px), 0)` }}
                                    >
                                        <div className="absolute top-full left-0 w-full h-[12px] bg-transparent" />
                                        
                                        {/* REVELAR */}
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const lines = content.split('\n');
                                                let charCount = 0;
                                                let targetIndex = 0;
                                                const startOffset = selectionMenu.selectionState?.startOffset ?? 0;
                                                for(let i=0; i<lines.length; i++) {
                                                    charCount += lines[i].length + 1;
                                                    if (charCount > startOffset) { targetIndex = i; break; }
                                                }
                                                setEditingLine({ index: targetIndex });
                                                setSelectionMenu(null);
                                                setShowMoreOptions(false);
                                            }} 
                                            className="w-9 h-9 flex items-center justify-center text-zinc-500 hover:text-indigo-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                            title="Revelar Markdown"
                                        >
                                            <Maximize2 size={16} />
                                        </button>

                                        <div className="w-px h-6 bg-zinc-100 dark:bg-zinc-800 mx-0.5" />

                                        {/* NEGRITA */}
                                        <button onClick={() => { doFormat('bold'); setShowMoreOptions(false); }}
                                            className="w-9 h-9 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                            title="Negrita"
                                        >
                                            <Bold size={16} />
                                        </button>

                                        {/* ENLACE */}
                                        <button onClick={() => { doFormat('link'); setShowMoreOptions(false); }}
                                            className="w-9 h-9 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                            title="Enlace"
                                        >
                                            <LinkIcon size={16} />
                                        </button>

                                        {/* TACHADO */}
                                        <button onClick={() => { doFormat('strikethrough'); setShowMoreOptions(false); }}
                                            className="w-9 h-9 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                            title="Tachado"
                                        >
                                            <Strikethrough size={16} />
                                        </button>

                                        {/* TÍTULO */}
                                        <button onClick={() => { doFormat('h1'); setShowMoreOptions(false); }}
                                            className="w-9 h-9 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                            title="Título"
                                        >
                                            <Heading1 size={16} />
                                        </button>

                                        <div className="w-px h-6 bg-zinc-100 dark:bg-zinc-800 mx-0.5" />

                                        {/* TRADUCCIÓN */}
                                        <div className="flex items-center gap-0.5 px-0.5">
                                            <button onClick={() => { doTranslate('en', 'es'); setShowMoreOptions(false); }}
                                                className="px-2 py-1.5 bg-blue-500/10 text-blue-500 rounded-md text-[10px] font-black hover:bg-blue-500/20 transition-colors"
                                            >ES</button>
                                            <button onClick={() => { doTranslate('es', 'en'); setShowMoreOptions(false); }}
                                                className="px-2 py-1.5 bg-blue-500/10 text-blue-500 rounded-md text-[10px] font-black hover:bg-blue-500/20 transition-colors"
                                            >EN</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    );
};