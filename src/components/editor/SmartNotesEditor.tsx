// src/components/editor/SmartNotesEditor.tsx
import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView, ViewPlugin, Decoration, WidgetType, ViewUpdate, keymap, lineNumbers, showPanel, Panel } from '@codemirror/view';
import { RangeSet, StateEffect, Prec, StateField, RangeSetBuilder } from '@codemirror/state'; 
import { search, openSearchPanel, closeSearchPanel } from '@codemirror/search';
import { Plus, Settings, Grid, X, Check, Trash2, List, Type, Languages, Highlighter, Tag, StickyNote, History, Info, ChevronRight, ChevronDown, ChevronLeft, Search, Loader2, Tags, Image, Link as LinkIcon, Maximize2, Minimize2, ExternalLink, Bold, Italic, Strikethrough, Heading, MoreHorizontal } from 'lucide-react';
import { useImperativeHandle, forwardRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    autoHeight?: boolean; // If true, height is auto instead of 100%
    onEnterAction?: () => void; // Triggered on Enter (if not shifted)
    onBackspaceEmpty?: () => void; // Triggered if Backspace is pressed when completely empty
}

const MARKER_TYPES = {
  ins:    { label: 'Insight',   light: '#7C3AED', dark: '#A78BFA', emoji: '🧐' },
  duda:   { label: 'Duda',      light: '#0284C7', dark: '#38BDF8', emoji: '🤔' },
  idea:   { label: 'Idea',      light: '#DC2626', dark: '#F87171', emoji: '🤩' },
  op:     { label: 'Opinión',   light: '#4D7C0F', dark: '#A3E635', emoji: '😤' },
  wow:    { label: 'Sorpresa',  light: '#C026D3', dark: '#F472B6', emoji: '😮' },
  pat:    { label: 'Patrón',    light: '#6D28D9', dark: '#C084FC', emoji: '👀' },
  yo:     { label: 'Yo',        light: '#B45309', dark: '#FBBF24', emoji: '🥹' },
  ruido:  { label: 'Ruido',     light: '#4B5563', dark: '#9CA3AF', emoji: '🥱' },
  contra: { label: 'Contradicción', light: '#991B1B', dark: '#EF4444', emoji: '😈' },
} as const;

const HL_COLORS = {
  y: { label: 'Amarillo', hex: '#FFFF00', class: 'cm-hl-y' },
  r: { label: 'Rojo',     hex: '#FF0000', class: 'cm-hl-r' },
  b: { label: 'Azul',     hex: '#3282F6', class: 'cm-hl-b' },
  g: { label: 'Verde',    hex: '#92D050', class: 'cm-hl-g' },
} as const;

type MarkerType = keyof typeof MARKER_TYPES;
type HlColorKey = keyof typeof HL_COLORS;

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
        if (value !== null && tr.selection) {
            const cursorLine = tr.newDoc.lineAt(tr.selection.main.head).number;
            if (cursorLine !== value) return null;
        }
        return value;
    }
});

// 🚀 STABILITY FIX: Move layout-affecting decorations (tables, code blocks) to a StateField.
// This prevents 'No tile at position' errors because decorations are stable during layout measurement.
const blockMarkupField = StateField.define<RangeSet<Decoration>>({
    create() { return RangeSet.empty; },
    update(decos, tr) {
        // Map existing decorations - essential for persistence during typing
        decos = decos.map(tr.changes);
        
        // Only re-scan if document changed or revealed line changed
        const revealedLine = tr.state.field(revealedLineField, false);
        const oldRevealedLine = tr.startState.field(revealedLineField, false);
        const forceRedraw = tr.effects.some(e => e.is(ForceRedrawEffect));

        if (!tr.docChanged && revealedLine === oldRevealedLine && !forceRedraw) return decos;

        const builder = new RangeSetBuilder<Decoration>();
        const doc = tr.newDoc;
        const totalLines = doc.lines;

        // Shared scanners from buildDecorations (optimized for StateField)
        const cbHeaderClass = 'cm-cb-header';
        const cbLineClass = 'cm-cb-line';
        const cbFooterClass = 'cm-cb-footer';

        let lineNum = 1;
        while (lineNum <= totalLines) {
            const line = doc.line(lineNum);
            const text = line.text;
            
            // 1. Code Blocks
            if (text.startsWith('```') && (text.trimEnd() !== '```' ? /^```\w*$/.test(text.trimEnd()) : text.trimEnd() === '```')) {
                const openLine = lineNum;
                let closeLine = -1;
                for (let s = openLine + 1; s <= totalLines; s++) {
                    if (doc.line(s).text.trimEnd() === '```') { closeLine = s; break; }
                }
                if (closeLine > 0) {
                    const openObj = doc.line(openLine);
                    const closeObj = doc.line(closeLine);
                    const isRevealed = revealedLine === openLine || revealedLine === closeLine;

                    // Pre-scan code lines for the copy widget
                    const codeLines: string[] = [];
                    for (let cl = openLine + 1; cl < closeLine; cl++) {
                        codeLines.push(doc.line(cl).text);
                    }
                    const codeContent = codeLines.join('\n').trimEnd();

                    // 1. Header
                    builder.add(openObj.from, openObj.from, Decoration.line({ class: cbHeaderClass }));
                    if (!isRevealed) builder.add(openObj.from, openObj.to, Decoration.replace({}));
                    
                    // 2. Copy button widget (Must be after header 'from' but before body lines)
                    builder.add(openObj.to, openObj.to, Decoration.widget({ 
                        widget: new CodeBlockCopyWidget(codeContent), 
                        side: 1,
                        block: false // Ensure it doesn't break line flow
                    }));
                    
                    // 3. Body
                    for (let cl = openLine + 1; cl < closeLine; cl++) {
                        const clObj = doc.line(cl);
                        builder.add(clObj.from, clObj.from, Decoration.line({ class: cbLineClass }));
                    }

                    // 4. Footer
                    builder.add(closeObj.from, closeObj.from, Decoration.line({ class: cbFooterClass }));
                    if (!isRevealed) builder.add(closeObj.from, closeObj.to, Decoration.replace({}));

                    lineNum = closeLine + 1;
                    continue;
                }
            }

            // 2. Tables
            const trimmed = text.trim();
            if (trimmed.startsWith('|') && lineNum < totalLines) {
                const nextLine = doc.line(lineNum + 1).text.trim();
                if (nextLine.startsWith('|') && /^[|\s-:]+$/.test(nextLine) && nextLine.includes('-')) {
                    const startLine = lineNum;
                    let endLine = lineNum + 1;
                    for (let s = lineNum + 2; s <= totalLines; s++) {
                        if (doc.line(s).text.trim().startsWith('|')) endLine = s; else break;
                    }
                    const startObj = doc.line(startLine);
                    const endObj = doc.line(endLine);
                    
                    let revealed = false;
                    for (let r = startLine; r <= endLine; r++) if (revealedLine === r) { revealed = true; break; }

                    if (!revealed) {
                        const tableText = doc.sliceString(startObj.from, endObj.to);
                        // block: true es vital para la estabilidad de redimensionado
                        builder.add(startObj.from, endObj.to, Decoration.replace({ 
                            widget: new TableHtmlWidget(tableText), 
                            block: true 
                        }));
                    }
                    lineNum = endLine + 1;
                    continue;
                }
            }

            lineNum++;
        }
        return builder.finish();
    },
    provide: f => EditorView.decorations.from(f)
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

class HrBigWidget extends WidgetType {
    toDOM() { const span = document.createElement("span"); span.className = "cm-custom-hr-big"; return span; }
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
class TableWidget extends WidgetType {
    constructor(readonly content: string) { super(); }
    eq(other: TableWidget) { return other.content === this.content; }
    toDOM() {
        const div = document.createElement("div");
        div.className = "cm-table-widget-container prose dark:prose-invert max-w-none";
        
        // We use a separate root for ReactMarkdown if we wanted to use React, 
        // but here it's easier to just use standard DOM for CodeMirror widgets
        // OR we can use createRoot but it's overkill for a simple table.
        // Actually, react-markdown can be used to generate HTML string or we can use a simpler approach.
        // Let's use a dummy react root for the widget to keep it clean.
        return div;
    }
    // We override updateDOM to actually render the React component
    render(container: HTMLElement) {
        // Since we are in a class and want to use React, we can't easily "render" into toDOM 
        // without a stable root. But CodeMirror 6 supports React via wrappers.
        // However, for this project, let's keep it simple: A simple HTML table generator 
        // that handles the basic GFM table syntax detected.
    }
}

const escapeHtml = (text: string) => {
    return text.replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m] || m));
};

// Simple Markdown Table to HTML converter to avoid React root complexity inside CM6 widgets
const renderMarkdownTable = (md: string): string => {
    const lines = md.trim().split('\n');
    if (lines.length < 2) return '';

    let html = '<table class="cm-rendered-table"><thead>';
    
    // Header
    const headerCells = lines[0].split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
    html += '<tr>' + headerCells.map(c => `<th>${escapeHtml(c.trim())}</th>`).join('') + '</tr></thead><tbody>';

    // Rows (skip index 1 which is the separator |---|---|)
    for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').filter((_, j, arr) => j > 0 && j < arr.length - 1);
        html += '<tr>' + cells.map(c => `<td>${escapeHtml(c.trim())}</td>`).join('') + '</tr>';
    }

    html += '</tbody></table>';
    return html;
};

class TableHtmlWidget extends WidgetType {
    constructor(readonly content: string) { super(); }
    eq(other: TableHtmlWidget) { return other.content === this.content; }
    toDOM() {
        const div = document.createElement("div");
        div.className = "cm-table-container";
        div.innerHTML = renderMarkdownTable(this.content);
        return div;
    }
}
const cursorDotPlugin = ViewPlugin.fromClass(class {
    decorations: RangeSet<Decoration>;
    constructor(view: EditorView) { this.decorations = this.build(view); }
    update(update: ViewUpdate) {
        if (update.selectionSet || update.docChanged || update.focusChanged) {
            this.decorations = this.build(update.view);
        }
    }
    build(view: EditorView): RangeSet<Decoration> {
        if (!view.hasFocus) return Decoration.none;
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
        // 1. Quitar resaltados nuevos: [[hl:ts|texto|c]] -> texto
        .replace(/\[\[hl:[^|]+\|([^|\]]+)\|[yrbg]\]\]/g, '$1')
        // 2. Quitar resaltados antiguos: {=texto=} -> texto
        .replace(/\{=([\s\S]*?)=\}/g, '$1')
        // 3. Quitar etiquetas y traducciones: [[tipo:ts|texto]] -> texto
        .replace(/\[\[(?:tr|[a-z]+):[^|\]]*\|([\s\S]*?)\]\]/g, '$1');
};

/**
 * 📦 Extensión para Arrastrar y Soltar (Natural Drag & Drop):
 * Asegura que el texto arrastrado entre editores se trate como COPIA por defecto.
 */
const dragDropExtension = EditorView.domEventHandlers({
    dragstart: (event, view) => {
        if (event.dataTransfer && view.state.selection.main.from !== view.state.selection.main.to) {
            // Fuerza que el navegador trate el arrastre como una COPIA, no un movimiento.
            // Esto evita que el texto original sea borrado al soltarlo en otro editor.
            event.dataTransfer.effectAllowed = 'copy';
            const selection = view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to);
            event.dataTransfer.setData('text/plain', selection);
        }
    },
    dragover: (event) => {
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
            event.preventDefault();
        }
    },
    drop: (event, view) => {
        // En CodeMirror 6, el evento drop nativo suele manejar la inserción.
        // Pero al forzar 'copy', prevenimos que el origen reciba la señal de borrado.
        if (event.dataTransfer) {
            const text = event.dataTransfer.getData('text/plain');
            if (text) {
                // Dejamos que CodeMirror maneje la inserción en la posición del mouse
                // o podemos forzarla manualmente si detectamos que no ocurrió.
                return false; // Dejar pasar al comportamiento nativo que inserta
            }
        }
        return false;
    }
});

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

const visualMarkupPluginFactory = (translationsMapRef: React.MutableRefObject<Record<string, string>>, searchQueryRef: React.MutableRefObject<string>) => ViewPlugin.fromClass(class {
    decorations;
    constructor(view: EditorView) { this.decorations = this.buildDecorations(view); }
    update(update: ViewUpdate) {
        const needsRedraw = update.docChanged || update.viewportChanged || update.selectionSet || update.transactions.some(tr => tr.effects.some(e => e.is(ForceRedrawEffect)));
        if (needsRedraw) this.decorations = this.buildDecorations(update.view);
    }
    buildDecorations(view: EditorView) {
        const decos: any[] = [];
        const selection = view.state.selection.main;
        const revealedLine = view.state.field(revealedLineField, false);

        const safeReplace = (from: number, to: number) => { 
            if (from >= to) return;
            // Guard: ViewPlugin decorations that replace cannot cross line breaks
            const lineEnd = view.state.doc.lineAt(from).to;
            if (to > lineEnd) return;
            decos.push(Decoration.replace({}).range(from, to)); 
        };
        const safeMark = (className: string, from: number, to: number, attrs?: any) => {
            if (from < to) decos.push((attrs ? Decoration.mark({ class: className, attributes: attrs }) : Decoration.mark({ class: className })).range(from, to));
        };

        const blockDecorations = view.state.field(blockMarkupField);
        // Helper to detect if a position is inside a collapsed code block or table
        const isCollapsedBlock = (pos: number) => {
            let inside = false;
            blockDecorations.between(pos, pos, (from, to, deco) => { if (deco.spec.replace) inside = true; });
            return inside;
        };

        // Nueva: detecta si pos está en una línea con clase de cuerpo de code block
        const isInsideCodeBlock = (pos: number) => {
            const lineNum = view.state.doc.lineAt(pos).number;
            let inside = false;
            blockDecorations.between(
                view.state.doc.line(lineNum).from,
                view.state.doc.line(lineNum).from,
                (from, to, deco) => {
                    const cls = deco.spec?.class || '';
                    if (cls === 'cm-cb-line' || cls === 'cm-cb-line-dark') inside = true;
                }
            );
            return inside;
        };

        for (let { from, to } of view.visibleRanges) {
            const textToSearch = view.state.doc.sliceString(from, to);

            // --- STEP 2: Inline formatting (skip inside collapsed blocks) ---
            const rules = [
                { type: 'hl-new', regex: /\[\[hl:[^|]+\|([^|\]]+)\|([yrbg])\]\]/g },
                { type: 'hl-old', regex: /\{=([\s\S]*?)=\}/g },
                { type: 'tr', regex: /\[\[tr:([^|\]]+)\|([\s\S]*?)\]\]/g },
                { type: 'mk-ins',    regex: /\[\[ins:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'mk-idea',   regex: /\[\[idea:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'mk-op',     regex: /\[\[op:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'mk-duda',   regex: /\[\[duda:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'mk-wow',    regex: /\[\[wow:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'mk-pat',    regex: /\[\[pat:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'mk-yo',     regex: /\[\[yo:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'mk-ruido',  regex: /\[\[ruido:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'mk-contra', regex: /\[\[contra:[^\|]+\|([^\]]+)\]\]/g },
                { type: 'h1', regex: /^(#{1,6})\s+(.*)/gm }, 
                { type: 'bold', regex: /\*\*([\s\S]*?)\*\*/g }, 
                { type: 'strikethrough', regex: /~~([\s\S]*?)~~/g },
                { type: 'italic_under', regex: /(?<!_)_([^_]+)_(?!_)/g }, { type: 'italic_star', regex: /(?<!\*)\*([^*]+)\*(?!\*)/g }, 
                { type: 'hr', regex: /^---+$/gm }, { type: 'hr-big', regex: /^===+$/gm }, { type: 'md-link', regex: /\[([^\]]*)\]\(([^)\n]*)\)/g },
                { type: 'raw-link', regex: /(?<!\()(https?:\/\/[^\s\n)]+)/g }
            ];

            rules.forEach(rule => {
                let match;
                while ((match = rule.regex.exec(textToSearch)) !== null) {
                    const mFrom = from + match.index; const mTo = from + match.index + match[0].length;
                    if (isCollapsedBlock(mFrom) || isInsideCodeBlock(mFrom)) continue;

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
                    else if (rule.type === 'hl-new') {
                        const colorCode = match[2] as HlColorKey;
                        const hrClass = `cm-hl-${colorCode}`;
                        if (isRevealed) safeMark(hrClass, mFrom, mTo);
                        else {
                            const fullStr = match[0]; const firstPipe = fullStr.indexOf('|'); const secondPipe = fullStr.lastIndexOf('|');
                            const prefixLen = firstPipe + 1; const suffixLen = fullStr.length - secondPipe;
                            safeReplace(mFrom, mFrom + prefixLen); safeMark(hrClass, mFrom + prefixLen, mTo - suffixLen); safeReplace(mTo - suffixLen, mTo);
                            decos.push(Decoration.widget({ widget: new RemoveButtonWidget(mFrom, mTo, match[1]), side: 1 }).range(mTo, mTo));
                        }
                    }
                    else if (rule.type === 'hl-old') {
                        if (isRevealed) safeMark('cm-hl-y', mFrom, mTo);
                        else {
                            safeReplace(mFrom, mFrom + 2); safeMark('cm-hl-y', mFrom + 2, mTo - 2);
                            safeReplace(mTo - 2, mTo); decos.push(Decoration.widget({ widget: new RemoveButtonWidget(mFrom, mTo, match[1]), side: 1 }).range(mTo, mTo));
                        }
                    }
                    else if (rule.type.startsWith('mk-')) {
                        const mType = rule.type.replace('mk-', '');
                        if (isRevealed) safeMark(`cm-custom-mk-${mType}`, mFrom, mTo);
                        else {
                            const prefixLen = mTo - mFrom - match[1].length - 2;
                            safeReplace(mFrom, mFrom + prefixLen); safeMark(`cm-custom-mk-${mType}`, mFrom + prefixLen, mTo - 2); safeReplace(mTo - 2, mTo);
                            decos.push(Decoration.widget({ widget: new RemoveButtonWidget(mFrom, mTo, match[1]), side: 1 }).range(mTo, mTo));
                        }
                    }
                    else if (rule.type === 'hr') {
                        safeReplace(mFrom, mTo); decos.push(Decoration.widget({ widget: new HrWidget(), side: 0 }).range(mFrom, mFrom));
                        decos.push(Decoration.widget({ widget: new RemoveButtonWidget(mFrom, mTo, ""), side: 1 }).range(mTo, mTo));
                    }
                    else if (rule.type === 'hr-big') {
                        safeReplace(mFrom, mTo); decos.push(Decoration.widget({ widget: new HrBigWidget(), side: 0 }).range(mFrom, mFrom));
                        decos.push(Decoration.widget({ widget: new RemoveButtonWidget(mFrom, mTo, ""), side: 1 }).range(mTo, mTo));
                    }
                    else if (rule.type === 'h1') {
                        if (isRevealed) safeMark('cm-custom-h1', mFrom, mTo); 
                        else { const pLen = match[0].match(/^(#{1,6}\s+)/)?.[0].length || 2; safeReplace(mFrom, mFrom + pLen); safeMark('cm-custom-h1', mFrom + pLen, mTo); }
                    } 
                    else if (rule.type === 'bold') {
                        if (isRevealed) safeMark('cm-custom-bold', mFrom, mTo); else { safeReplace(mFrom, mFrom + 2); safeMark('cm-custom-bold', mFrom + 2, mTo - 2); safeReplace(mTo - 2, mTo); }
                    }
                    else if (rule.type === 'strikethrough') {
                        if (isRevealed) safeMark('cm-custom-strikethrough', mFrom, mTo); else { safeReplace(mFrom, mFrom + 2); safeMark('cm-custom-strikethrough', mFrom + 2, mTo - 2); safeReplace(mTo - 2, mTo); }
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
            border: "none !important",
            boxShadow: "none !important",
            transition: "font-size 0.2s ease, font-family 0.2s ease", // Animación suave al cambiar ajustes
            WebkitTouchCallout: "none !important", // Ocultar menú nativo de "copy/paste" al tocar sostenido
            WebkitUserSelect: "text !important",
            userSelect: "text !important",
        },
        "&.cm-focused, &:focus, &:focus-within": {
            outline: "none !important",
            border: "none !important",
            boxShadow: "none !important"
        },
        ".cm-scroller": {
            backgroundColor: "transparent !important",
            outline: "none !important",
        },
        ".cm-content": {
            fontFamily: fontFamily,
            fontSize: fontSize,
            WebkitUserSelect: "text !important",
            userSelect: "text !important",
            whiteSpace: "pre-wrap !important",
            overflowWrap: "anywhere !important",
            wordBreak: "break-word !important",
            paddingBottom: "20px !important", // 🚀 ESPACIO DE RESPIRACIÓN: Ajustado a 20px según preferencia
        },
        "&.cm-focused .cm-cursor": { borderLeftColor: "#CCCCCC !important", borderLeftWidth: "2px !important" },
        ".dark &.cm-focused .cm-cursor": { borderLeftColor: "#CCCCCC !important" },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { 
            backgroundColor: "rgba(73, 64, 217, 0.35) !important",
            pointerEvents: "none !important" 
        },
        ".dark &.cm-focused .cm-selectionBackground, .dark & .cm-selectionBackground": {
            backgroundColor: "rgba(139, 92, 246, 0.45) !important",
            pointerEvents: "none !important"
        },
        // Forzar contraste del texto seleccionado nativamente dentro del editor
        "& ::selection": { color: "#000000 !important" },
        ".dark & ::selection": { color: "#ffffff !important" },
        "&.cm-focused .cm-selectionLayer, .cm-selectionLayer": { 
            zIndex: "0 !important",
            pointerEvents: "none !important" 
        }, 
        ".cm-content *": { textDecoration: "none !important", boxShadow: "none !important" },
        ".cm-gutters": { backgroundColor: "transparent !important", border: "none !important", color: "#71717a" },
        ".dark & .cm-gutters": { color: "#52525b" },
        ".cm-activeLine": { backgroundColor: "transparent !important" },
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
        ".cm-hl-y, .cm-hl-r, .cm-hl-b, .cm-hl-g, .cm-custom-hl": { color: "#000000 !important", padding: "0 2px", borderRadius: "0px !important" },
        ".cm-hl-y": { backgroundColor: "#FFFF00 !important" },
        ".cm-hl-r": { backgroundColor: "#FF0000 !important" },
        ".cm-hl-b": { backgroundColor: "#3282F6 !important" },
        ".cm-hl-g": { backgroundColor: "#92D050 !important" },
        ".cm-custom-hl": { backgroundColor: "#FFFF00 !important" },
        ".cm-custom-tr": { position: "relative", backgroundColor: "#10B981 !important", color: "#000000 !important", border: "1px solid #00000030", padding: "0 2px", cursor: "help", borderRadius: "4px !important" },
        ".dark & .cm-custom-tr": { backgroundColor: "#10B981 !important", color: "#000000 !important", borderRadius: "4px !important" },
        ".cm-custom-h1": { fontSize: "1.4em", fontWeight: "bold", color: "inherit", lineHeight: "1.2" },
        ".cm-custom-bold": { fontWeight: "bold", color: "inherit" },
        ".cm-custom-strikethrough": { textDecoration: "line-through !important", color: "inherit", opacity: "0.6" },
        ".cm-custom-italic": { fontStyle: "italic", color: "inherit" },
        ".cm-url, .cm-link, .cm-custom-link, .cm-custom-link *": { color: "#60A5FA !important", textDecoration: "underline !important", cursor: "pointer !important", transition: "opacity 0.2s", opacity: "1 !important" },
        ".cm-custom-link:hover": { opacity: "0.8 !important" },
        // LIGHT MODE - fondos sólidos claros
        ".cm-custom-mk-ins":  { backgroundColor: "#EDE9FE !important", color: "#6D28D9 !important", border: "1px solid #C4B5FD", padding: "0 3px", borderRadius: "4px !important" },
        ".cm-custom-mk-idea": { backgroundColor: "#FEE2E2 !important", color: "#B91C1C !important", border: "1px solid #FECACA", padding: "0 3px", borderRadius: "4px !important" },
        ".cm-custom-mk-op":   { backgroundColor: "#ECFCCB !important", color: "#3F6212 !important", border: "1px solid #BEF264", padding: "0 3px", borderRadius: "4px !important" },
        ".cm-custom-mk-duda": { backgroundColor: "#E0F2FE !important", color: "#0369A1 !important", border: "1px solid #7DD3FC", padding: "0 3px", borderRadius: "4px !important" },
        ".cm-custom-mk-wow":  { backgroundColor: "#FCE7F3 !important", color: "#9D174D !important", border: "1px solid #F9A8D4", padding: "0 3px", borderRadius: "4px !important" },
        ".cm-custom-mk-pat":  { backgroundColor: "#F3E8FF !important", color: "#6B21A8 !important", border: "1px solid #D8B4FE", padding: "0 3px", borderRadius: "4px !important" },
        ".cm-custom-mk-yo":   { backgroundColor: "#FEF3C7 !important", color: "#92400E !important", border: "1px solid #FCD34D", padding: "0 3px", borderRadius: "4px !important" },
        ".cm-custom-mk-ruido":{ backgroundColor: "#F3F4F6 !important", color: "#374151 !important", border: "1px solid #D1D5DB", padding: "0 3px", borderRadius: "4px !important" },
        ".cm-custom-mk-contra":{ backgroundColor: "#FEE2E2 !important", color: "#991B1B !important", border: "1px solid #FCA5A5", padding: "0 3px", borderRadius: "4px !important" },

        // DARK MODE - fondos sólidos oscuros
        ".dark & .cm-custom-mk-ins":  { backgroundColor: "#2E1065 !important", color: "#C4B5FD !important", border: "1px solid #4C1D95" },
        ".dark & .cm-custom-mk-idea": { backgroundColor: "#450A0A !important", color: "#FCA5A5 !important", border: "1px solid #7F1D1D" },
        ".dark & .cm-custom-mk-op":   { backgroundColor: "#1A2E05 !important", color: "#BEF264 !important", border: "1px solid #365314" },
        ".dark & .cm-custom-mk-duda": { backgroundColor: "#082F49 !important", color: "#7DD3FC !important", border: "1px solid #0C4A6E" },
        ".dark & .cm-custom-mk-wow":  { backgroundColor: "#500724 !important", color: "#F9A8D4 !important", border: "1px solid #831843" },
        ".dark & .cm-custom-mk-pat":  { backgroundColor: "#3B0764 !important", color: "#D8B4FE !important", border: "1px solid #581C87" },
        ".dark & .cm-custom-mk-yo":   { backgroundColor: "#451A03 !important", color: "#FCD34D !important", border: "1px solid #78350F" },
        ".dark & .cm-custom-mk-ruido":{ backgroundColor: "#1F2937 !important", color: "#9CA3AF !important", border: "1px solid #374151" },
        ".dark & .cm-custom-mk-contra":{ backgroundColor: "#450A0A !important", color: "#EF4444 !important", border: "1px solid #991B1B" },
        ".cm-custom-hr": { display: "inline-block", verticalAlign: "middle", width: "calc(100% - 30px)", height: "1px", backgroundColor: "#d4d4d8", margin: "12px 0", borderRadius: "2px" },
        ".dark & .cm-custom-hr": { backgroundColor: "#3f3f3f" },
        ".cm-custom-hr-big": { display: "inline-block", verticalAlign: "middle", width: "calc(100% - 30px)", height: "3px", background: "linear-gradient(90deg, transparent, #8B5CF6, #6366f1, #8B5CF6, transparent)", margin: "12px 0", borderRadius: "4px" },
        ".cm-search-match": { backgroundColor: "rgba(245, 158, 11, 0.4) !important", borderBottom: "2px solid #f59e0b", color: "#000 !important" },
        ".cm-selectionMatch": { backgroundColor: "#518141 !important", color: "#000 !important" },
        ".cm-cb-header": { backgroundColor: "#F1F1F4", border: "1px solid #D4D4D8", borderBottom: "none", borderRadius: "8px 8px 0 0", fontFamily: fontFamily, fontSize: "0.85em", color: "#52525b", position: "relative", padding: "0 8px", minHeight: "1.25rem" },
        // --- MARKERS HOVER ---
        "[class*='cm-custom-mk-']": { position: "relative" },
        "[class*='cm-custom-mk-']::before": { 
            marginRight: "6px", 
            display: "inline-block", 
            opacity: "1", 
            width: "1.2em", 
            overflow: "hidden", 
            transition: "all 0.2s ease",
            verticalAlign: "middle"
        },
        "[class*='cm-custom-mk-']:hover::before": { transform: "scale(1.2)" },
        ".cm-custom-mk-ins::before":  { content: "'🧐'" },
        ".cm-custom-mk-duda::before": { content: "'🤔'" },
        ".cm-custom-mk-idea::before": { content: "'🤩'" },
        ".cm-custom-mk-op::before":   { content: "'😤'" },
        ".cm-custom-mk-wow::before":  { content: "'😮'" },
        ".cm-custom-mk-pat::before":  { content: "'👀'" },
        ".cm-custom-mk-yo::before":   { content: "'🥹'" },
        ".cm-custom-mk-ruido::before":{ content: "'🥱'" },
        ".cm-custom-mk-contra::before":{ content: "'😈'" },

        // --- TABLAS RENDERIZADAS ---
        ".cm-table-container": { 
            display: "block",
            padding: "16px 8px", 
            backgroundColor: "rgba(255, 255, 255, 0.5)", 
            borderRadius: "8px", 
            border: "1px solid rgba(0,0,0,0.05)",
            overflowX: "auto",
            userSelect: "text !important"
        },
        ".dark & .cm-table-container": { backgroundColor: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255,255,255,0.05)" },
        ".cm-rendered-table": { 
            width: "100%", 
            borderCollapse: "collapse", 
            fontSize: "0.9em",
            fontFamily: "inherit"
        },
        ".cm-rendered-table th": { 
            backgroundColor: "rgba(0,0,0,0.03)", 
            textAlign: "left", 
            padding: "8px 12px", 
            border: "1px solid rgba(0,0,0,0.1)",
            fontWeight: "bold"
        },
        ".dark & .cm-rendered-table th": { backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" },
        ".cm-rendered-table td": { 
            padding: "8px 12px", 
            border: "1px solid rgba(0,0,0,0.1)" 
        },
        ".dark & .cm-rendered-table td": { border: "1px solid rgba(255,255,255,0.1)" },
        ".cm-rendered-table tr:nth-child(even)": { backgroundColor: "rgba(0,0,0,0.01)" },
        ".dark & .cm-rendered-table tr:nth-child(even)": { backgroundColor: "rgba(255,255,255,0.01)" },

        // --- CODEBLOCKS ---
        ".dark & .cm-cb-header": { backgroundColor: "#0D0D0F", border: "1px solid #3F3F46", color: "#a1a1aa" },
        
        ".cm-cb-line": { backgroundColor: "#F1F1F4", borderLeft: "1px solid #D4D4D8", borderRight: "1px solid #D4D4D8", fontFamily: fontFamily, color: "#312E81 !important", padding: "0 8px" },
        ".dark & .cm-cb-line": { backgroundColor: "#0D0D0F", borderLeft: "1px solid #3F3F46", borderRight: "1px solid #3F3F46", color: "#A78BFA !important" },
        
        ".cm-cb-footer": { backgroundColor: "#F1F1F4", border: "1px solid #D4D4D8", borderTop: "none", borderRadius: "0 0 8px 8px", fontFamily: fontFamily, fontSize: "0.85em", color: "#52525b", padding: "0 8px", minHeight: "1.25rem", userSelect: "none !important" },
        ".dark & .cm-cb-footer": { backgroundColor: "#0D0D0F", border: "1px solid #3F3F46", color: "#a1a1aa" },

        ".cm-cb-line ::selection, .cm-cb-line ::-moz-selection": {
            backgroundColor: "#4338CA !important",
            color: "#ffffff !important"
        },
        ".dark & .cm-cb-line ::selection, .dark & .cm-cb-line ::-moz-selection": {
            backgroundColor: "#7C3AED !important",
            color: "#ffffff !important"
        },

        ".cm-codeblock-copy": { position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px", borderRadius: "4px", backgroundColor: "transparent", color: "#a1a1aa", cursor: "pointer", border: "none", transition: "all 0.15s", opacity: "0" },
        ".cm-cb-header:hover .cm-codeblock-copy": { opacity: "1" },
        ".cm-codeblock-copy:hover": { backgroundColor: "#E4E4E7", color: "#52525b" },
        ".dark & .cm-codeblock-copy:hover": { backgroundColor: "#3F3F46", color: "#a1a1aa" },
        
        // --- REMOVE BUTTON ---
        ".cm-remove-btn-wrapper": { display: "inline-block", width: "0px", overflow: "visible", verticalAlign: "baseline", position: "relative" },
        ".cm-remove-btn": { position: "absolute", display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: "#ef4444", border: "2px solid #ffffff", color: "white !important", width: "18px", height: "18px", left: "-6px", top: "-14px", borderRadius: "50%", fontSize: "14px", fontWeight: "bold", lineHeight: "1", cursor: "pointer !important", zIndex: "100", opacity: "0", transition: "opacity 0.15s", pointerEvents: "none" },
        ".cm-remove-btn-visible": { opacity: "1 !important", pointerEvents: "auto !important" },
        ".cm-remove-btn:hover": { opacity: "1 !important", pointerEvents: "auto !important", transform: "scale(1.1)" },
        ".dark & .cm-line": { color: "#CCCCCC !important" },
        ".cm-search-marker-container": {
            position: "absolute",
            right: "2px",
            top: "0",
            width: "3px",
            height: "100%",
            zIndex: "10",
            pointerEvents: "none"
        },
        ".cm-search-marker": {
            position: "absolute",
            left: "0",
            width: "3px",
            height: "3px",
            backgroundColor: "#f59e0b",
            borderRadius: "50%",
            boxShadow: "0 0 2px #f59e0b"
        },
        // 🚀 BÚSQUEDA PREMIUM (Modo Bottom)
        ".cm-panels": {
            backgroundColor: "#ffffff !important",
            borderTop: "1px solid #e4e4e7 !important",
            zIndex: "50 !important",
        },
        ".dark .cm-panels": {
            backgroundColor: "#18181b !important",
            borderTop: "1px solid #27272a !important",
        },
        ".cm-panels-bottom": {
            borderTop: "1px solid #e4e4e7 !important",
        },
        ".cm-search": {
            padding: "6px 10px !important",
            display: "flex !important",
            flexWrap: "wrap !important",
            gap: "10px !important",
            alignItems: "center !important",
            fontSize: "13px !important",
        },
        ".cm-search label": {
            display: "inline-flex !important",
            alignItems: "center !important",
            gap: "4px !important",
            whiteSpace: "nowrap !important",
            color: "inherit !important",
        },
        ".cm-search input": {
            backgroundColor: "#ffffff !important",
            border: "1px solid #d1d5db !important",
            borderRadius: "4px !important",
            padding: "2px 6px !important",
            margin: "0 !important",
            color: "#1f2937 !important",
            outline: "none !important",
        },
        ".dark .cm-search input": {
            backgroundColor: "#27272a !important",
            border: "1px solid #4a4a4e !important",
            color: "#ffffff !important",
        },
        ".cm-search button": {
            backgroundColor: "#f3f4f6 !important",
            border: "1px solid #d1d5db !important",
            borderRadius: "4px !important",
            padding: "2px 8px !important",
            cursor: "pointer !important",
            color: "#374151 !important",
        },
        ".dark .cm-search button": {
            backgroundColor: "#3f3f46 !important",
            border: "1px solid #4a4a4e !important",
            color: "#eeeeee !important",
        },
        ".cm-search [name=close]": {
            marginLeft: "auto !important",
            cursor: "pointer !important",
            color: "#ef4444 !important",
            opacity: "0.7 !important",
        }
    });
};

const SearchMarkers = ({ view, query }: { view: EditorView | null, query: string }) => {
    const [markers, setMarkers] = useState<number[]>([]);
    
    useEffect(() => {
        if (!view || !query.trim()) {
            setMarkers([]);
            return;
        }
        
        const q = query.toLowerCase();
        const doc = view.state.doc;
        const text = doc.toString().toLowerCase();
        const newMarkers: number[] = [];
        let pos = 0;
        
        while ((pos = text.indexOf(q, pos)) !== -1) {
            // Calcular posición relativa (%)
            const percent = (pos / doc.length) * 100;
            newMarkers.push(percent);
            pos += q.length;
        }
        
        setMarkers(newMarkers);
    }, [view, query, view?.state.doc.length]);

    if (markers.length === 0) return null;

    return (
        <div className="cm-search-marker-container">
            {markers.map((top, i) => (
                <div key={i} className="cm-search-marker" style={{ top: `${top}%` }} />
            ))}
        </div>
    );
};


export const SmartNotesEditorComponent = forwardRef<SmartNotesEditorRef, SmartNotesEditorProps>((props, ref) => {
    const {
        noteId, initialContent, searchQuery, onChange, noteFont = 'sans', noteFontSize = 'medium', noteLineHeight = 'standard', readOnly = false, showLineNumbers = false, autoHeight = false, onEnterAction, onBackspaceEmpty
    } = props;
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
    const [tooltipState, setTooltipState] = useState<{text: React.ReactNode, top: number, left: number} | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [hlColor, setHlColor] = useState<HlColorKey>('y');
    const [showHlOptions, setShowHlOptions] = useState(false);
    const [showTagOptions, setShowTagOptions] = useState(false);
    const [showTrOptions, setShowTrOptions] = useState(false);
    const [lastAction, setLastAction] = useState<string>(
        () => localStorage.getItem('sme-last-action') || 'highlight'
    );
    const [lastTag, setLastTag] = useState<MarkerType>(
        () => (localStorage.getItem('sme-last-tag') as MarkerType) || 'ins'
    );
    const [lastMoreAction, setLastMoreAction] = useState<string>(
        () => localStorage.getItem('sme-last-more-action') || 'bold'
    );
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const linkInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const linkUrlRef = useRef(linkUrl);
    const showLinkInputRef = useRef(showLinkInput);

    // Refs para posicionamiento dinámico de submenús
    const hlMenuRef = useRef<HTMLDivElement>(null);
    const tagMenuRef = useRef<HTMLDivElement>(null);
    const moreMenuRef = useRef<HTMLDivElement>(null);
    const [hlShift, setHlShift] = useState(0);
    const [tagShift, setTagShift] = useState(0);
    const [moreShift, setMoreShift] = useState(0);

    // Wikipedia
    const [wikiResult, setWikiResult] = useState<{
        title: string;
        extract: string;
        description?: string;
        url?: string;
        source?: 'npm' | 'pypi' | 'wikidata' | 'google_kg' | 'dictionary' | 'ddg' | 'wiki_es' | 'wiki_en' | 'none';
    } | null>(null);
    const [isWikiLoading, setIsWikiLoading] = useState(false);
    const [wikiTooltipVisible, setWikiTooltipVisible] = useState(false);
    const wikiMenuRef = useRef<HTMLDivElement>(null);
    const wikiResultRef = useRef(wikiResult);
    useEffect(() => { wikiResultRef.current = wikiResult; }, [wikiResult]);
    const wikiCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
    const wikiButtonRef = useRef<HTMLDivElement>(null);
    const isInteractingWithWikiRef = useRef(false);

    useEffect(() => {
        const release = () => { isInteractingWithWikiRef.current = false; };
        window.addEventListener('mouseup', release);
        return () => window.removeEventListener('mouseup', release);
    }, []);

    const adjustMenuPosition = (isOpen: boolean, menuRef: React.RefObject<HTMLDivElement>, containerRef: React.RefObject<HTMLDivElement>, setShift: React.Dispatch<React.SetStateAction<number>>) => {
        useLayoutEffect(() => {
            if (isOpen && menuRef.current && containerRef.current) {
                const menuRect = menuRef.current.getBoundingClientRect();
                const containerRect = containerRef.current.getBoundingClientRect();
                const margin = 8;
                
                // 🎯 Ajuste por DERECHA del contenedor
                if (menuRect.right > containerRect.right - margin) {
                    const diff = (containerRect.right - margin) - menuRect.right;
                    setShift(prev => prev + diff);
                }
                // 🎯 Ajuste por IZQUIERDA del contenedor
                else if (menuRect.left < containerRect.left + margin) {
                    const diff = (containerRect.left + margin) - menuRect.left;
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
        setShowLinkInput(false);
        setShowMoreOptions(false);
        setShowHlOptions(false);
        setShowTagOptions(false);
        setShowTrOptions(false);
        window.getSelection()?.removeAllRanges();
    };

    const closeMenusOnly = () => {
        setMenuState(null);
        setShowLinkInput(false);
        setShowMoreOptions(false);
        setShowHlOptions(false);
        setShowTagOptions(false);
        setShowTrOptions(false);
        setWikiResult(null);
        setWikiTooltipVisible(false);
        setIsWikiLoading(false);
    };

    // 🚀 SYNC: Escuchar cambios de tema global para forzar re-renderizado de bloques (tablas/code)
    useEffect(() => {
        const handleThemeChange = () => {
            editorRef.current?.view?.dispatch({ 
                effects: [ForceRedrawEffect.of(null)] 
            });
        };
        window.addEventListener('app-theme-changed', handleThemeChange);
        return () => window.removeEventListener('app-theme-changed', handleThemeChange);
    }, []);

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
                    setTooltipState({ text: <span className="flex items-center gap-1.5"><Languages size={13} className="shrink-0" />{text}</span>, top: rect.top, left: rect.left + (rect.width / 2) });
                }
            } else if (target.classList.contains('cm-custom-link')) {
                const url = target.getAttribute('data-url');
                if (url) {
                    const rect = target.getBoundingClientRect();
                    setTooltipState({ text: url, top: rect.top, left: rect.left + (rect.width / 2) });
                }
            } else {
                // Check for marker tag classes (cm-custom-mk-ins, cm-custom-mk-idea, etc.)
                const mkClass = Array.from(target.classList).find(c => c.startsWith('cm-custom-mk-'));
                if (mkClass) {
                    const tagType = mkClass.replace('cm-custom-mk-', '') as MarkerType;
                    const cfg = MARKER_TYPES[tagType];
                    if (cfg) {
                        const rect = target.getBoundingClientRect();
                        setTooltipState({ text: `${cfg.emoji} ${cfg.label}`, top: rect.top, left: rect.left + (rect.width / 2) });
                    }
                }
            }
        },
        mouseout: (e) => { 
            const target = e.target as HTMLElement;
            if (target.classList.contains('cm-custom-tr') || target.classList.contains('cm-custom-link') || Array.from(target.classList).some(c => c.startsWith('cm-custom-mk-')) || Array.from(target.classList).some(c => c.startsWith('cm-hl-'))) {
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
                    view.dispatch({ 
                        selection: { anchor: pos, head: pos },
                        effects: [ForceRedrawEffect.of(null)] // 🚀 CORE FIX: Forzar renderizado inicial de bloques (tablas/code)
                    });
                } else {
                    // Si no hay posición guardada, igual forzamos el renderizado inicial
                    view.dispatch({ effects: [ForceRedrawEffect.of(null)] });
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
            // 🚀 PROTECCIÓN: Si el foco está en el buscador, no interferimos con la selección
            const active = document.activeElement;
            if (active && (active.closest('.cm-panel') || active.closest('.cm-search') || active.closest('.wiki-selectable') || active.classList.contains('wiki-selectable'))) return;
            
            // Si el mouse está sobre el globo o interactuando con él, ignoramos cambios de selección del editor
            if (isInteractingWithWikiRef.current || (wikiTooltipVisible && wikiMenuRef.current?.matches(':hover'))) return;

            const { main } = update.state.selection;

            // 1. Si la selección está vacía (clic simple), resetear menú
            if (main.empty) {
                // 🚀 PROTECCIÓN: No cerramos el menú si el input de link está activo.
                // handleBlur se encargará de confirmar/cerrar de forma segura.
                if (showLinkInputRef.current) return; 

                setMenuState(null);
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
                // 🎯 Determinar la posición basada en la dirección de la selección
                const isWordSelection = (main.to - main.from) <= 30; // Selección corta = palabra
                const isForward = main.head >= main.anchor; // L→R: head está al final
                
                let menuPos: number;
                if (isWordSelection) {
                    // Doble clic / palabra: usar el centro
                    menuPos = Math.floor((main.from + main.to) / 2);
                } else if (isForward) {
                    // Selección L→R: menú en el extremo derecho (final)
                    menuPos = main.to;
                } else {
                    // Selección R→L: menú en el extremo izquierdo (inicio)
                    menuPos = main.from;
                }
                
                let rect: { top: number; left: number } | null = null;
                try { rect = update.view.coordsAtPos(menuPos); } catch (e) { rect = null; }
                if (rect && containerRef.current) {
                    const containerRect = containerRef.current.getBoundingClientRect();
                    const isMobile = window.innerWidth < 768;

                    const showMenu = () => {
                        setMenuState({ 
                            top: rect.top - 8, 
                            left: rect.left, 
                            from: main.from, 
                            to: main.to, 
                            text: update.state.doc.sliceString(main.from, main.to),
                            isMobile 
                        });
                    };

                    // 🚀 FIX: Delay en móvil para no estorbar los tiradores de selección
                    if (isMobile) {
                        clearTimeout((window as any)[`__menu_delay_${noteId}`]);
                        (window as any)[`__menu_delay_${noteId}`] = setTimeout(showMenu, 400);
                    } else {
                        showMenu();
                    }
                }
            }
        }
    }), [noteId]);

    const clickHandlerExtension = useMemo(() => Prec.highest(EditorView.domEventHandlers({
        mousedown: (e, view) => {
            const target = e.target as HTMLElement;
            if (target.closest('.floating-menu-container, .cm-panel, .cm-search')) {
                return; // Si el clic es en el menú o panel, no cerramos nada aquí
            }
            closeMenusOnly();
            
            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
            const { main } = view.state.selection;

            // 🚀 FIX: Eliminamos el preventDefault y el colapso forzado para permitir el Drag & Drop nativo.
            return false; 
        },
        contextmenu: (e, view) => {
            // 🚀 FIX: En móviles, long-press dispara contextmenu (button 0 o 1 frecuentemente).
            // Solo revelamos markdown si es un Clic Derecho Real (button 2).
            if (e.button !== 2) return false;

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
            const hlNode = target.closest('[class*="cm-hl-"], .cm-custom-hl, .cm-custom-tr, .cm-custom-link, [class*="cm-custom-mk-"]');
            if (hlNode) {
                const span = hlNode as HTMLElement;
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
            if (target.closest('[class*="cm-hl-"], .cm-custom-hl, .cm-custom-tr, .cm-custom-link, [class*="cm-custom-mk-"]')) {
                const line = target.closest('.cm-line');
                if (line) line.querySelectorAll('.cm-remove-btn-visible').forEach(btn => btn.classList.remove('cm-remove-btn-visible'));
            }
        }
    })), [noteId]);

    const doFormat = (type: 'highlight' | 'link' | 'strikethrough' | 'heading' | 'bold' | MarkerType, color?: HlColorKey) => {
        if (!menuState || !editorRef.current?.view) return;

        const targetColor = color || hlColor;

        const rawSelected = menuState.text;
        // Limpiador: quita resaltados (hl-new y hl-old) y marcadores para evitar anidamiento corrupto
        const innerClean = rawSelected
            .replace(/\[\[hl:[^|]+\|([^|\]]+)\|[yrbg]\]\]/g, '$1')
            .replace(/\{=([\s\S]*?)=\}/g, '$1')
            .replace(/~~([\s\S]*?)~~/g, '$1')
            .replace(/\[\[(ins|idea|op|duda|wow|pat|yo|ruido|contra):[^\|]+\|([^\]]+)\]\]/g, '$2');

        if (type === 'link') {
            if (showLinkInput) return;
            setShowLinkInput(true);
            setLinkUrl('');
            setLastAction('link');
            localStorage.setItem('sme-last-action', 'link');
            return;
        }

        if (type === 'heading') {
            const view = editorRef.current?.view;
            if (!view || !menuState) return;
            const line = view.state.doc.lineAt(menuState.from);
            // Si ya empieza con # la quitamos, si no la ponemos
            const hasHeading = line.text.startsWith('# ');
            if (hasHeading) {
                view.dispatch({
                    changes: { from: line.from, to: line.from + 2, insert: '' }
                });
            } else {
                view.dispatch({
                    changes: { from: line.from, to: line.from, insert: '# ' }
                });
            }
            setMenuState(null);
            return;
        }

        const ts = generateMarkerTimestamp();
        let formatted = '';
        if (type === 'highlight') {
            formatted = `[[hl:${ts}|${innerClean}|${targetColor}]]`;
        } else if (type === 'strikethrough') {
            formatted = `~~${innerClean}~~`;
        } else if (type === 'bold') {
            formatted = `**${innerClean}**`;
        } else {
            formatted = `[[${type}:${ts}|${innerClean}]]`;
        }

        editorRef.current.view.dispatch({ 
            changes: { from: menuState.from, to: menuState.to, insert: formatted }, 
            selection: { anchor: menuState.from + formatted.length },
            effects: [setRevealedLine.of(null), ForceRedrawEffect.of(null)] // 🚀 Limpiar modo markdown tras formatear
        });
        
        setMenuState(null);
        setShowLinkInput(false);
    };

    const confirmLink = () => {
        if (!menuState || !editorRef.current?.view) return;
        const textToLink = menuState.text.replace(/\[\[(ins|idea|op|duda|wow|pat|yo|ruido|contra):[^\|]+\|([^\]]+)\]\]/g, '$2').trim();
        // Usamos la ref si estamos en un contexto asíncrono (como blur)
        const currentUrl = linkUrlRef.current.trim();
        
        // Si hay una URL, aplicamos formato link. Si no, dejamos el texto limpio.
        const replacement = currentUrl ? `[${textToLink}](${currentUrl})` : textToLink;
        
        editorRef.current.view.dispatch({ 
            changes: { from: menuState.from, to: menuState.to, insert: replacement }, 
            selection: { anchor: menuState.from + replacement.length },
            effects: [setRevealedLine.of(null), ForceRedrawEffect.of(null)] // 🚀 Limpiar modo markdown tras link
        });
        
        setMenuState(null);
        setShowLinkInput(false);
        setLinkUrl('');
    };


    const doTranslate = async (targetLang: 'en' | 'es') => {
        if (!menuState || !editorRef.current?.view) return;
        const textToTranslate = menuState.text.trim();
        if (!textToTranslate) return;

        console.log("🚀 Iniciando traducción (MyMemory)...");
        setIsTranslating(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Debes iniciar sesión para traducir.");

            const sourceLang = targetLang === 'en' ? 'es' : 'en';

            const res = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=${sourceLang}|${targetLang}`
            );
            const json = await res.json();
            const translatedText = json?.responseData?.translatedText;
            if (!translatedText) throw new Error("MyMemory no devolvió traducción.");

            const replacement = `[[tr:${translatedText}|${textToTranslate}]]`;

            await supabase.from('translations').insert([{
                user_id: session.user.id,
                source_text: textToTranslate,
                translated_text: translatedText,
                source_lang: sourceLang,
                target_lang: targetLang
            }]);

            editorRef.current.view.dispatch({
                changes: { from: menuState.from, to: menuState.to, insert: replacement },
                selection: { anchor: menuState.from + replacement.length },
                effects: [setRevealedLine.of(null), ForceRedrawEffect.of(null)]
            });
            setMenuState(null);

        } catch (err: any) {
            console.error("❌ Error en traducción:", err);
            alert(`Error al traducir: ${err.message}`);
        } finally {
            setIsTranslating(false);
        }
    };

    // ── Limpiar texto seleccionado de markdown y caracteres especiales ──────────
    const cleanSearchTerm = (raw: string): string => {
        return raw.replace(/[*_#`~>|[\]()]/g, '').trim().slice(0, 80);
    };

    // ── 1. Stop words ES+EN a eliminar antes de buscar ─────────────────────────
    const STOP_WORDS = new Set([
        // Verbos acción ES
        'activar','instalar','configurar','ejecutar','usar','hacer','crear',
        'abrir','cerrar','iniciar','parar','correr','probar','ver','ir',
        // Preposiciones/artículos ES
        'el','la','los','las','un','una','de','del','en','con','para','por',
        'que','como','cuando','donde','si','no','es','son','al','se',
        // Verbos/artículos EN
        'the','a','an','is','are','to','of','in','on','with','for','how',
    ]);

    // ── 1.5. Partir palabras compuestas ───────────────────────────────────────
    const splitCompoundWord = (word: string): string[] => {
        const results: string[] = [word];
        // CamelCase → "FlameGraph" → "Flame Graph"
        const camel = word.replace(/([a-z])([A-Z])/g, '$1 $2');
        if (camel !== word) results.push(camel.toLowerCase());
        // PascalCase → igual
        const pascal = word.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
        if (pascal !== word) results.push(pascal.toLowerCase());
        // Compound heuristic — split en el punto de mayor entropía
        const lower = word.toLowerCase();
        for (let i = 3; i < lower.length - 2; i++) {
            const a = lower.slice(0, i);
            const b = lower.slice(i);
            if (a.length >= 3 && b.length >= 3) {
                results.push(`${a} ${b}`);
            }
        }
        return [...new Set(results)];
    };

    // ── 2. Extraer términos candidatos por prioridad ────────────────────────────
    const extractCandidates = (raw: string): string[] => {
        const clean = raw.replace(/[*_#`~>|[\]()]/g, '').trim();
        const words = clean.toLowerCase().split(/\s+/);
        const meaningful = words.filter(w => w.length > 2 && !STOP_WORDS.has(w));

        const candidates: string[] = [];
        // Candidato 1: frase completa limpia
        if (meaningful.length > 0) candidates.push(meaningful.join(' '));
        
        // Si es una sola palabra, intentar splits de palabras compuestas
        if (meaningful.length === 1 && meaningful[0].length > 5) {
            const splits = splitCompoundWord(meaningful[0]);
            splits.forEach(s => { if (s !== meaningful[0]) candidates.push(s); });
        }

        // Candidato 2: primera palabra significativa sola
        if (meaningful.length > 1) candidates.push(meaningful[0]);
        // Candidato 3: última palabra significativa (ej: "pyvenv activar" → "pyvenv")
        if (meaningful.length > 1) candidates.push(meaningful[meaningful.length - 1]);
        // Candidato 4: frase original completa (fallback)
        candidates.push(clean);

        return [...new Set(candidates)].filter(Boolean);
    };

    // ── 3. Relevancia Jaccard con hard-reject si sujeto ausente ────────────────
    const relevanceScore = (query: string, resultTitle: string): number => {
        const qWords = [...new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 2))];
        const tWords = [...new Set(resultTitle.toLowerCase().split(/\s+/).filter(w => w.length > 2))];
        if (qWords.length === 0) return 0;
        const firstQWord = qWords[0];
        const firstWordPresent = tWords.some(t => t.includes(firstQWord) || firstQWord.includes(t));
        if (!firstWordPresent) return 0;
        const intersection = qWords.filter(qw => 
            tWords.some(tw => {
                // Match exacto o substring
                if (tw.includes(qw) || qw.includes(tw)) return true;
                // Fuzzy: qw es prefijo significativo de tw o viceversa (min 4 chars)
                const minLen = Math.min(qw.length, tw.length);
                if (minLen >= 4) {
                    const prefix = qw.slice(0, minLen - 1);
                    if (tw.startsWith(prefix) || qw.startsWith(tw.slice(0, minLen - 1))) return true;
                }
                return false;
            })
        ).length;
        const union = new Set([...qWords, ...tWords]).size;
        return union > 0 ? intersection / union : 0;
    };

    // ── 4. Detectores de dominio ───────────────────────────────────────────────
    const looksLikePython = (t: string): boolean => {
        const pyWords = ['py','python','pip','venv','pyvenv','django','flask',
            'pandas','numpy','scipy','jupyter','conda','virtualenv','pytest'];
        return pyWords.some(w => t.toLowerCase().includes(w));
    };

    const looksLikeJS = (t: string): boolean => {
        const jsWords = ['react','vue','angular','node','npm','webpack','vite',
            'typescript','javascript','js','ts','eslint','babel','rollup','next',
            'nuxt','svelte','tool','tools','devtools','plugin','extension','sdk'];
        return jsWords.some(w => t.toLowerCase().includes(w));
    };

    // ── 5. fetchDefinition — universal, multi-término ─────────────────────────
    const fetchDefinition = async (term: string) => {
        if (!term.trim()) return;
        const rawClean = term.replace(/[*_#`~>|[\]()]/g, '').trim().slice(0, 80);
        if (!rawClean) return;

        setIsWikiLoading(true);
        setWikiResult(null);
        setWikiTooltipVisible(true);

        const candidates = extractCandidates(rawClean);

        const tryGoogleKG = async (t: string) => {
            const GOOGLE_KG_KEY = (import.meta as any).env.VITE_GOOGLE_KG_KEY || '';
            if (!GOOGLE_KG_KEY) return null;
            try {
                const res = await fetch(
                    `https://kgsearch.googleapis.com/v1/entities:search?query=${encodeURIComponent(t)}&key=${GOOGLE_KG_KEY}&limit=3&indent=true`
                );
                if (!res.ok) return null;
                const d = await res.json();
                const item = d?.itemListElement?.[0]?.result;
                if (!item) return null;
                const desc = item.detailedDescription?.articleBody || item.description;
                if (!desc) return null;
                return {
                    title: item.name || t,
                    extract: desc,
                    description: item['@type']?.filter((t:string) => t !== 'Thing').join(' · ') || 'Google Knowledge Graph',
                    url: item.detailedDescription?.url || item.url,
                    source: 'google_kg' as const,
                };
            } catch { return null; }
        };

        const tryPyPI = async (t: string) => {
            const query = t.trim().toLowerCase();
            if (query.length < 3) return null;

            try {
                // PyPI no tiene una API de búsqueda JSON trivial sin 404s para slugs, 
                // pero podemos usar el buscador de Google o simplemente ser más estrictos.
                // Intentamos una búsqueda limitada o validamos el slug.
                const slug = query.replace(/\s+/g, '-');
                
                // 🚀 Nota: Para PyPI, si no hay API de búsqueda "limpia", 
                // al menos filtramos términos que claramente no son paquetes.
                if (/[^a-z0-9\-_]/.test(slug)) return null;

                const res = await fetch(`https://pypi.org/pypi/${slug}/json`);
                if (!res.ok) return null;
                const d = await res.json();
                const desc = d.info?.summary;
                if (desc && desc.length > 10) {
                    return {
                        title: d.info.name,
                        extract: `${desc}${d.info.version ? `\n\nVersión actual: ${d.info.version}` : ''}`,
                        description: d.info.keywords?.split(/[,\s]+/).slice(0,4).join(' · ') || 'Python package',
                        url: d.info.project_url || `https://pypi.org/project/${slug}`,
                        source: 'pypi' as const,
                    };
                }
            } catch { /* silencio */ }
            return null;
        };

        const tryNPM = async (t: string) => {
            const query = t.trim().toLowerCase();
            if (query.length < 3) return null;

            try {
                // 🚀 SEARCH-FIRST: Usar la API de búsqueda de NPM que devuelve 200 siempre.
                const res = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=1`);
                if (!res.ok) return null;
                const data = await res.json();
                const best = data.objects?.[0]?.package;

                if (best && (best.name.includes(query) || query.includes(best.name))) {
                    return {
                        title: best.name,
                        extract: `${best.description}${best.version ? `\n\nVersión actual: ${best.version}` : ''}`,
                        description: best.keywords?.slice(0,4).join(' · ') || 'npm package',
                        url: best.links?.npm || `https://www.npmjs.com/package/${best.name}`,
                        source: 'npm' as const,
                    };
                }
            } catch { /* silencio */ }
            return null;
        };

        const tryDictionary = async (t: string) => {
            const word = t.trim().split(/\s+/)[0];
            // Solo buscar si es una sola palabra mayor a 2 caracteres y no contiene caracteres especiales
            if (!word || word.length < 3 || /[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(word)) return null;
            
            try {
                const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
                if (!res.ok) return null; // El 404 de red es inevitable si no existe el término, pero filtramos candidatos inválidos arriba.
                
                const d = await res.json();
                const entry = Array.isArray(d) ? d[0] : null;
                if (!entry) return null;
                const meaning = entry.meanings?.[0];
                const def = meaning?.definitions?.[0]?.definition;
                if (!def) return null;
                return {
                    title: entry.word,
                    extract: def,
                    description: meaning?.partOfSpeech || 'Definición',
                    url: `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`,
                    source: 'dictionary' as const,
                };
            } catch { return null; }
        };

        const tryWikipedia = async (t: string, lang: 'en'|'es') => {
            try {
                // 🚀 SEARCH-FIRST: Realizar búsqueda primero para validar títulos existentes y evitar peticiones 400/404 innecesarias.
                const searchRes = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(t)}&format=json&origin=*&srlimit=5`);
                if (!searchRes.ok) return null;
                
                const sd = await searchRes.json();
                const hits = (sd?.query?.search || []) as {title:string}[];
                
                // Encontrar el mejor hit usando el score de relevancia (mínimo 0.4)
                const best = hits.map(h => ({ ...h, score: relevanceScore(t, h.title) }))
                                 .filter(h => h.score >= 0.4)
                                 .sort((a,b) => b.score - a.score)[0];
                
                if (!best) return null;

                // Ahora que tenemos un título confirmado, consultamos el summary de forma segura.
                const sumRes = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(best.title.replace(/ /g,'_'))}`);
                if (!sumRes.ok) return null;
                const d = await sumRes.json();
                
                if (!d.extract) return null;
                return {
                    title: d.title,
                    extract: d.extract,
                    description: d.description ? `${lang.toUpperCase()} · ${d.description}` : `Wikipedia ${lang.toUpperCase()}`,
                    url: d.content_urls?.desktop?.page,
                    source: (lang === 'en' ? 'wiki_en' : 'wiki_es') as 'wiki_en' | 'wiki_es',
                };
            } catch { return null; }
        };

        const tryWikidata = async (t: string) => {
            try {
                const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(t)}&language=en&format=json&origin=*&limit=3&type=item`);
                const d = await res.json();
                const hit = (d?.search || []).find((h:any) => h.label && relevanceScore(t, h.label) >= 0.6 && h.description);
                if (!hit) return null;
                return {
                    title: hit.label,
                    extract: hit.description,
                    description: `Wikidata · ${hit.id}`,
                    url: `https://www.wikidata.org/wiki/${hit.id}`,
                    source: 'wikidata' as const,
                };
            } catch { return null; }
        };

        try {
            for (const candidate of candidates) {
                let result = null;

                // Capa de Google Knowledge Graph (si hay Key)
                result = await tryGoogleKG(candidate);
                if (result) { setWikiResult(result); return; }

                if (looksLikePython(candidate)) {
                    result = await tryPyPI(candidate);
                    if (result) { setWikiResult(result); return; }
                }
                if (looksLikeJS(candidate)) {
                    result = await tryNPM(candidate);
                    if (result) { setWikiResult(result); return; }
                }
                result = await tryWikipedia(candidate, 'en');
                if (result) { setWikiResult(result); return; }
                result = await tryWikipedia(candidate, 'es');
                if (result) { setWikiResult(result); return; }
                result = await tryWikidata(candidate);
                if (result) { setWikiResult(result); return; }
                if (candidate.split(/\s+/).length <= 2) {
                    result = await tryDictionary(candidate);
                    if (result) { setWikiResult(result); return; }
                }
            }
            setWikiResult({ title: rawClean, extract: `No se encontró definición para "${rawClean}".`, source: 'none' });
        } catch {
            setWikiResult({ title: rawClean, extract: 'Error al buscar.', source: 'none' });
        } finally {
            setIsWikiLoading(false);
        }
    };

    const handleChange = (value: string) => {
        setContent(value); 
        if (debounceChangeTimerRef.current) clearTimeout(debounceChangeTimerRef.current);
        debounceChangeTimerRef.current = setTimeout(() => onChange(value), 300); 
    };

    const handleBlur = (e: any) => {
        const related = e.relatedTarget as HTMLElement;
        const isFocusStillInEditor = related && (
            related.closest('.cm-editor') || 
            related.closest('.floating-menu-container') || 
            related.classList.contains('floating-menu-container') ||
            related.closest('.cm-panel') ||
            related.closest('.cm-search') ||
            related.closest('.cm-search-marker-container') ||
            isInteractingWithWikiRef.current
        );
        
        if (isFocusStillInEditor) {
            return; // El foco sigue dentro del ecosistema del editor
        }

        // Delay para verificar document.activeElement de forma definitiva (clics en input)
        setTimeout(() => {
            const active = document.activeElement;
            const isInsideMenu = active && (
                active.closest('.floating-menu-container') || 
                active.classList.contains('floating-menu-container') ||
                active.closest('.cm-panel') ||
                active.closest('.cm-search') ||
                active.closest('.cm-search-marker-container')
            );
            
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
                setShowLinkInput(false);
            }
        }, 150);
    };

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const menuWidth = isMobile ? 110 : 130; 
    const subMenuWidth = 240; 
    const margin = 16;
    
    // Calcular left restringido para el menú principal (viewport coords ya que fixed)
    let clampedLeft = menuState?.left ?? 0;
    if (menuState && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const halfWidth = menuWidth / 2;
        // Clamping dentro de los bordes del contenedor en coordenadas del viewport
        clampedLeft = Math.max(containerRect.left + halfWidth + margin, Math.min(containerRect.right - halfWidth - margin, menuState.left));
    }

    // Calcular desplazamiento del submenú si se sale de la pantalla
    const getSubMenuStyle = (anchorOffset: number) => {
        if (!menuState || menuState.isMobile) return { left: '50%', transform: 'translateX(-50%)' };
        
        // Posicion del botón en el viewport (clampedLeft es el centro del globo principal)
        const buttonViewportLeft = clampedLeft + anchorOffset; 
        const halfSub = subMenuWidth / 2;
        let correction = 0;
        
        // Si el submenú se sale por la izquierda le sumamos correccion positiva, si por la derecha negativa
        if (buttonViewportLeft - halfSub < margin) {
            correction = margin - (buttonViewportLeft - halfSub);
        } else if (buttonViewportLeft + halfSub > window.innerWidth - margin) {
            correction = (window.innerWidth - margin) - (buttonViewportLeft + halfSub);
        }
        
        return { 
            left: '50%', 
            transform: `translateX(calc(-50% + ${correction}px))` 
        };
    };

    const doActionAndSave = async (actionKey: string, fn: () => void | Promise<void>) => {
        const res = fn();
        if (res instanceof Promise) await res;
        
        setLastAction(actionKey);
        localStorage.setItem('sme-last-action', actionKey);

        // Track specifically which category this action belongs to
        if (actionKey in MARKER_TYPES) {
            setLastTag(actionKey as MarkerType);
            localStorage.setItem('sme-last-tag', actionKey);
        } else if (actionKey !== 'highlight') {
            // It's an action from the "More" menu
            setLastMoreAction(actionKey);
            localStorage.setItem('sme-last-more-action', actionKey);
        }

        // Si no es un link guiado, cerramos todo. Si es link, el input tomará el relevo.
        if (actionKey !== 'link') {
            setShowLinkInput(false);
            setMenuState(null);
        } else {
            // Para links, cerramos el expandido para dejar paso al input
            setShowLinkInput(true);
            setLinkUrl('');
        }
    };

    const getLastActionDisplay = () => {
        if (lastAction === 'highlight') return { icon: <Highlighter size={16} color={HL_COLORS[hlColor].hex} />, title: 'Resaltar', emoji: '' };
        if (lastAction === 'en') return { emoji: 'EN', title: 'Traducir → EN', icon: null };
        if (lastAction === 'es') return { emoji: 'ES', title: 'Traducir → ES', icon: null };
        if (lastAction === 'link') return { emoji: '🔗', title: 'Link', icon: null };
        if (lastAction === 'strikethrough') return { icon: <Strikethrough size={16} />, title: 'Tachado', emoji: '' };
        if (lastAction === 'heading') return { icon: <Heading size={16} />, title: 'Título', emoji: '' };
        const m = MARKER_TYPES[lastAction as MarkerType];
        if (m) return { emoji: m.emoji, title: m.label, icon: null };
        return { icon: <Highlighter size={16} color={HL_COLORS[hlColor].hex} />, title: 'Resaltar', emoji: '' };
    };

    const fireLastAction = async () => {
        if (lastAction === 'highlight') { await doActionAndSave('highlight', () => { doFormat('highlight'); }); }
        else if (lastAction === 'en') { await doActionAndSave('en', () => { doTranslate('en'); }); }
        else if (lastAction === 'es') { await doActionAndSave('es', () => { doTranslate('es'); }); }
        else if (lastAction === 'link') {
            if (showLinkInput) return; // Si ya está abierto, no hacer nada para evitar reset de URL
            setShowLinkInput(true);
            setLinkUrl('');
            setLastAction('link');
            localStorage.setItem('sme-last-action', 'link');
        }
        else if (lastAction === 'strikethrough') { await doActionAndSave('strikethrough', () => { doFormat('strikethrough'); }); }
        else if (lastAction === 'heading') { await doActionAndSave('heading', () => { doFormat('heading'); }); }
        else if (lastAction in MARKER_TYPES) { await doActionAndSave(lastAction, () => { doFormat(lastAction as MarkerType); }); }
        else { await doActionAndSave('highlight', () => { doFormat('highlight'); }); }
    };

    // Memoized basicSetup to prevent re-configurations
    const basicSetup = useMemo(() => ({
        lineNumbers: false, 
        foldGutter: false, 
        highlightActiveLine: false, 
        highlightActiveLineGutter: false, 
        syntaxHighlighting: false, 
        drawSelection: true,
        allowMultipleSelections: true
    }), []);

    // Memoized extensions to prevent CodeMirror resets
    const searchExtension = useMemo(() => search({ top: false }), []);
    const visualMarkupPlugin = useMemo(() => visualMarkupPluginFactory(translationsMapRef, searchQueryRef), [noteId, searchQuery]);

    const extensions = useMemo(() => [
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
                    key: 'Enter',
                    run: (view) => {
                        if (onEnterAction) {
                            onEnterAction();
                            return true; // Evitar el salto de línea por defecto
                        }
                        return false; // Deja que CodeMirror haga su salto normal
                    },
                    shift: () => false // Shift+Enter hace salto normal siempre
                },
                {
                    key: 'Backspace',
                    run: (view) => {
                        if (onBackspaceEmpty && view.state.doc.length === 0) {
                            onBackspaceEmpty();
                            return true;
                        }
                        return false;
                    }
                },
                {
                    key: 'Escape',
                    run: (view) => {
                        // 🚀 PROTECCIÓN: Si el buscador está abierto, dejamos que CodeMirror lo gestione
                        if (view.dom.querySelector('.cm-search, .cm-panel')) return false;

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
        searchExtension, // 🚀 CORE FIX: Garantiza que el buscador es estable y persistente
        cursorDotPlugin,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        dynamicTheme,
        revealedLineField,
        editingLineField,
        blockMarkupField,
        visualMarkupPlugin, 
        clickHandlerExtension, 
        hoverTooltipExtension, 
        selectionListener, 
        clipboardExtension, 
        dragDropExtension, 
        EditorView.lineWrapping, 
        EditorView.editable.of(!readOnly)
    ], [
        showLineNumbers, 
        searchExtension,
        dynamicTheme, 
        clickHandlerExtension, 
        hoverTooltipExtension, 
        selectionListener, 
        readOnly,
        onEnterAction,
        onBackspaceEmpty,
        noteId,
        visualMarkupPlugin,
        dragDropExtension
    ]);

    // 🚀 LAYOUT STABILITY FIX: Detect container resize and force CodeMirror to recalibrate.
    // This prevents "deformity" when side panels (like Pizarrón) are toggled or window resizes.
    useLayoutEffect(() => {
        if (!containerRef.current || !editorRef.current?.view) return;
        
        const view = editorRef.current.view;
        const resizeObserver = new ResizeObserver(() => {
            // requestMeasure is more efficient than a full dispatch/refresh
            view.requestMeasure();
        });
        
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [noteId]); // Re-bind if noteId changes (CodeMirror usually remounts anyway)

    return (
        <div 
            ref={containerRef}
            className={`relative group/editor w-full ${autoHeight ? 'h-auto' : 'h-full min-h-0'} flex flex-col bg-transparent select-text touch-auto`}
            style={{ WebkitUserSelect: 'text', userSelect: 'text', overflow: 'visible' } as any}
        >
            <CodeMirror
                key={`${noteId}-${String(showLineNumbers)}`}
                ref={editorRef} 
                value={content} 
                onChange={handleChange} 
                onBlur={handleBlur} 
                theme="none" 
                readOnly={readOnly} 
                height={autoHeight ? "auto" : "100%"}
                className={`w-full text-zinc-900 dark:text-[#CCCCCC] ${autoHeight ? '' : 'flex-1'}`} 
                extensions={extensions}
                basicSetup={basicSetup}
            />
            {!autoHeight && <SearchMarkers view={editorRef.current?.view || null} query={searchQuery || ''} />}
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
                    className="floating-menu-container fixed z-[9990] flex flex-col items-center gap-1.5 animate-fadeIn origin-bottom pointer-events-auto"
                    style={{ 
                        top: menuState.top - 6, // 🚀 Un pequeño offset extra para no chocar
                        left: clampedLeft, 
                        transform: 'translate(-50%, -100%)' 
                    }}
                    onClick={(e) => e.stopPropagation()} // Bloquear clics al editor
                    onMouseDown={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.tagName !== 'INPUT' && !target.closest('.wiki-selectable')) {
                            e.preventDefault();
                        }
                        e.stopPropagation();
                    }}
                    onPointerDown={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.tagName !== 'INPUT' && !target.closest('.wiki-selectable')) {
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

                    {/* Menú Principal — aparece directamente al seleccionar */}
                    {!showLinkInput ? (
                        <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl p-1 flex items-center gap-0.5 animate-fadeIn pointer-events-auto">
                            {isTranslating ? (
                                <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-blue-500">
                                    <Loader2 size={13} className="animate-spin" /> Traduciendo...
                                </div>
                            ) : (
                                <>


                                    {/* RESALTADOR DINÁMICO */}
                                    {/* 🔍 WIKIPEDIA — primero en el menú, sin submenú */}
                                    <div
                                        ref={wikiButtonRef}
                                        className="relative flex items-center"
                                        onMouseEnter={() => {
                                            if (wikiCloseTimerRef.current) clearTimeout(wikiCloseTimerRef.current);
                                            setWikiTooltipVisible(true);
                                        }}
                                        onMouseLeave={() => {
                                            if (isInteractingWithWikiRef.current) return;
                                            wikiCloseTimerRef.current = setTimeout(() => {
                                                const sel = window.getSelection();
                                                const isSelectingInside = sel && sel.toString() && sel.anchorNode?.parentElement?.closest('.wiki-selectable');
                                                if (isSelectingInside && !sel.isCollapsed) return;
                                                setWikiTooltipVisible(false);
                                            }, 200);
                                        }}
                                    >
                                        <button
                                            onClick={() => {
                                                const termToSearch = cleanSearchTerm(menuState?.text || '');
                                                if (termToSearch) fetchDefinition(termToSearch);
                                            }}
                                            className="h-[32px] min-w-[40px] px-2 flex items-center justify-center rounded-md transition-colors bg-amber-500/10 hover:bg-amber-500/20 text-amber-500"
                                            title="Buscar en Wikipedia"
                                        >
                                            {isWikiLoading
                                                ? <Loader2 size={13} className="animate-spin" />
                                                : <Search size={16} />
                                            }
                                        </button>

                                        {/* Tooltip Wikipedia — Renderizado vla Portal para aislamiento total */}
                                        {wikiTooltipVisible && wikiResult && createPortal(
                                            <div
                                                ref={wikiMenuRef}
                                                className="fixed bg-white dark:bg-zinc-900 border border-amber-500/30 rounded-xl shadow-2xl p-3 animate-fadeIn z-[10000] pointer-events-auto select-text wiki-selectable"
                                                style={{ 
                                                    userSelect: 'text',
                                                    WebkitUserSelect: 'text',
                                                    // Calculamos posición basada en el botón de forma robusta
                                                    top: (wikiButtonRef.current?.getBoundingClientRect().top || 0) - 12,
                                                    left: (wikiButtonRef.current?.getBoundingClientRect().left || 0) + ((wikiButtonRef.current?.getBoundingClientRect().width || 0) / 2),
                                                    transform: 'translate(-50%, -100%)',
                                                    width: '18rem'
                                                }}
                                                tabIndex={-1}
                                                onMouseEnter={() => {
                                                    if (wikiCloseTimerRef.current) clearTimeout(wikiCloseTimerRef.current);
                                                    setWikiTooltipVisible(true);
                                                }}
                                                onMouseLeave={() => {
                                                    wikiCloseTimerRef.current = setTimeout(() => {
                                                        const sel = window.getSelection();
                                                        if (sel && sel.toString() && !sel.isCollapsed) return;
                                                        setWikiTooltipVisible(false);
                                                    }, 200);
                                                }}
                                                onMouseDown={(e) => {
                                                    isInteractingWithWikiRef.current = true;
                                                    e.currentTarget.focus();
                                                    e.stopPropagation();
                                                }}
                                                onPointerDown={(e) => {
                                                    isInteractingWithWikiRef.current = true;
                                                    e.stopPropagation();
                                                }}
                                                onMouseUp={(e) => e.stopPropagation()}
                                                onClick={(e) => e.stopPropagation()}
                                                onContextMenu={(e) => e.stopPropagation()}
                                            >
                                                {/* Puente invisible */}
                                                <div className="absolute top-full left-0 right-0 h-4 wiki-selectable" 
                                                     onMouseDown={(e) => e.stopPropagation()} 
                                                />

                                                {/* Botón de cierre manual */}
                                                <button 
                                                    onClick={() => setWikiTooltipVisible(false)}
                                                    className="absolute top-2 right-2 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors"
                                                >
                                                    <X size={12} />
                                                </button>

                                                <div className="flex items-start gap-2 pr-4">
                                                    <Search size={12} className="text-amber-500 mt-0.5 shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-black text-amber-500 mb-1 truncate select-text">{wikiResult.title}</p>
                                                        {wikiResult.description && (
                                                            <p className="text-[10px] text-zinc-400 mb-1.5 italic select-text">{wikiResult.description}</p>
                                                        )}
                                                        <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-5 select-text cursor-text">
                                                            {wikiResult.extract}
                                                        </p>
                                                        
                                                        {/* Badge de fuente */}
                                                        <div className="flex items-center justify-between mt-2 select-text">
                                                            <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 select-text">
                                                                {wikiResult.source === 'npm' && '📦 npm Registry'}
                                                                {wikiResult.source === 'pypi' && '🐍 PyPI'}
                                                                {wikiResult.source === 'wikidata' && '🔷 Wikidata'}
                                                                {wikiResult.source === 'google_kg' && '🔍 Google'}
                                                                {wikiResult.source === 'dictionary' && '📝 Dictionary'}
                                                                {wikiResult.source === 'ddg' && '⚡ DuckDuckGo'}
                                                                {wikiResult.source === 'wiki_es' && '📖 Wikipedia ES'}
                                                                {wikiResult.source === 'wiki_en' && '📖 Wikipedia EN'}
                                                                {wikiResult.source === 'none' && '❓ Sin definición'}
                                                            </span>
                                                            
                                                            {wikiResult.url && wikiResult.url !== '#' && (
                                                                <a
                                                                    href={wikiResult.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onMouseDown={(e) => e.stopPropagation()}
                                                                    className="text-[10px] text-amber-500 hover:text-amber-400 font-bold select-text"
                                                                >
                                                                    Ver más →
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>,
                                            document.body
                                        )}

                                        {/* Tooltip "cargando" */}
                                        {wikiTooltipVisible && isWikiLoading && (
                                            <div className="absolute bottom-full left-1/2 mb-2 bg-white dark:bg-zinc-900 border border-amber-500/30 rounded-xl shadow-xl px-3 py-2 animate-fadeIn z-[100]"
                                                style={{ transform: 'translateX(-50%)' }}
                                            >
                                                {/* Puente invisible */}
                                                <div className="absolute top-full left-0 right-0 h-4" />
                                                
                                                <span className="text-[11px] text-amber-500 flex items-center gap-1.5">
                                                    <Loader2 size={10} className="animate-spin" /> Buscando...
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Separador visual */}
                                    <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />

                                    {/* BOTÓN "MÁS" DINÁMICO */}
                                    <div className="relative group/more flex items-center">
                                        <button 
                                            onClick={() => {
                                                if (menuState?.isMobile) {
                                                    setShowMoreOptions(!showMoreOptions);
                                                    setShowHlOptions(false);
                                                    setShowTagOptions(false);
                                                } else {
                                                    // Ejecutar la última acción del menú "Más"
                                                    if (lastMoreAction === 'es' || lastMoreAction === 'en') {
                                                        doActionAndSave(lastMoreAction, () => doTranslate(lastMoreAction as 'es'|'en'));
                                                    } else if (lastMoreAction === 'link') {
                                                        setShowLinkInput(true);
                                                        setLinkUrl('');
                                                    } else {
                                                        doActionAndSave(lastMoreAction, () => doFormat(lastMoreAction as any));
                                                    }
                                                }
                                            }}
                                            onMouseEnter={() => !menuState?.isMobile && setShowMoreOptions(true)}
                                            onMouseLeave={() => !menuState?.isMobile && setShowMoreOptions(false)}
                                            className={`h-[32px] min-w-[40px] px-2 flex items-center justify-center rounded-md transition-colors bg-blue-500/10 hover:bg-blue-500/20 text-blue-500`}
                                            title="Más opciones"
                                        >
                                            {lastMoreAction === 'es' || lastMoreAction === 'en' ? (
                                                <span className="text-[10px] font-black uppercase text-blue-500">{lastMoreAction}</span>
                                            ) : lastMoreAction === 'link' ? (
                                                <LinkIcon size={14} />
                                            ) : lastMoreAction === 'bold' ? (
                                                <Bold size={14} />
                                            ) : lastMoreAction === 'strikethrough' ? (
                                                <Strikethrough size={14} />
                                            ) : lastMoreAction === 'heading' ? (
                                                <Heading size={14} />
                                            ) : (
                                                <MoreHorizontal size={14} />
                                            )}
                                        </button>
                                    </div>

                                    {/* ETIQUETAS DINÁMICAS */}
                                    <div 
                                      className="relative group/tags flex items-center"
                                      onMouseEnter={() => !menuState?.isMobile && setShowTagOptions(true)}
                                      onMouseLeave={() => !menuState?.isMobile && setShowTagOptions(false)}
                                    >
                                        <button 
                                            onClick={() => {
                                                if (menuState?.isMobile) {
                                                    setShowTagOptions(!showTagOptions);
                                                    setShowHlOptions(false);
                                                    setShowMoreOptions(false);
                                                } else {
                                                    // Acción directa: usar lastTag
                                                    doActionAndSave(lastTag, () => doFormat(lastTag));
                                                }
                                            }}
                                            className={`h-[32px] min-w-[40px] px-2 flex items-center justify-center rounded-md transition-colors bg-blue-500/10 hover:bg-blue-500/20 text-blue-500`}
                                            title={`Etiqueta: ${MARKER_TYPES[lastTag].label}`}
                                        >
                                            <span className="text-base">{MARKER_TYPES[lastTag].emoji}</span>
                                        </button>
                                    </div>

                                    {/* RESALTADOR */}
                                    <div 
                                      className="relative group/hl flex items-center"
                                      onMouseEnter={() => !menuState?.isMobile && setShowHlOptions(true)}
                                      onMouseLeave={() => !menuState?.isMobile && setShowHlOptions(false)}
                                    >
                                        <button 
                                            onClick={() => {
                                                if (menuState?.isMobile) {
                                                    setShowHlOptions(!showHlOptions);
                                                    setShowTagOptions(false);
                                                    setShowMoreOptions(false);
                                                } else {
                                                    // Acción directa: el color actual ya está en hlColor
                                                    doActionAndSave('highlight', () => doFormat('highlight', hlColor));
                                                }
                                            }}
                                            title={`Resaltar (${HL_COLORS[hlColor].label})`}
                                            className={`h-[32px] min-w-[40px] px-2 flex items-center justify-center rounded-md transition-colors bg-blue-500/10 hover:bg-blue-500/20`}
                                        >
                                            <Highlighter size={16} style={{ color: HL_COLORS[hlColor].hex }} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : null}
                    {/* SUB-MENUS — centrados respecto a la barra principal */}
                    {showHlOptions && (
                        <div 
                          ref={hlMenuRef}
                          className="absolute bottom-full left-1/2 mb-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-1.5 flex gap-1 items-center animate-fadeIn z-[100]"
                          style={{ transform: `translate(calc(-50% + ${hlShift}px), 0)` }}
                          onMouseEnter={() => !menuState?.isMobile && setShowHlOptions(true)}
                          onMouseLeave={() => !menuState?.isMobile && setShowHlOptions(false)}
                        >
                            <div className="absolute top-full left-0 w-full h-[12px] bg-transparent" />
                            {(Object.keys(HL_COLORS) as HlColorKey[]).map(cKey => (
                                <button
                                  key={cKey}
                                  onClick={() => {
                                    setHlColor(cKey);
                                    doActionAndSave('highlight', () => doFormat('highlight', cKey));
                                    setShowHlOptions(false);
                                  }}
                                  className={`h-[32px] min-w-[40px] px-2 rounded-md flex items-center justify-center transition-all bg-blue-500/10 hover:bg-blue-500/20`}
                                  title={HL_COLORS[cKey].label}
                                >
                                    <Highlighter size={16} color={HL_COLORS[cKey].hex} />
                                </button>
                            ))}
                        </div>
                    )}
                    {showTagOptions && (
                        <div 
                          ref={tagMenuRef}
                          className="absolute bottom-full left-1/2 mb-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-1.5 z-[100] animate-fadeIn"
                          style={{ transform: `translate(calc(-50% + ${tagShift}px), 0)` }}
                          onMouseEnter={() => !menuState?.isMobile && setShowTagOptions(true)}
                          onMouseLeave={() => !menuState?.isMobile && setShowTagOptions(false)}
                        >
                            <div className="absolute top-full left-0 w-full h-[12px] bg-transparent" />
                            <div className="flex items-center gap-1">
                                {(Object.keys(MARKER_TYPES) as MarkerType[]).map(key => {
                                    const cfg = MARKER_TYPES[key];
                                    return (
                                        <button key={key}
                                            onClick={() => {
                                                doActionAndSave(key, () => doFormat(key));
                                                setShowTagOptions(false);
                                            }}
                                            title={cfg.label}
                                            className="h-[32px] min-w-[40px] px-2 rounded-md flex items-center justify-center text-base bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                                        >{cfg.emoji}</button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {showMoreOptions && (
                        <div 
                            ref={moreMenuRef}
                            className="absolute bottom-full left-1/2 mb-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-1 flex flex-row items-center gap-0.5 z-[100] animate-fadeIn"
                            style={{ transform: `translate(calc(-50% + ${moreShift}px), 0)` }}
                            onMouseEnter={() => !menuState?.isMobile && setShowMoreOptions(true)}
                            onMouseLeave={() => !menuState?.isMobile && setShowMoreOptions(false)}
                        >
                            <div className="absolute top-full left-0 w-full h-[12px] bg-transparent" />
                            
                            {/* REVELAR */}
                            <button 
                                onClick={(e) => {
                                    const view = editorRef.current?.view;
                                    if (view && menuState) {
                                        const line = view.state.doc.lineAt(menuState.from);
                                        view.dispatch({ effects: [setRevealedLine.of(line.number), ForceRedrawEffect.of(null)] });
                                    }
                                    closeMenusOnly();
                                }}
                                className="h-[32px] min-w-[40px] px-2 flex items-center justify-center bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-md transition-colors"
                                title="Revelar Markdown"
                            >
                                <Maximize2 size={16} />
                            </button>
                            
                            <div className="w-px h-6 bg-zinc-100 dark:bg-zinc-800 mx-0.5" />

                            {/* NEGRITA */}
                            <button onClick={() => { doActionAndSave('bold', () => doFormat('bold')); setShowMoreOptions(false); }}
                                className="h-[32px] min-w-[40px] px-2 flex items-center justify-center bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-md transition-colors"
                                title="Negrita"
                            >
                                <Bold size={16} />
                            </button>

                            {/* LINK */}
                            <button onClick={() => { setShowLinkInput(true); setShowMoreOptions(false); }}
                                className="h-[32px] min-w-[40px] px-2 flex items-center justify-center bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-md transition-colors"
                                title="Enlace"
                            >
                                <LinkIcon size={16} />
                            </button>

                            {/* TACHADO */}
                            <button onClick={() => { doActionAndSave('strikethrough', () => doFormat('strikethrough')); setShowMoreOptions(false); }}
                                className="h-[32px] min-w-[40px] px-2 flex items-center justify-center bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-md transition-colors"
                                title="Tachado"
                            >
                                <Strikethrough size={16} />
                            </button>

                            {/* TÍTULO */}
                            <button onClick={() => { doActionAndSave('heading', () => doFormat('heading')); setShowMoreOptions(false); }}
                                className="h-[32px] min-w-[40px] px-2 flex items-center justify-center bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-md transition-colors"
                                title="Título"
                            >
                                <Heading size={16} />
                            </button>

                            <div className="w-px h-6 bg-zinc-100 dark:bg-zinc-800 mx-0.5" />

                            {/* TRADUCCIÓN (Compacta) */}
                            <div className="flex items-center gap-0.5 px-0.5">
                                <button onClick={() => { doActionAndSave('es', () => doTranslate('es')); setShowMoreOptions(false); }}
                                    className="h-[32px] px-2 bg-blue-500/10 text-blue-500 rounded-md text-[12px] font-black hover:bg-blue-500/20 transition-colors"
                                >ES</button>
                                <button onClick={() => { doActionAndSave('en', () => doTranslate('en')); setShowMoreOptions(false); }}
                                    className="h-[32px] px-2 bg-blue-500/10 text-blue-500 rounded-md text-[12px] font-black hover:bg-blue-500/20 transition-colors"
                                >EN</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

SmartNotesEditorComponent.displayName = 'SmartNotesEditor';

export const SmartNotesEditor = SmartNotesEditorComponent;