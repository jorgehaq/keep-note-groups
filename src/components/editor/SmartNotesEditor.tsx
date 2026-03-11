// src/components/editor/SmartNotesEditor.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView, ViewPlugin, Decoration, WidgetType, ViewUpdate, keymap, lineNumbers } from '@codemirror/view';
import { RangeSet, StateEffect, Prec, StateField } from '@codemirror/state'; 
import { Highlighter, Languages, Loader2, Link as LinkIcon, Check, X } from 'lucide-react';
import { useImperativeHandle, forwardRef } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface SmartNotesEditorRef {
    focus: () => void;
}

interface SmartNotesEditorProps {
    noteId: string;
    initialContent: string;
    searchQuery?: string;
    onChange: (markdown: string) => void;
    noteFont?: string; 
    noteFontSize?: string; 
    noteLineHeight?: string;
    readOnly?: boolean;
    showLineNumbers?: boolean;
}

const MARKER_TYPES = {
  ins:   { label: 'Insight',   light: '#7C3AED', dark: '#A78BFA', emoji: '💡' },
  idea:  { label: 'Idea',      light: '#DC2626', dark: '#F87171', emoji: '🔥' },
  op:    { label: 'Opinión',   light: '#4D7C0F', dark: '#A3E635', emoji: '🌱' },
  duda:  { label: 'Duda',      light: '#0284C7', dark: '#38BDF8', emoji: '💧' },
  wow:   { label: 'Sorpresa',  light: '#C026D3', dark: '#F472B6', emoji: '✨' },
  pat:   { label: 'Patrón',    light: '#6D28D9', dark: '#C084FC', emoji: '🌀' },
  yo:    { label: 'Yo',        light: '#B45309', dark: '#FBBF24', emoji: '⭐' },
  ruido: { label: 'Ruido',     light: '#4B5563', dark: '#9CA3AF', emoji: '🔇' },
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

const ForceRedrawEffect = StateEffect.define<null>();

// Double-click reveal: tracks which line number has been "unlocked" for editing
const setRevealedLine = StateEffect.define<number | null>();

const revealedLineField = StateField.define<number | null>({
    create() { return null; },
    update(value, tr) {
        for (const e of tr.effects) {
            if (e.is(setRevealedLine)) return e.value;
        }
        // Auto-clear when the cursor moves to a different line
        if (value !== null && tr.selection) {
            const cursorLine = tr.newDoc.lineAt(tr.selection.main.head).number;
            if (cursorLine !== value) return null;
        }
        return value;
    }
});

// Tracks which line the user is actively typing on (docChanged only).
// Cleared when cursor moves to a different line without typing.
const editingLineField = StateField.define<number | null>({
    create() { return null; },
    update(value, tr) {
        // When text is typed/changed, mark the cursor's line as actively editing
        if (tr.docChanged) {
            const head = tr.selection
                ? tr.selection.main.head
                : tr.changes.mapPos(tr.startState.selection.main.head);
            return tr.newDoc.lineAt(head).number;
        }
        // When cursor moves to a different line without typing, clear the editing state
        if (value !== null && tr.selection) {
            const cursorLine = tr.newDoc.lineAt(tr.selection.main.head).number;
            if (cursorLine !== value) return null;
        }
        return value;
    }
});



class RemoveButtonWidget extends WidgetType {
    constructor(readonly from: number, readonly to: number, readonly innerText: string) { super(); }
    eq(other: RemoveButtonWidget) { return other.from === this.from && other.to === this.to && other.innerText === this.innerText; }
    toDOM(view: EditorView) {
        // Zero-width wrapper: takes no inline space, prevents text shifting
        const wrapper = document.createElement("span");
        wrapper.className = "cm-remove-btn-wrapper";
        const btn = document.createElement("span");
        btn.className = "cm-remove-btn";
        btn.innerHTML = "&times;"; 
        btn.title = "Quitar formato";
        btn.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); view.dispatch({ changes: { from: this.from, to: this.to, insert: this.innerText } }); };
        wrapper.appendChild(btn);
        return wrapper;
    }
}

class HrWidget extends WidgetType {
    toDOM() { const span = document.createElement("span"); span.className = "cm-custom-hr"; return span; }
}

class CodeBlockCopyWidget extends WidgetType {
    constructor(readonly code: string) { super(); }
    eq(other: CodeBlockCopyWidget) { return other.code === this.code; }
    toDOM() {
        const btn = document.createElement("button");
        btn.className = "cm-codeblock-copy";
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        btn.title = "Copiar código";
        btn.onmousedown = (e) => {
            e.preventDefault(); e.stopPropagation();
            navigator.clipboard.writeText(this.code).then(() => {
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
                setTimeout(() => { btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'; }, 1500);
            });
        };
        return btn;
    }
}

const cursorDotPlugin = ViewPlugin.fromClass(class {
    decorations: RangeSet<Decoration>;
    constructor(view: EditorView) { this.decorations = this.build(view); }
    update(update: ViewUpdate) {
        if (update.selectionSet || update.docChanged) {
            this.decorations = this.build(update.view);
        }
    }
    build(view: EditorView): RangeSet<Decoration> {
        const pos = view.state.selection.main.head;
        const line = view.state.doc.lineAt(pos);
        return Decoration.set([
            Decoration.line({ class: 'cm-cursor-indicator-line' }).range(line.from)
        ]);
    }
}, { decorations: v => v.decorations });

const KNOWN_LANGS = new Set(['bash','sh','zsh','javascript','js','typescript','ts','python','py','css','html','json','sql','java','go','rust','c','cpp','jsx','tsx','yaml','yml','xml','ruby','rb','php','swift','kotlin','dart','lua','r','scala','perl','powershell','dockerfile','makefile','graphql','toml','ini','markdown','md','plaintext','text','diff']);

/**
 * 🧹 Limpiador proactivo de bloques de código:
 * Quita saltos de línea extras antes del cierre de un bloque ```.
 */
const trimCodeBlocks = (text: string) => {
    // Busca bloques ```lang\nCONTENIDO\n+``` y quita los \n extras del final del contenido
    return text.replace(/(^|\n)```(\w*)\n([\s\S]*?)(\n+)```/g, (match, prefix, lang, code, newlines) => {
        // Mantenemos solo un salto de línea antes del ``` de cierre
        const fence = '```';
        return prefix + fence + lang + '\n' + code.trimEnd() + '\n' + fence;
    });
};

/**
 * 🧹 Limpiador de texto para el portapapeles:
 * Elimina la sintaxis interna de resaltados y etiquetas.
 */
const cleanTextForClipboard = (text: string) => {
    return text
        // 1. Quitar resaltados: {=texto=} -> texto
        .replace(/\{=([\s\S]*?)=\}/g, '$1')
        // 2. Quitar etiquetas y traducciones: [[tipo:ts|texto]] -> texto
        .replace(/\[\[(?:tr|[a-z]+):[^|\]]*\|([\s\S]*?)\]\]/g, '$1');
};

/**
 * Extension para interceptar el pegado y copiado
 */
const clipboardExtension = EditorView.domEventHandlers({
    copy: (event, view) => {
        const selection = view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to);
        if (!selection) return false;

        const cleaned = cleanTextForClipboard(selection);
        if (cleaned !== selection) {
            event.clipboardData?.setData('text/plain', cleaned);
            event.preventDefault();
            return true;
        }
        return false;
    },
    paste: (event, view) => {
        const text = event.clipboardData?.getData('text/plain');
        if (!text) return false;

        // Para pastes muy grandes, diferir el procesamiento
        if (text.length > 10000) {
            event.preventDefault();
            // Insertar directo sin procesar para no bloquear
            view.dispatch(view.state.replaceSelection(text));
            return true;
        }

        // Si detectamos bloques de código con exceso de enters, aplicamos limpieza
        if (text.includes('```') && /(\n{2,})```/.test(text)) {
            const cleaned = trimCodeBlocks(text);
            if (cleaned !== text) {
                event.preventDefault();
                view.dispatch(view.state.replaceSelection(cleaned));
                return true;
            }
        }
        return false;
    }
});

const createVisualMarkupPlugin = (translationsMapRef: React.MutableRefObject<Record<string, string>>, searchQueryRef: React.MutableRefObject<string>) => ViewPlugin.fromClass(class {
    decorations;
    constructor(view: EditorView) { this.decorations = this.buildDecorations(view); }
    update(update: ViewUpdate) {
        const needsRedraw = update.docChanged || update.viewportChanged || update.selectionSet || update.transactions.some(tr => tr.effects.some(e => e.is(ForceRedrawEffect)));
        if (needsRedraw) this.decorations = this.buildDecorations(update.view);
    }
    buildDecorations(view: EditorView) {
        const decos: any[] = [];
        const selection = view.state.selection.main;
        const lineAtCursor = view.state.doc.lineAt(selection.head).number;
        const revealedLine = view.state.field(revealedLineField, false);

        const safeReplace = (from: number, to: number) => { if (from < to) decos.push(Decoration.replace({}).range(from, to)); };
        const safeMark = (className: string, from: number, to: number, attrs?: any) => {
            if (from < to) decos.push((attrs ? Decoration.mark({ class: className, attributes: attrs }) : Decoration.mark({ class: className })).range(from, to));
        };

        for (let { from, to } of view.visibleRanges) {
            const textToSearch = view.state.doc.sliceString(from, to);

            // --- STEP 1: Code blocks via LINE decorations (line-by-line scanner) ---
            const codeBlockRanges: { from: number; to: number }[] = [];
            const isDark = document.documentElement.classList.contains('dark');
            const cbHeaderClass = isDark ? 'cm-cb-header-dark' : 'cm-cb-header';
            const cbLineClass = isDark ? 'cm-cb-line-dark' : 'cm-cb-line';
            const cbFooterClass = isDark ? 'cm-cb-footer-dark' : 'cm-cb-footer';
            // Solo escanear líneas visibles + buffer de contexto para detectar bloques abiertos
            const firstVisibleLine = view.state.doc.lineAt(view.visibleRanges[0]?.from ?? 0).number;
            const lastVisibleLine = view.state.doc.lineAt(view.visibleRanges[view.visibleRanges.length - 1]?.to ?? 0).number;
            const scanStart = Math.max(1, firstVisibleLine - 50);
            const scanEnd = Math.min(view.state.doc.lines, lastVisibleLine + 10);
            const totalLines = view.state.doc.lines;
            let scanLine = scanStart;
            while (scanLine <= scanEnd) {
                const line = view.state.doc.line(scanLine);
                const lineText = line.text;
                // Check if line starts with ``` (opening fence)
                if (lineText.startsWith('```') && lineText.trimEnd() !== '```' ? /^```\w*$/.test(lineText.trimEnd()) : lineText.trimEnd() === '```') {
                    const openLine = scanLine;
                    const rawLang = lineText.slice(3).trim().toLowerCase();
                    // Look for closing ``` (must be exactly ``` on its own line)
                    let closeLine = -1;
                    for (let search = openLine + 1; search <= totalLines; search++) {
                        if (view.state.doc.line(search).text.trimEnd() === '```') {
                            closeLine = search;
                            break;
                        }
                    }
                    if (closeLine > 0) {
                        const openLineObj = view.state.doc.line(openLine);
                        const closeLineObj = view.state.doc.line(closeLine);
                        codeBlockRanges.push({ from: openLineObj.from, to: closeLineObj.to });

                        // Collect code content for copy
                        const codeLines: string[] = [];
                        for (let cl = openLine + 1; cl < closeLine; cl++) {
                            codeLines.push(view.state.doc.line(cl).text);
                        }
                        const codeContent = codeLines.join('\n').trimEnd();

                        // Apply line decorations + hide ``` when not focused
                        const isRevealed = revealedLine === openLine || revealedLine === closeLine;

                        decos.push(Decoration.line({ class: cbHeaderClass }).range(openLineObj.from));
                        if (!isRevealed) {
                            // Hide the ```lang text
                            safeReplace(openLineObj.from, openLineObj.to);
                        }
                        decos.push(Decoration.widget({ widget: new CodeBlockCopyWidget(codeContent), side: 1 }).range(openLineObj.to, openLineObj.to));

                        for (let cl = openLine + 1; cl < closeLine; cl++) {
                            decos.push(Decoration.line({ class: cbLineClass }).range(view.state.doc.line(cl).from));
                        }

                        decos.push(Decoration.line({ class: cbFooterClass }).range(closeLineObj.from));
                        if (!isRevealed) {
                            // Hide the closing ```
                            safeReplace(closeLineObj.from, closeLineObj.to);
                        }

                        scanLine = closeLine + 1;
                        continue;
                    }
                }
                scanLine++;
            }

            // Helper to skip inline formatting inside code blocks
            const insideCB = (pos: number) => codeBlockRanges.some(r => pos >= r.from && pos < r.to);

            // --- STEP 2: Inline formatting (skip inside code blocks) ---
            const rules = [
                { type: 'hl', regex: /\{=([\s\S]*?)=\}/g }, { type: 'tr', regex: /\[\[tr:([^|\]]+)\|([\s\S]*?)\]\]/g },
                { type: 'mk-ins',    regex: /\[\[ins:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'mk-idea',   regex: /\[\[idea:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'mk-op',     regex: /\[\[op:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'mk-duda',   regex: /\[\[duda:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'mk-wow',    regex: /\[\[wow:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'mk-pat',    regex: /\[\[pat:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'mk-yo',     regex: /\[\[yo:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'mk-ruido',  regex: /\[\[ruido:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'h1', regex: /^(#{1,6})\s+(.*)/gm }, { type: 'bold', regex: /\*\*([\s\S]*?)\*\*/g }, 
                { type: 'italic_under', regex: /(?<!_)_([^_]+)_(?!_)/g }, { type: 'italic_star', regex: /(?<!\*)\*([^*]+)\*(?!\*)/g }, 
                { type: 'hr', regex: /^---+$/gm }, { type: 'md-link', regex: /\[([^\]]*)\]\(([^)\n]*)\)/g },
                { type: 'raw-link', regex: /(?<!\()(https?:\/\/[^\s\n)]+)/g }
            ];

            rules.forEach(rule => {
                let match;
                while ((match = rule.regex.exec(textToSearch)) !== null) {
                    const mFrom = from + match.index; const mTo = from + match.index + match[0].length;
                    
                    // Allow markers (hl, tr, mk-) even inside code blocks
                    const isMarker = rule.type === 'hl' || rule.type === 'tr' || rule.type.startsWith('mk-');
                    if (insideCB(mFrom) && !isMarker) continue;

                    const matchLine = view.state.doc.lineAt(mFrom).number;
                    const isRevealed = matchLine === revealedLine;

                    if (rule.type === 'raw-link') safeMark('cm-custom-link', mFrom, mTo, { 'data-url': match[0] });
                    else if (rule.type === 'md-link') {
                        if (isRevealed) safeMark('cm-custom-link', mFrom, mTo, { 'data-url': match[2] });
                        else {
                            safeReplace(mFrom, mFrom + 1); if (match[1].length > 0) safeMark('cm-custom-link', mFrom + 1, mFrom + 1 + match[1].length, { 'data-url': match[2] }); 
                            safeReplace(mFrom + 1 + match[1].length, mTo); decos.push(Decoration.widget({ widget: new RemoveButtonWidget(mFrom, mTo, match[1]), side: 1 }).range(mTo, mTo));
                        }
                    }
                    else if (rule.type === 'tr') {
                        const translatedText = match[1] === 'legacy' ? 'Traduciendo...' : match[1];
                        if (isRevealed) safeMark('cm-custom-tr', mFrom, mTo, { 'data-translation-text': translatedText });
                        else {
                            safeReplace(mFrom, mFrom + 6 + (match[1]?.length || 0));
                            safeMark('cm-custom-tr', mFrom + 6 + (match[1]?.length || 0), mTo - 2, { 'data-translation-text': translatedText });
                            safeReplace(mTo - 2, mTo); decos.push(Decoration.widget({ widget: new RemoveButtonWidget(mFrom, mTo, match[2]), side: 1 }).range(mTo, mTo));
                        }
                    } 
                    else if (rule.type === 'hl') {
                        if (isRevealed) safeMark('cm-custom-hl', mFrom, mTo);
                        else {
                            safeReplace(mFrom, mFrom + 2); safeMark('cm-custom-hl', mFrom + 2, mTo - 2);
                            safeReplace(mTo - 2, mTo); decos.push(Decoration.widget({ widget: new RemoveButtonWidget(mFrom, mTo, match[1]), side: 1 }).range(mTo, mTo));
                        }
                    }
                    else if (rule.type.startsWith('mk-')) {
                      const mType = rule.type.replace('mk-', '');
                      if (isRevealed) safeMark(`cm-custom-mk-${mType}`, mFrom, mTo);
                      else {
                        // Calcular longitud del prefijo [[tipo:timestamp|  y ocultar prefijo + sufijo ]]
                        const prefixLen = mTo - mFrom - match[1].length - 2; // 2 = ]]
                        safeReplace(mFrom, mFrom + prefixLen);                // ocultar [[tipo:timestamp|
                        safeMark(`cm-custom-mk-${mType}`, mFrom + prefixLen, mTo - 2); // marcar solo el texto
                        safeReplace(mTo - 2, mTo);                            // ocultar ]]
                        decos.push(Decoration.widget({ widget: new RemoveButtonWidget(mFrom, mTo, match[1]), side: 1 }).range(mTo, mTo));
                      }
                    }
                    else if (rule.type === 'hr') {
                        safeReplace(mFrom, mTo); decos.push(Decoration.widget({ widget: new HrWidget(), side: 0 }).range(mFrom, mFrom));
                        decos.push(Decoration.widget({ widget: new RemoveButtonWidget(mFrom, mTo, ""), side: 1 }).range(mTo, mTo));
                    }
                    else if (rule.type === 'h1') {
                        if (isRevealed) safeMark('cm-custom-h1', mFrom, mTo); 
                        else { const pLen = match[0].match(/^(#{1,6}\s+)/)?.[0].length || 2; safeReplace(mFrom, mFrom + pLen); safeMark('cm-custom-h1', mFrom + pLen, mTo); }
                    } 
                    else if (rule.type === 'bold') {
                        if (isRevealed) safeMark('cm-custom-bold', mFrom, mTo); else { safeReplace(mFrom, mFrom + 2); safeMark('cm-custom-bold', mFrom + 2, mTo - 2); safeReplace(mTo - 2, mTo); }
                    }
                    else if (rule.type === 'italic_under' || rule.type === 'italic_star') {
                        if (isRevealed) safeMark('cm-custom-italic', mFrom, mTo); else { safeReplace(mFrom, mFrom + 1); safeMark('cm-custom-italic', mFrom + 1, mTo - 1); safeReplace(mTo - 1, mTo); }
                    }
                }
            });

            const query = searchQueryRef.current.trim().toLowerCase();
            if (query.length > 0) {
                let startIndex = 0;
                while (true) {
                    const index = textToSearch.toLowerCase().indexOf(query, startIndex);
                    if (index === -1) break;
                    safeMark('cm-search-match', from + index, from + index + query.length); 
                    startIndex = index + query.length;
                }
            }
        }
        decos.sort((a, b) => a.from - b.from || a.to - b.to); return RangeSet.of(decos, true);
    }
}, { decorations: v => v.decorations });

// clickHandlerExtension movida dentro del componente para soportar múltiples instancias y estado local

// --- EL TEMA AHORA ES UNA FUNCIÓN DINÁMICA ---
const createNotesTheme = (font: string, size: string, lineHeight: string = 'standard') => {
    // Mapeo Inteligente de Fuentes
    const fontFamily = font === 'serif' ? 'var(--font-serif) !important' :
                       font === 'mono'  ? 'var(--font-mono) !important' :
                                          'var(--font-sans) !important';
    
    // Mapeo Inteligente de Tamaños
    const fontSize = size === 'small' ? '13px !important' : size === 'large' ? '18px !important' : '15px !important';

    // Mapeo Inteligente de Interlineado
    const lHeight = lineHeight === 'more' ? '2.0' : lineHeight === 'large' ? '2.5' : '1.6';

    return EditorView.theme({
        "&": {
            fontSize: fontSize,
            fontFamily: fontFamily,
            backgroundColor: "transparent !important", // Deja que el contenedor padre maneje el fondo standardized
            color: "inherit !important",               
            outline: "none !important", // Eliminar borde punteado de foco
            transition: "font-size 0.2s ease, font-family 0.2s ease", // Animación suave al cambiar ajustes
            WebkitTouchCallout: "none !important", // Ocultar menú nativo de "copy/paste" al tocar sostenido
            WebkitUserSelect: "text !important",
            userSelect: "text !important",
            width: "100%",
            maxWidth: "100%",
            minHeight: "100%",
            display: "flex",
            flexDirection: "column"
        },
        "&.cm-focused": {
            outline: "none !important"
        },
        ".cm-scroller": {
            fontFamily: fontFamily,
            fontSize: fontSize,
            overflowX: "hidden !important",
            width: "100%",
            flex: "1",
        },
        ".cm-content": {
            fontFamily: fontFamily,
            fontSize: fontSize,
            WebkitUserSelect: "text !important",
            userSelect: "text !important",
            whiteSpace: "pre-wrap !important",
            overflowWrap: "anywhere !important",
            wordBreak: "break-word !important",
        },
        "&.cm-focused .cm-cursor": { borderLeftColor: "#CCCCCC !important", borderLeftWidth: "2px !important" },
        ".dark &.cm-focused .cm-cursor": { borderLeftColor: "#CCCCCC !important" },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { 
            backgroundColor: "rgba(73, 64, 217, 0.45) !important",
            pointerEvents: "none !important" 
        },
        "&.cm-focused .cm-selectionLayer, .cm-selectionLayer": { 
            zIndex: "0 !important",
            pointerEvents: "none !important" 
        }, 
        ".cm-content *": { textDecoration: "none !important", boxShadow: "none !important" },
        ".cm-gutters": { backgroundColor: "transparent !important", border: "none !important", color: "#71717a" },
        ".dark .cm-gutters": { color: "#52525b" },
        ".cm-activeLineGutter": { backgroundColor: "transparent !important" },
        ".cm-lineNumbers .cm-gutterElement": { paddingRight: "10px !important", paddingLeft: "4px !important" },
        ".cm-line": { 
            lineHeight: lHeight, 
            paddingLeft: "12px !important", 
            borderLeft: "3px solid transparent",
            transition: "border-color 0.2s ease",
            overflowWrap: "anywhere !important",
        },
        ".cm-cursor-indicator-line": { 
            borderLeftColor: "#6366f1 !important"
        },
        ".cm-custom-hl": { backgroundColor: "#FACC15 !important", color: "#000000 !important", padding: "0 2px", fontWeight: "600 !important", borderRadius: "4px !important" },
        ".cm-custom-tr": { position: "relative", backgroundColor: "#10B981 !important", color: "#064E3B !important", padding: "0 2px", cursor: "help", borderRadius: "4px !important", fontWeight: "600 !important" },
        ".dark .cm-custom-tr": { backgroundColor: "#10B981 !important", color: "#064E3B !important", borderRadius: "4px !important", fontWeight: "600 !important" },
        ".cm-custom-h1": { fontSize: "1.4em", fontWeight: "bold", color: "inherit", lineHeight: "1.2" },
        ".cm-custom-bold": { fontWeight: "bold", color: "inherit" },
        ".cm-custom-italic": { fontStyle: "italic", color: "inherit" },
        ".cm-url, .cm-link, .cm-custom-link, .cm-custom-link *": { color: "#60A5FA !important", textDecoration: "underline !important", cursor: "pointer !important", transition: "opacity 0.2s", opacity: "1 !important" },
        ".cm-custom-link:hover": { opacity: "0.8 !important" },
        ".cm-custom-mk-ins":    { backgroundColor: "#7C3AED33 !important", color: "#7C3AED !important", border: "1px solid #7C3AED55", padding: "0 2px", borderRadius: "4px !important" },
        ".cm-custom-mk-idea":   { backgroundColor: "#DC262633 !important", color: "#DC2626 !important", border: "1px solid #DC262655", padding: "0 2px", borderRadius: "4px !important" },
        ".cm-custom-mk-op":     { backgroundColor: "#65A30D33 !important", color: "#65A30D !important", border: "1px solid #65A30D55", padding: "0 2px", borderRadius: "4px !important" },
        ".cm-custom-mk-duda":   { backgroundColor: "#0EA5E933 !important", color: "#0EA5E9 !important", border: "1px solid #0EA5E955", padding: "0 2px", borderRadius: "4px !important" },
        ".cm-custom-mk-wow":    { backgroundColor: "#DB277733 !important", color: "#DB2777 !important", border: "1px solid #DB277755", padding: "0 2px", borderRadius: "4px !important" },
        ".cm-custom-mk-pat":    { backgroundColor: "#6D28D933 !important", color: "#6D28D9 !important", border: "1px solid #6D28D955", padding: "0 2px", borderRadius: "4px !important" },
        ".cm-custom-mk-yo":     { backgroundColor: "#F59E0B33 !important", color: "#F59E0B !important", border: "1px solid #F59E0B55", padding: "0 2px", borderRadius: "4px !important" },
        ".cm-custom-mk-ruido":  { backgroundColor: "#6B728033 !important", color: "#6B7280 !important", border: "1px solid #6B728055", padding: "0 2px", borderRadius: "4px !important" },
        ".cm-custom-hr": { display: "inline-block", verticalAlign: "middle", width: "calc(100% - 30px)", height: "2px", backgroundColor: "#d4d4d8", margin: "12px 0", borderRadius: "2px" },
        ".dark .cm-custom-hr": { backgroundColor: "#3f3f3f" },
        ".cm-search-match": { backgroundColor: "rgba(245, 158, 11, 0.4) !important", borderBottom: "2px solid #f59e0b", color: "#000 !important" },
        ".cm-selectionMatch": { backgroundColor: "#518141 !important", color: "#000 !important" },
        ".cm-cb-header": { backgroundColor: "#F1F1F4", border: "1px solid #D4D4D8", borderBottom: "none", borderRadius: "8px 8px 0 0", fontFamily: fontFamily, fontSize: "0.85em", color: "#52525b", position: "relative", padding: "0 8px", minHeight: "2px" },
        ".cm-cb-header-dark": { backgroundColor: "#0D0D0F", border: "1px solid #3F3F46", borderBottom: "none", borderRadius: "8px 8px 0 0", fontFamily: fontFamily, fontSize: "0.85em", color: "#a1a1aa", position: "relative", padding: "0 8px", minHeight: "2px" },
        ".cm-cb-line": { backgroundColor: "#F1F1F4", borderLeft: "1px solid #D4D4D8", borderRight: "1px solid #D4D4D8", fontFamily: fontFamily, fontSize: "0.9em !important", color: "#312E81 !important", padding: "0 8px" },
        ".cm-cb-line-dark": { backgroundColor: "#0D0D0F", borderLeft: "1px solid #3F3F46", borderRight: "1px solid #3F3F46", fontFamily: fontFamily, fontSize: "0.9em !important", color: "#A78BFA !important", padding: "0 8px" },
        ".cm-cb-line ::selection, .cm-cb-line-dark ::selection, .cm-cb-line .cm-selectionBackground, .cm-cb-line-dark .cm-selectionBackground": { 
          backgroundColor: "#8B5CF6 !important", 
          color: "#ffffff !important"           
        },
        ".cm-cb-line ::-moz-selection, .cm-cb-line-dark ::-moz-selection": { 
          backgroundColor: "#8B5CF6 !important",
          color: "#ffffff !important"
        },
        ".cm-cb-footer": { backgroundColor: "#F1F1F4", border: "1px solid #D4D4D8", borderTop: "none", borderRadius: "0 0 8px 8px", fontFamily: fontFamily, fontSize: "0.85em", color: "#52525b", padding: "0 8px", minHeight: "2px" },
        ".cm-cb-footer-dark": { backgroundColor: "#0D0D0F", border: "1px solid #3F3F46", borderTop: "none", borderRadius: "0 0 8px 8px", fontFamily: fontFamily, fontSize: "0.85em", color: "#a1a1aa", padding: "0 8px", minHeight: "2px" },
        ".cm-codeblock-copy": { position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px", borderRadius: "4px", backgroundColor: "transparent", color: "#a1a1aa", cursor: "pointer", border: "none", transition: "all 0.15s", opacity: "0" },
        ".cm-cb-header:hover .cm-codeblock-copy, .cm-cb-header-dark:hover .cm-codeblock-copy": { opacity: "1" },
        ".cm-codeblock-copy:hover": { backgroundColor: "#E4E4E7", color: "#52525b" },
        ".dark .cm-codeblock-copy:hover": { backgroundColor: "#3F3F46", color: "#a1a1aa" },
        ".cm-remove-btn-wrapper": { display: "inline-block", width: "0px", overflow: "visible", verticalAlign: "baseline", position: "relative" },
        ".cm-remove-btn": { position: "absolute", display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: "#ef4444", border: "2px solid #ffffff", color: "white !important", width: "18px", height: "18px", left: "-6px", top: "-14px", borderRadius: "50%", fontSize: "14px", fontWeight: "bold", lineHeight: "1", cursor: "pointer !important", zIndex: "100", opacity: "0", transition: "opacity 0.15s", pointerEvents: "none" },
        ".cm-remove-btn-visible": { opacity: "1 !important", pointerEvents: "auto !important" },
        ".cm-remove-btn:hover": { opacity: "1 !important", pointerEvents: "auto !important", transform: "scale(1.1)" },
        ".dark .cm-content": { color: "#CCCCCC !important" },
        ".dark .cm-line": { color: "#CCCCCC !important" }
    });
};


export const SmartNotesEditor = forwardRef<SmartNotesEditorRef, SmartNotesEditorProps>(({
    noteId, initialContent, searchQuery, onChange, noteFont = 'sans', noteFontSize = 'medium', noteLineHeight = 'standard', readOnly = false, showLineNumbers = false
}, ref) => {
    const [content, setContent] = useState('');
    const editorRef = useRef<ReactCodeMirrorRef>(null);

    useImperativeHandle(ref, () => ({
        focus: () => {
            if (editorRef.current?.view) {
                editorRef.current.view.focus();
            }
        }
    }));
    const [menuState, setMenuState] = useState<{top: number, left: number, from: number, to: number, text: string, isMobile?: boolean} | null>(null);
    const [tooltipState, setTooltipState] = useState<{text: string, top: number, left: number} | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [showExpandedMenu, setShowExpandedMenu] = useState(false);
    const [lastAction, setLastAction] = useState<string>(
        () => localStorage.getItem('sme-last-action') || 'highlight'
    );
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const linkInputRef = useRef<HTMLInputElement>(null);
    const linkUrlRef = useRef(linkUrl);
    const showLinkInputRef = useRef(showLinkInput);
    
    useEffect(() => { linkUrlRef.current = linkUrl; }, [linkUrl]);
    useEffect(() => { showLinkInputRef.current = showLinkInput; }, [showLinkInput]);
    
    // Detectar modo oscuro de forma reactiva para los colores de las etiquetas
    const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);
    
    const translationsMapRef = useRef<Record<string, string>>({});
    const searchQueryRef = useRef<string>(searchQuery || ''); 
    const debounceChangeTimerRef = useRef<NodeJS.Timeout | null>(null);
    
    useEffect(() => {
        if (showLinkInput && linkInputRef.current) {
            linkInputRef.current.focus();
        }
    }, [showLinkInput]);

    // Exponer funciones de cierre para la lógica interna (Escape)
    const closeMenus = () => {
        setMenuState(null);
        setShowExpandedMenu(false);
        setShowLinkInput(false);
        window.getSelection()?.removeAllRanges();
    };

    const closeMenusOnly = () => {
        setMenuState(null);
        setShowExpandedMenu(false);
        setShowLinkInput(false);
    };

    // Regenera el tema visual solo si cambias la fuente o el tamaño en los ajustes
    const dynamicTheme = useMemo(() => createNotesTheme(noteFont, noteFontSize, noteLineHeight), [noteFont, noteFontSize, noteLineHeight]);

    useEffect(() => { searchQueryRef.current = searchQuery || ''; editorRef.current?.view?.dispatch({ effects: ForceRedrawEffect.of(null) }); }, [searchQuery]);

    const hoverTooltipExtension = useMemo(() => EditorView.domEventHandlers({
        mouseover: (e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('cm-custom-tr')) {
                const text = target.getAttribute('data-translation-text');
                if (text) {
                    const rect = target.getBoundingClientRect();
                    setTooltipState({ text, top: rect.top, left: rect.left + (rect.width / 2) });
                }
            } else if (target.classList.contains('cm-custom-link')) {
                const url = target.getAttribute('data-url');
                if (url) {
                    const rect = target.getBoundingClientRect();
                    setTooltipState({ text: url, top: rect.top, left: rect.left + (rect.width / 2) });
                }
            }
        },
        mouseout: (e) => { 
            const target = e.target as HTMLElement;
            if (target.classList.contains('cm-custom-tr') || target.classList.contains('cm-custom-link')) {
                setTooltipState(null); 
            }
        }
    }), []);

    useEffect(() => {
        // 🚀 FIX: Skip if user has unsaved local edits (debounce pending)
        // This prevents a race condition where parent re-renders with stale content
        // overwrite the user's latest typing, causing content loss.
        if (debounceChangeTimerRef.current) return;

        let clean = initialContent || '';
        if (clean.includes('<p>')) {
            clean = clean.replace(/<mark data-type="translation"[^>]*data-translation-text="([^"]+)"[^>]*>([\s\S]*?)<\/mark>/g, '[[tr:$1|$2]]')
                .replace(/<p>/g, '').replace(/<\/p>/g, '\n').replace(/<br>/g, '\n')
                .replace(/<mark data-type="highlight">([^<]+)<\/mark>/g, '{=$1=}')
                .replace(/<mark data-type="translation"[^>]*>([\s\S]*?)<\/mark>/g, '[[tr:legacy|$1]]');
        }
        setContent(prev => prev !== clean ? clean : prev);
    }, [initialContent, noteId]);

    // Restaurar cursor Y scroll al montar/cambiar nota
    useEffect(() => {
        const savedPos = localStorage.getItem(`cursor-pos-${noteId}`);
        const savedScroll = localStorage.getItem(`scroll-pos-${noteId}`);

        const timer = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const view = editorRef.current?.view;
                if (!view) return;

                // 1. Cursor: sin scrollIntoView para que no compita con el scroll
                if (savedPos) {
                    const pos = Math.min(parseInt(savedPos, 10), view.state.doc.length);
                    view.dispatch({ selection: { anchor: pos, head: pos } });
                }

                // 2. Scroll: siempre al final, sobreescribe cualquier scroll que haya hecho el cursor
                if (savedScroll) {
                    // Buscar el contenedor por clase directamente en el DOM
                    const scrollEl = document.querySelector(`.note-editor-scroll`) as HTMLElement;
                    if (scrollEl) scrollEl.scrollTop = parseInt(savedScroll, 10);
                }
            });
        });
        return () => cancelAnimationFrame(timer);
    }, [noteId]);

    // Escuchar scroll con retraso para asegurar que CodeMirror montó
    useEffect(() => {
        // Esperar a que CodeMirror monte
        const setup = setTimeout(() => {
            const view = editorRef.current?.view;
            // Buscar el contenedor por clase directamente — no depende de view
            const scrollEl = document.querySelector('.note-editor-scroll') as HTMLElement;
            if (!scrollEl) return;

            let scrollTimer: NodeJS.Timeout | null = null;
            const handleScroll = () => {
                if (scrollTimer) clearTimeout(scrollTimer);
                scrollTimer = setTimeout(() => {
                    localStorage.setItem(`scroll-pos-${noteId}`, String(scrollEl.scrollTop));
                }, 250);
            };

            scrollEl.addEventListener('scroll', handleScroll, { passive: true });

            // Guardar cleanup en ref para poder limpiar al desmontar
            (window as any)[`__scrollCleanup_${noteId}`] = () => {
                scrollEl.removeEventListener('scroll', handleScroll);
                if (scrollTimer) clearTimeout(scrollTimer);
            };
        }, 100);

        return () => {
            clearTimeout(setup);
            const cleanup = (window as any)[`__scrollCleanup_${noteId}`];
            if (cleanup) { cleanup(); delete (window as any)[`__scrollCleanup_${noteId}`]; }
        };
    }, [noteId]);

    const selectionListener = useMemo(() => EditorView.updateListener.of((update) => {
        if (update.viewportChanged || update.docChanged) setTooltipState(null);
        if (update.selectionSet) {
            const { main } = update.state.selection;

            // 1. Si la selección está vacía (clic simple), resetear menú
            if (main.empty) {
                // 🚀 PROTECCIÓN: No cerramos el menú si el input de link está activo.
                // handleBlur se encargará de confirmar/cerrar de forma segura.
                if (showLinkInputRef.current) return; 

                setMenuState(null);
                setShowExpandedMenu(false);
                setShowLinkInput(false);
            }

            // 2. Guardar posición del cursor en localStorage (debounced)
            const cursorHead = main.head;
            clearTimeout((window as any)[`__cur_${noteId}`]);
            (window as any)[`__cur_${noteId}`] = setTimeout(() => {
                localStorage.setItem(`cursor-pos-${noteId}`, String(cursorHead));
            }, 400);

            // 3. Mostrar menú si hay selección
            if (!main.empty) {
                const rect = update.view.coordsAtPos(main.from);
                if (rect) {
                    const isMobile = window.innerWidth < 768;
                    setMenuState({ 
                        top: isMobile ? 0 : rect.top - 8, 
                        left: isMobile ? 0 : rect.left, 
                        from: main.from, 
                        to: main.to, 
                        text: update.state.doc.sliceString(main.from, main.to),
                        isMobile 
                    });
                }
            }
        }
    }), [noteId]);

    const clickHandlerExtension = useMemo(() => Prec.highest(EditorView.domEventHandlers({
        mousedown: (e, view) => {
            const target = e.target as HTMLElement;
            if (target.closest('.floating-menu-container')) {
                return; // Si el clic es en el menú, no cerramos nada aquí
            }
            closeMenusOnly();
            
            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
            const { main } = view.state.selection;

            // 🚀 FIX DEFINITIVO: Si el clic es dentro de una selección, colapsamos manualmente.
            // Usamos preventDefault() para que el navegador no intente su propia lógica de selección/drag
            // que es lo que causa el "secuestro" visual. Luego forzamos el foco.
            if (pos !== null && !main.empty && pos >= main.from && pos <= main.to) {
                e.preventDefault(); 
                view.dispatch({
                    selection: { anchor: pos, head: pos },
                    scrollIntoView: false
                });
                window.getSelection()?.removeAllRanges();
                view.focus(); // Restaurar foco tras preventDefault
                return true; 
            }
            return false; 
        },
        contextmenu: (e, view) => {
            e.preventDefault();
            view.focus();
            
            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
            const docLines = view.state.doc.lines;
            
            // Si el clic es fuera del texto (abajo), usamos la última línea
            const targetLine = pos !== null 
                ? view.state.doc.lineAt(pos).number 
                : docLines;

            const currentRevealed = view.state.field(revealedLineField, false);
            
            view.dispatch({
                effects: [
                    setRevealedLine.of(currentRevealed === targetLine ? null : targetLine),
                    ForceRedrawEffect.of(null)
                ]
            });
            return true;
        },
        click: (e) => {
            const linkNode = (e.target as HTMLElement).closest('.cm-custom-link');
            if (linkNode) { 
                const url = linkNode.getAttribute('data-url'); 
                if (url) { window.open(url, '_blank', 'noopener,noreferrer'); return true; } 
            }
            return false;
        },
        mouseover: (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('.cm-custom-hl, .cm-custom-tr, .cm-custom-link')) {
                const span = target.closest('.cm-custom-hl, .cm-custom-tr, .cm-custom-link') as HTMLElement;
                let sibling = span?.nextElementSibling;
                while (sibling) {
                    if (sibling.classList.contains('cm-remove-btn-wrapper')) {
                        const btn = sibling.querySelector('.cm-remove-btn');
                        if (btn) btn.classList.add('cm-remove-btn-visible');
                        break;
                    }
                    sibling = sibling.nextElementSibling;
                }
            }
        },
        mouseout: (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('.cm-custom-hl, .cm-custom-tr, .cm-custom-link')) {
                const line = target.closest('.cm-line');
                if (line) line.querySelectorAll('.cm-remove-btn-visible').forEach(btn => btn.classList.remove('cm-remove-btn-visible'));
            }
        }
    })), [noteId]);

    const doFormat = (type: 'highlight' | 'link' | MarkerType) => {
        if (!menuState || !editorRef.current?.view) return;

        // Anti-mescolanza: si el texto seleccionado es el interior de un marcador existente,
        // usar el texto limpio (sin sintaxis anidada)
        const rawSelected = menuState.text;
        const innerClean = rawSelected.replace(/\[\[(ins|idea|op|duda|wow|pat|yo|ruido):[^\|]+\|([^\]]+)\]\]/g, '$2');

        let replacement = '';
        if (type === 'highlight') {
            replacement = `{=${innerClean}=}`;
        } else if (type === 'link') {
            if (showLinkInput) return; // Reset Guard: No limpiar si ya estamos editando
            setShowLinkInput(true);
            setLinkUrl('');
            setLastAction('link');
            localStorage.setItem('sme-last-action', 'link');
            return; // Esperar a confirmLink sin cerrar el menú
        } else if (type in MARKER_TYPES) {
            const ts = generateMarkerTimestamp();
            replacement = `[[${type}:${ts}|${innerClean}]]`;
        }

        editorRef.current.view.dispatch({ changes: { from: menuState.from, to: menuState.to, insert: replacement }, selection: { anchor: menuState.from + replacement.length } });
        setMenuState(null);
        setShowExpandedMenu(false);
        setShowLinkInput(false);
    };

    const confirmLink = () => {
        if (!menuState || !editorRef.current?.view) return;
        const textToLink = menuState.text.replace(/\[\[(ins|idea|op|duda|wow|pat|yo|ruido):[^\|]+\|([^\]]+)\]\]/g, '$2').trim();
        // Usamos la ref si estamos en un contexto asíncrono (como blur)
        const currentUrl = linkUrlRef.current.trim();
        
        // Si hay una URL, aplicamos formato link. Si no, dejamos el texto limpio.
        const replacement = currentUrl ? `[${textToLink}](${currentUrl})` : textToLink;
        
        editorRef.current.view.dispatch({ 
            changes: { from: menuState.from, to: menuState.to, insert: replacement }, 
            selection: { anchor: menuState.from + replacement.length } 
        });
        
        setMenuState(null);
        setShowExpandedMenu(false);
        setShowLinkInput(false);
        setLinkUrl('');
    };


    const doTranslate = async (targetLang: 'en' | 'es') => {
        if (!menuState || !editorRef.current?.view) return;
        const textToTranslate = menuState.text.trim();
        if (!textToTranslate) return;

        console.log("🚀 Iniciando traducción a través de Edge Function...");
        setIsTranslating(true);
        
        try {
            // 1. Obtener sesión para el historial
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Debes iniciar sesión para traducir.");

            const sourceLang = targetLang === 'en' ? 'es' : 'en';

            // 2. Llamada nativa a Supabase (Maneja CORS y JWT automáticamente)
            const { data, error } = await supabase.functions.invoke('translateMyAppNotes', {
                body: {
                    sourceLang,
                    targetLang,
                    text: textToTranslate
                },
            });

            // 3. Manejo de errores de la función
            if (error) {
                console.error("🚨 Error capturado por Supabase/Deno:", error);
                throw new Error(error.message);
            }

            // 4. Éxito: Procesar traducción
            console.log("✅ Traducción recibida:", data.translation);
            const translatedText = data.translation;
            const replacement = `[[tr:${translatedText}|${textToTranslate}]]`;
            
            // 5. Guardar en el historial de traducciones
            await supabase.from('translations').insert([{
                user_id: session.user.id,
                source_text: textToTranslate,
                translated_text: translatedText,
                source_lang: sourceLang,
                target_lang: targetLang
            }]);

            // 6. Actualizar editor
            editorRef.current.view.dispatch({ 
                changes: { from: menuState.from, to: menuState.to, insert: replacement }, 
                selection: { anchor: menuState.from + replacement.length } 
            });
            setMenuState(null);
            setShowExpandedMenu(false);

        } catch (err: any) {
            console.error("❌ Error fatal en traducción:", err);
            alert(`Error al traducir: ${err.message}`);
        } finally {
            setIsTranslating(false);
        }
    };

    const handleChange = (value: string) => {
        setContent(value); 
        if (debounceChangeTimerRef.current) clearTimeout(debounceChangeTimerRef.current);
        debounceChangeTimerRef.current = setTimeout(() => onChange(value), 800); 
    };

    const handleBlur = (e: any) => {
        const related = e.relatedTarget as HTMLElement;
        const isFocusMovingToMenuImmediately = related && (related.closest('.floating-menu-container') || related.classList.contains('floating-menu-container'));
        
        if (isFocusMovingToMenuImmediately) {
            return; // El foco se movió directamente al menú
        }

        // Delay para verificar document.activeElement de forma definitiva (clics en input)
        setTimeout(() => {
            const active = document.activeElement;
            const isInsideMenu = active && (active.closest('.floating-menu-container') || active.classList.contains('floating-menu-container'));
            
            if (isInsideMenu) return; 

            // SECUENCIAL: Si perdemos el foco fuera del menú y el input estaba activo, autoconfirmar
            if (showLinkInputRef.current) {
                confirmLink();
            } else {
                const cleaned = trimCodeBlocks(content);
                if (cleaned !== content) {
                    setContent(cleaned);
                    if (debounceChangeTimerRef.current) clearTimeout(debounceChangeTimerRef.current);
                    onChange(cleaned);
                } else if (debounceChangeTimerRef.current) {
                    clearTimeout(debounceChangeTimerRef.current);
                    onChange(content);
                }
                
                setMenuState(null);
                setShowExpandedMenu(false);
                setShowLinkInput(false);
            }
        }, 150);
    };

    const menuWidth = 260; 
    const subMenuWidth = 240; 
    const margin = 16;
    
    // Calcular left restringido para el menú principal
    let clampedLeft = menuState?.left ?? 0;
    if (menuState && !menuState.isMobile) {
        const halfWidth = menuWidth / 2;
        clampedLeft = Math.max(halfWidth + margin, Math.min(window.innerWidth - halfWidth - margin, menuState.left));
    }

    // Calcular desplazamiento del submenú si se sale de la pantalla
    // El botón Tag está aprox a -30px del centro del menú principal
    const getSubMenuStyle = () => {
        if (!menuState || menuState.isMobile) return { left: '50%', transform: 'translateX(-50%)' };
        const tagButtonViewportLeft = clampedLeft - 30; 
        const halfSub = subMenuWidth / 2;
        let offset = 0;
        
        if (tagButtonViewportLeft - halfSub < margin) offset = margin - (tagButtonViewportLeft - halfSub);
        else if (tagButtonViewportLeft + halfSub > window.innerWidth - margin) offset = (window.innerWidth - margin) - (tagButtonViewportLeft + halfSub);
        
        return { 
            left: '50%', 
            transform: `translateX(calc(-50% + ${offset}px))` 
        };
    };

    const doActionAndSave = async (actionKey: string, fn: () => void | Promise<void>) => {
        const res = fn();
        if (res instanceof Promise) await res;
        setLastAction(actionKey);
        localStorage.setItem('sme-last-action', actionKey);
        
        // Si no es un link guiado, cerramos todo. Si es link, el input tomará el relevo.
        if (actionKey !== 'link') {
            setShowExpandedMenu(false);
            setShowLinkInput(false);
            setMenuState(null);
        } else {
            // Para links, cerramos el expandido para dejar paso al input
            setShowExpandedMenu(false);
            setShowLinkInput(true);
            setLinkUrl('');
        }
    };

    const getLastActionDisplay = () => {
        if (lastAction === 'highlight') return { emoji: '🖊️', title: 'Resaltar' };
        if (lastAction === 'en') return { emoji: 'EN', title: 'Traducir → EN' };
        if (lastAction === 'es') return { emoji: 'ES', title: 'Traducir → ES' };
        if (lastAction === 'link') return { emoji: '🔗', title: 'Link' };
        const m = MARKER_TYPES[lastAction as MarkerType];
        if (m) return { emoji: m.emoji, title: m.label };
        return { emoji: '🖊️', title: 'Resaltar' };
    };

    const fireLastAction = async () => {
        if (lastAction === 'highlight') await doActionAndSave('highlight', () => doFormat('highlight'));
        else if (lastAction === 'en') await doActionAndSave('en', () => doTranslate('en'));
        else if (lastAction === 'es') await doActionAndSave('es', () => doTranslate('es'));
        else if (lastAction === 'link') {
            if (showLinkInput) return; // Si ya está abierto, no hacer nada para evitar reset de URL
            setShowExpandedMenu(false);
            setShowLinkInput(true);
            setLinkUrl('');
            setLastAction('link');
            localStorage.setItem('sme-last-action', 'link');
        }
        else if (lastAction in MARKER_TYPES) await doActionAndSave(lastAction, () => doFormat(lastAction as MarkerType));
        else await doActionAndSave('highlight', () => doFormat('highlight'));
    };

    return (
        <div 
            className={`relative group/editor w-full h-full min-h-0 flex flex-col bg-transparent ${readOnly ? 'pointer-events-none' : ''}`}
            onContextMenu={(e) => e.preventDefault()}
        >
            <CodeMirror
                key={String(showLineNumbers)}
                ref={editorRef} 
                value={content} 
                onChange={handleChange} 
                onBlur={handleBlur} 
                theme="none" 
                readOnly={readOnly} 
                height="100%"
                className="flex-1 w-full text-zinc-900 dark:text-[#CCCCCC]" 
                extensions={[
                    // 🚀 MAGIA ANTI-HIJACKING: Prec.highest toma el control absoluto del evento
                    Prec.highest(
                        keymap.of([
                            { 
                                key: 'Tab', 
                                preventDefault: true, 
                                run: (view) => { 
                                    // replaceSelection inyecta en el cursor y lo mueve al final de la inserción automáticamente
                                    view.dispatch(view.state.replaceSelection('    ')); 
                                    return true; 
                                } 
                            },
                            {
                                key: 'Escape',
                                run: (view) => {
                                    // Limpiar selección de CodeMirror si existe
                                    if (!view.state.selection.main.empty) {
                                        view.dispatch({
                                            selection: { anchor: view.state.selection.main.head }
                                        });
                                    }
                                    
                                    // Limpiar selección nativa del navegador
                                    window.getSelection()?.removeAllRanges();

                                    // Cerrar menús y ocultar markdown revelado
                                    view.dispatch({
                                        effects: [setRevealedLine.of(null), ForceRedrawEffect.of(null)]
                                    });
                                    closeMenus();
                                    return true;
                                }
                            }
                        ])
                    ),
                    
                    ...(showLineNumbers ? [lineNumbers()] : []),
                    cursorDotPlugin,
                    markdown({ base: markdownLanguage, codeLanguages: languages }),
                    dynamicTheme,
                    revealedLineField,
                    editingLineField,
                    createVisualMarkupPlugin(translationsMapRef, searchQueryRef), 
                    clickHandlerExtension, hoverTooltipExtension, selectionListener, clipboardExtension, EditorView.lineWrapping, EditorView.editable.of(!readOnly)
                ]}
                basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false, syntaxHighlighting: false, drawSelection: true }}
            />
             {tooltipState && (
                <div
                    className="fixed z-[9999] bg-[#f4f4f5] text-black text-[13px] font-medium font-sans px-3 py-2 rounded-lg border border-zinc-200 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] pointer-events-none whitespace-pre-wrap leading-tight"
                    style={{ top: tooltipState.top - 8, left: tooltipState.left, transform: 'translate(-50%, -100%)', width: 'max-content', maxWidth: '250px' }}
                >
                    {tooltipState.text}
                </div>
            )}
            {menuState && (
                <div
                    className="floating-menu-container fixed z-[100] flex flex-col items-center gap-1.5 animate-fadeIn origin-bottom pointer-events-auto"
                    style={{ 
                        top: menuState.top, 
                        left: clampedLeft, 
                        transform: menuState.isMobile ? 'translateX(-50%)' : 'translate(-50%, -100%)' 
                    }}
                    onMouseDown={(e) => {
                        // IMPORTANTE: No dar preventDefault si es un INPUT para que gane el foco
                        if ((e.target as HTMLElement).tagName !== 'INPUT') {
                            e.preventDefault();
                        }
                        e.stopPropagation();
                    }}
                >
                    {/* Input de Link — aparece cuando se solicita */}
                    {showLinkInput && (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl p-1.5 flex items-center gap-1.5 animate-fadeIn">
                            <input
                                ref={linkInputRef}
                                type="text"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') confirmLink();
                                    if (e.key === 'Escape') setShowLinkInput(false);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Pegar URL..."
                                className="bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg px-2.5 py-1.5 text-xs w-48 focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                            />
                            <button 
                                onClick={confirmLink}
                                className="p-1.5 hover:bg-green-500/10 text-green-600 rounded-lg transition-colors"
                                title="Confirmar"
                            >
                                <Check size={16} />
                            </button>
                            <button 
                                onClick={() => setShowLinkInput(false)}
                                className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                                title="Cancelar"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {/* Globo expandido — aparece arriba (mutuamente exclusivo con link input para limpieza) */}
                    {showExpandedMenu && !showLinkInput && (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl p-1.5 flex flex-col gap-1">
                            {/* Fila 1 marcadores */}
                            <div className="flex gap-1">
                                {(['ins','idea','op','duda'] as MarkerType[]).map(key => {
                                    const cfg = MARKER_TYPES[key];
                                    return (
                                        <button key={key}
                                            onClick={() => doActionAndSave(key, () => doFormat(key))}
                                            title={cfg.label}
                                            className="w-9 h-9 rounded-lg flex items-center justify-center text-base hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                        >{cfg.emoji}</button>
                                    );
                                })}
                            </div>
                            {/* Fila 2 marcadores */}
                            <div className="flex gap-1">
                                {(['wow','pat','yo','ruido'] as MarkerType[]).map(key => {
                                    const cfg = MARKER_TYPES[key];
                                    return (
                                        <button key={key}
                                            onClick={() => doActionAndSave(key, () => doFormat(key))}
                                            title={cfg.label}
                                            className="w-9 h-9 rounded-lg flex items-center justify-center text-base hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                        >{cfg.emoji}</button>
                                    );
                                })}
                            </div>
                            {/* Separador */}
                            <div className="h-px bg-zinc-200 dark:bg-zinc-700 mx-1" />
                            {/* Fila 3: highlight, EN, ES, link */}
                            <div className="flex gap-1">
                                <button onClick={() => doActionAndSave('highlight', () => doFormat('highlight'))}
                                    title="Resaltar"
                                    className="w-9 h-9 rounded-lg flex items-center justify-center text-base hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                    🖊️
                                </button>
                                <button onClick={() => doActionAndSave('en', () => doTranslate('en'))}
                                    title="Traducir → EN"
                                    className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-blue-500 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-colors">
                                    EN
                                </button>
                                <button onClick={() => doActionAndSave('es', () => doTranslate('es'))}
                                    title="Traducir → ES"
                                    className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-blue-500 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-colors">
                                    ES
                                </button>
                                <button onClick={() => doActionAndSave('link', () => doFormat('link'))}
                                    title="Convertir a link"
                                    className="w-9 h-9 rounded-lg flex items-center justify-center text-base hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                    🔗
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Globo compacto — siempre visible */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-1 flex items-center gap-0.5 pointer-events-auto">
                        {isTranslating ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-blue-500">
                                <Loader2 size={13} className="animate-spin" /> Traduciendo...
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={fireLastAction}
                                    title={getLastActionDisplay().title}
                                    className={`w-9 h-9 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                                        (lastAction === 'en' || lastAction === 'es') ? 'text-xs font-bold text-blue-500' : 'text-base'
                                    }`}
                                >
                                    {getLastActionDisplay().emoji}
                                </button>
                                <button
                                    onClick={() => {
                                        if (showLinkInput) {
                                            setShowLinkInput(false);
                                            setShowExpandedMenu(true);
                                        } else {
                                            setShowExpandedMenu(p => !p);
                                        }
                                    }}
                                    title="Más opciones"
                                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                                        showExpandedMenu || showLinkInput
                                            ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white'
                                            : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                    }`}
                                >
                                    ···
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});