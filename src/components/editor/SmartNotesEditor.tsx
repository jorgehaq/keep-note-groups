// src/components/editor/SmartNotesEditor.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView, ViewPlugin, Decoration, WidgetType, ViewUpdate, keymap } from '@codemirror/view';
import { RangeSet, StateEffect, Prec } from '@codemirror/state'; 
import { Highlighter, Languages, Loader2, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface SmartNotesEditorProps {
    noteId: string;
    initialContent: string;
    searchQuery?: string;
    onChange: (markdown: string) => void;
    // --- NUEVAS PROPS DE TIPOGRAFÍA DINÁMICA ---
    noteFont?: string; 
    noteFontSize?: string; 
}

const ForceRedrawEffect = StateEffect.define<null>();

class RemoveButtonWidget extends WidgetType {
    constructor(readonly from: number, readonly to: number, readonly innerText: string) { super(); }
    eq(other: RemoveButtonWidget) { return other.from === this.from && other.to === this.to && other.innerText === this.innerText; }
    toDOM(view: EditorView) {
        const btn = document.createElement("span");
        btn.className = "cm-remove-btn";
        btn.innerHTML = "&times;"; 
        btn.title = "Quitar formato";
        btn.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); view.dispatch({ changes: { from: this.from, to: this.to, insert: this.innerText } }); };
        return btn;
    }
}

class HrWidget extends WidgetType {
    toDOM() { const span = document.createElement("span"); span.className = "cm-custom-hr"; return span; }
}

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

        const safeReplace = (from: number, to: number) => { if (from < to) decos.push(Decoration.replace({}).range(from, to)); };
        const safeMark = (className: string, from: number, to: number, attrs?: any) => {
            if (from < to) decos.push((attrs ? Decoration.mark({ class: className, attributes: attrs }) : Decoration.mark({ class: className })).range(from, to));
        };

        for (let { from, to } of view.visibleRanges) {
            const textToSearch = view.state.doc.sliceString(from, to);
            const rules = [
                { type: 'hl', regex: /==([\s\S]*?)==/g }, { type: 'tr', regex: /\[\[tr:([^|\]]+)\|([\s\S]*?)\]\]/g },
                { type: 'h1', regex: /^(#{1,6})\s+(.*)/gm }, { type: 'bold', regex: /\*\*([\s\S]*?)\*\*/g }, 
                { type: 'italic_under', regex: /(?<!_)_([^_]+)_(?!_)/g }, { type: 'italic_star', regex: /(?<!\*)\*([^*]+)\*(?!\*)/g }, 
                { type: 'hr', regex: /^---+$/gm }, { type: 'md-link', regex: /\[([^\]]*)\]\(([^)\n]*)\)/g },
                { type: 'raw-link', regex: /(?<!\()(https?:\/\/[^\s\n)]+)/g }
            ];

            rules.forEach(rule => {
                let match;
                while ((match = rule.regex.exec(textToSearch)) !== null) {
                    const mFrom = from + match.index; const mTo = from + match.index + match[0].length;
                    const isFocused = view.state.doc.lineAt(mFrom).number === lineAtCursor;

                    if (rule.type === 'raw-link') safeMark('cm-custom-link', mFrom, mTo, { 'data-url': match[0] });
                    else if (rule.type === 'md-link') {
                        safeReplace(mFrom, mFrom + 1); if (match[1].length > 0) safeMark('cm-custom-link', mFrom + 1, mFrom + 1 + match[1].length, { 'data-url': match[2] }); 
                        safeReplace(mFrom + 1 + match[1].length, mTo); decos.push(Decoration.widget({ widget: new RemoveButtonWidget(mFrom, mTo, match[1]), side: 1 }).range(mTo, mTo));
                    }
                    else if (rule.type === 'tr') {
                        const translatedText = match[1] === 'legacy' ? 'Traduciendo...' : match[1];
                        safeReplace(mFrom, mFrom + 6 + (match[1]?.length || 0));
                        safeMark('cm-custom-tr', mFrom + 6 + (match[1]?.length || 0), mTo - 2, { 'data-translation-text': translatedText });
                        safeReplace(mTo - 2, mTo); decos.push(Decoration.widget({ widget: new RemoveButtonWidget(mFrom, mTo, match[2]), side: 1 }).range(mTo, mTo));
                    } 
                    else if (rule.type === 'hl') {
                        safeReplace(mFrom, mFrom + 2); safeMark('cm-custom-hl', mFrom + 2, mTo - 2);
                        safeReplace(mTo - 2, mTo); decos.push(Decoration.widget({ widget: new RemoveButtonWidget(mFrom, mTo, match[1]), side: 1 }).range(mTo, mTo));
                    }
                    else if (rule.type === 'hr') {
                        safeReplace(mFrom, mTo); decos.push(Decoration.widget({ widget: new HrWidget(), side: 0 }).range(mFrom, mFrom));
                        decos.push(Decoration.widget({ widget: new RemoveButtonWidget(mFrom, mTo, ""), side: 1 }).range(mTo, mTo));
                    }
                    else if (rule.type === 'h1') {
                        if (isFocused) safeMark('cm-custom-h1', mFrom, mTo); 
                        else { const pLen = match[0].match(/^(#{1,6}\s+)/)?.[0].length || 2; safeReplace(mFrom, mFrom + pLen); safeMark('cm-custom-h1', mFrom + pLen, mTo); }
                    } 
                    else if (rule.type === 'bold') {
                        if (isFocused) safeMark('cm-custom-bold', mFrom, mTo); else { safeReplace(mFrom, mFrom + 2); safeMark('cm-custom-bold', mFrom + 2, mTo - 2); safeReplace(mTo - 2, mTo); }
                    }
                    else if (rule.type === 'italic_under' || rule.type === 'italic_star') {
                        if (isFocused) safeMark('cm-custom-italic', mFrom, mTo); else { safeReplace(mFrom, mFrom + 1); safeMark('cm-custom-italic', mFrom + 1, mTo - 1); safeReplace(mTo - 1, mTo); }
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

const clickHandlerExtension = EditorView.domEventHandlers({
    click: (e) => {
        const linkNode = (e.target as HTMLElement).closest('.cm-custom-link');
        if (linkNode) { const url = linkNode.getAttribute('data-url'); if (url) { window.open(url, '_blank', 'noopener,noreferrer'); return true; } }
        return false;
    }
});

// --- EL TEMA AHORA ES UNA FUNCIÓN DINÁMICA ---
const createNotesTheme = (font: string, size: string) => {
    // Mapeo Inteligente de Fuentes
    const fontFamily = font === 'serif' ? 'var(--font-serif) !important' :
                       font === 'mono'  ? 'var(--font-mono) !important' :
                                          'var(--font-sans) !important';
    
    // Mapeo Inteligente de Tamaños
    const fontSize = size === 'small' ? '13px !important' : size === 'large' ? '18px !important' : '15px !important';

    return EditorView.theme({
        "&": {
            fontSize: fontSize,
            fontFamily: fontFamily,
            backgroundColor: "transparent !important", 
            color: "inherit !important",               
            transition: "font-size 0.2s ease, font-family 0.2s ease" // Animación suave al cambiar ajustes
        },
        ".cm-scroller": {
            fontFamily: fontFamily,
            fontSize: fontSize,
        },
        ".cm-content": {
            fontFamily: fontFamily,
            fontSize: fontSize,
        },
        "&.cm-focused .cm-cursor": { borderLeftColor: "currentColor !important", borderLeftWidth: "2px !important" },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "rgba(99, 102, 241, 0.3) !important", color: "inherit !important" },
        ".cm-content *": { textDecoration: "none !important", boxShadow: "none !important" },
        ".cm-line": { lineHeight: "1.6" },
        "&.cm-focused": { outline: "none" },
        ".cm-gutters": { display: "none" },
        ".cm-custom-hl": { backgroundColor: "#ccff00", color: "#000 !important", borderRadius: "4px", padding: "0 2px", fontWeight: "600" },
        ".cm-custom-tr": { position: "relative", backgroundColor: "rgba(96, 165, 250, 0.9)", color: "#000 !important", borderRadius: "4px", padding: "0 2px", fontWeight: "600", cursor: "help" },
        ".cm-custom-h1": { fontSize: "1.4em", fontWeight: "bold", color: "inherit", lineHeight: "1.2" },
        ".cm-custom-bold": { fontWeight: "bold", color: "inherit" },
        ".cm-custom-italic": { fontStyle: "italic", color: "inherit" },
        ".cm-url, .cm-link, .cm-custom-link, .cm-custom-link *": { color: "#60A5FA !important", textDecoration: "underline !important", cursor: "pointer !important", transition: "opacity 0.2s", opacity: "1 !important" },
        ".cm-custom-link:hover": { opacity: "0.8 !important" },
        ".cm-custom-hr": { display: "inline-block", verticalAlign: "middle", width: "calc(100% - 30px)", height: "2px", backgroundColor: "#d4d4d8", margin: "12px 0", borderRadius: "2px" },
        ".dark .cm-custom-hr": { backgroundColor: "#3f3f46" },
        ".cm-search-match": { backgroundColor: "rgba(245, 158, 11, 0.4) !important", borderBottom: "2px solid #f59e0b", borderRadius: "2px", color: "inherit" },
        ".cm-remove-btn": { position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: "#ef4444", border: "2px solid #ffffff", color: "white !important", width: "18px", height: "18px", marginRight: "-18px", top: "-10px", left: "-6px", borderRadius: "50%", fontSize: "14px", fontWeight: "bold", lineHeight: "1", cursor: "pointer !important", zIndex: "100", opacity: "0", transform: "scale(0.8)", transition: "all 0.2s", pointerEvents: "auto" },
        ".cm-line:hover .cm-remove-btn": { opacity: "0.4", transform: "scale(0.9)" },
        ".cm-remove-btn:hover": { opacity: "1 !important", transform: "scale(1.1) !important" }
    });
};

export const SmartNotesEditor: React.FC<SmartNotesEditorProps> = ({
    noteId, initialContent, searchQuery, onChange, noteFont = 'sans', noteFontSize = 'medium'
}) => {
    const [content, setContent] = useState('');
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const [menuState, setMenuState] = useState<{top: number, left: number, from: number, to: number, text: string, isMobile?: boolean} | null>(null);
    const [tooltipState, setTooltipState] = useState<{text: string, top: number, left: number} | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    
    const translationsMapRef = useRef<Record<string, string>>({});
    const searchQueryRef = useRef<string>(searchQuery || ''); 
    const debounceChangeTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Regenera el tema visual solo si cambias la fuente o el tamaño en los ajustes
    const dynamicTheme = useMemo(() => createNotesTheme(noteFont, noteFontSize), [noteFont, noteFontSize]);

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
            }
        },
        mouseout: (e) => { if ((e.target as HTMLElement).classList.contains('cm-custom-tr')) setTooltipState(null); }
    }), []);

    useEffect(() => {
        let clean = initialContent || '';
        if (clean.includes('<p>')) {
            clean = clean.replace(/<mark data-type="translation"[^>]*data-translation-text="([^"]+)"[^>]*>([\s\S]*?)<\/mark>/g, '[[tr:$1|$2]]')
                .replace(/<p>/g, '').replace(/<\/p>/g, '\n').replace(/<br>/g, '\n')
                .replace(/<mark data-type="highlight">([^<]+)<\/mark>/g, '==$1==')
                .replace(/<mark data-type="translation"[^>]*>([\s\S]*?)<\/mark>/g, '[[tr:legacy|$1]]');
        }
        setContent(prev => prev !== clean ? clean : prev);
    }, [initialContent, noteId]);

    const selectionListener = EditorView.updateListener.of((update) => {
        if (update.viewportChanged || update.docChanged) setTooltipState(null);
        if (update.selectionSet) {
            const { main } = update.state.selection;
            if (!main.empty) {
                const rect = update.view.coordsAtPos(main.from);
                if (rect) {
                    const isMobile = window.innerWidth < 768;
                    setMenuState({ 
                        top: isMobile ? 0 : rect.top - 55, 
                        left: isMobile ? 0 : rect.left, 
                        from: main.from, 
                        to: main.to, 
                        text: update.state.doc.sliceString(main.from, main.to),
                        isMobile 
                    });
                }
            } else setMenuState(null);
        }
    });

    const doHighlight = () => {
        if (!menuState || !editorRef.current?.view) return;
        const r = `==${menuState.text}==`;
        editorRef.current.view.dispatch({ changes: { from: menuState.from, to: menuState.to, insert: r }, selection: { anchor: menuState.from + r.length } });
        setMenuState(null);
    };

    const doLink = () => {
        if (!menuState || !editorRef.current?.view) return;
        const text = menuState.text.trim();
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
        let replacement = '';
        if (urlMatch) {
            const url = urlMatch[1];
            let title = text.replace(url, '').replace(/^[-\s]+/, '').trim();
            replacement = `[${title || url}](${url})`;
        } else replacement = `[${text}]()`;
        editorRef.current.view.dispatch({ changes: { from: menuState.from, to: menuState.to, insert: replacement }, selection: { anchor: menuState.from + replacement.length } });
        setMenuState(null);
    };

    const doTranslate = async (targetLang: 'en' | 'es') => {
        if (!menuState || !editorRef.current?.view) return;
        const textToTranslate = menuState.text.trim();
        if (!textToTranslate) return;

        setIsTranslating(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Debes iniciar sesión para traducir.");

            const sourceLang = targetLang === 'en' ? 'es' : 'en';

            const { data, error } = await supabase.functions.invoke('translateMyAppNotes', {
                body: { sourceLang, targetLang, text: textToTranslate },
                headers: { Authorization: `Bearer ${session.access_token}` }
            });

            if (error) {
                let eMsg = error.message;
                try {
                    const eRes = await error.context.json();
                    if (eRes && eRes.error) eMsg = eRes.error;
                } catch(e) {}
                throw new Error(eMsg);
            }

            const translatedText = data.translation;
            const replacement = `[[tr:${translatedText}|${textToTranslate}]]`;
            
            // Guardar en el historial de traducciones
            await supabase.from('translations').insert([{
                user_id: session.user.id,
                source_text: textToTranslate,
                translated_text: translatedText,
                source_lang: sourceLang,
                target_lang: targetLang
            }]);

            editorRef.current.view.dispatch({ 
                changes: { from: menuState.from, to: menuState.to, insert: replacement }, 
                selection: { anchor: menuState.from + replacement.length } 
            });
            setMenuState(null);
        } catch (error: any) {
            console.error("Translation error:", error);
            alert("Error al traducir: " + error.message);
        } finally {
            setIsTranslating(false);
        }
    };

    const handleChange = (value: string) => {
        setContent(value); 
        if (debounceChangeTimerRef.current) clearTimeout(debounceChangeTimerRef.current);
        debounceChangeTimerRef.current = setTimeout(() => onChange(value), 800); 
    };

    const handleBlur = () => {
        if (debounceChangeTimerRef.current) { clearTimeout(debounceChangeTimerRef.current); onChange(content); }
    };

    return (
        <div className="relative group/editor w-full bg-transparent">
            <CodeMirror
                ref={editorRef} value={content} onChange={handleChange} onBlur={handleBlur} theme="none" 
                extensions={[
                    // 🚀 MAGIA ANTI-HIJACKING: Prec.highest toma el control absoluto del evento
                    Prec.highest(
                        keymap.of([{ 
                            key: 'Tab', 
                            preventDefault: true, 
                            run: (view) => { 
                                // replaceSelection inyecta en el cursor y lo mueve al final de la inserción automáticamente
                                view.dispatch(view.state.replaceSelection('    ')); 
                                return true; 
                            } 
                        }])
                    ),
                    
                    markdown({ base: markdownLanguage, codeLanguages: languages }),
                    dynamicTheme, 
                    createVisualMarkupPlugin(translationsMapRef, searchQueryRef), 
                    clickHandlerExtension, hoverTooltipExtension, selectionListener, EditorView.lineWrapping
                ]}
                basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false, syntaxHighlighting: false }}
                className="text-zinc-900 dark:text-zinc-100" 
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
                    className={`
                        z-[100] flex items-center gap-1 bg-zinc-900 text-white p-1.5 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-zinc-700 animate-fadeIn pointer-events-auto
                        ${menuState.isMobile 
                            ? 'fixed bottom-6 left-4 right-4 justify-around p-2' 
                            : 'fixed origin-bottom'
                        }
                    `}
                    style={menuState.isMobile ? undefined : { top: menuState.top, left: menuState.left, transform: 'translateX(-50%)' }} 
                    onMouseDown={(e) => e.preventDefault()} 
                >
                    {isTranslating ? ( <div className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-blue-400"><Loader2 size={16} className="animate-spin" /> Traduciendo...</div> ) : (
                        <><button onClick={doHighlight} className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-black rounded-lg text-xs font-bold transition-colors text-white active:scale-95"><Highlighter size={14} className="text-[#ccff00]" /> Resaltar</button>
                        <button onClick={doLink} className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded-lg transition-colors"><LinkIcon size={16} /></button><div className="w-px h-6 bg-zinc-700 mx-1"></div>
                        <button onClick={() => doTranslate('en')} className="flex items-center gap-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/40 rounded-lg text-xs font-bold transition-colors text-blue-400 active:scale-95"> EN</button>
                        <button onClick={() => doTranslate('es')} className="flex items-center gap-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/40 rounded-lg text-xs font-bold transition-colors text-blue-400 active:scale-95"> ES</button></>
                    )}
                </div>
            )}
        </div>
    );
};