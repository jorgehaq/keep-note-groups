import React, { useRef, useLayoutEffect, forwardRef, useImperativeHandle, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

interface SmartEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

export const SmartEditor = forwardRef<HTMLTextAreaElement, SmartEditorProps>(({
    value,
    onChange,
    placeholder,
    className,
    autoFocus,
    onKeyDown: externalKeyDown,
    onPaste
}, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const cursorRef = useRef<number | null>(null);

    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        cursorRef.current = e.target.selectionStart;
        onChange(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (externalKeyDown) {
            externalKeyDown(e);
            if (e.defaultPrevented) return;
        }

        // Tabulador = 2 espacios
        if (e.key === 'Tab') {
            e.preventDefault();
            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const newValue = value.substring(0, start) + "  " + value.substring(end);
            onChange(newValue);
            cursorRef.current = start + 2;
        }

        // Magia del Enter: Continuar listas y números
        if (e.key === 'Enter') {
            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const valueUpToCursor = value.substring(0, start);
            const lines = valueUpToCursor.split('\n');
            const currentLine = lines[lines.length - 1];

            // Detectar viñetas (- o *)
            const bulletMatch = currentLine.match(/^(\s*)([-*])\s(.*)/);
            // Detectar números (1., 2., etc)
            const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)/);

            if (bulletMatch) {
                e.preventDefault();
                if (!bulletMatch[3].trim()) {
                    // Si dimos enter en una viñeta vacía, la borramos para salir de la lista
                    const newValue = value.substring(0, start - bulletMatch[0].length) + '\n' + value.substring(target.selectionEnd);
                    onChange(newValue);
                    cursorRef.current = start - bulletMatch[0].length + 1;
                } else {
                    // Continuar viñeta
                    const insertText = `\n${bulletMatch[1]}${bulletMatch[2]} `;
                    const newValue = value.substring(0, start) + insertText + value.substring(target.selectionEnd);
                    onChange(newValue);
                    cursorRef.current = start + insertText.length;
                }
            } else if (numberMatch) {
                e.preventDefault();
                if (!numberMatch[3].trim()) {
                    const newValue = value.substring(0, start - numberMatch[0].length) + '\n' + value.substring(target.selectionEnd);
                    onChange(newValue);
                    cursorRef.current = start - numberMatch[0].length + 1;
                } else {
                    // Incrementar número automáticamente
                    const nextNum = parseInt(numberMatch[2], 10) + 1;
                    const insertText = `\n${numberMatch[1]}${nextNum}. `;
                    const newValue = value.substring(0, start) + insertText + value.substring(target.selectionEnd);
                    onChange(newValue);
                    cursorRef.current = start + insertText.length;
                }
            }
        }
    };

    useLayoutEffect(() => {
        if (internalRef.current && cursorRef.current !== null) {
            internalRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
        }
    }, [value]);

    useEffect(() => {
        if (autoFocus && internalRef.current) {
            internalRef.current.focus();
            internalRef.current.setSelectionRange(internalRef.current.value.length, internalRef.current.value.length);
        }
    }, [autoFocus]);

    return (
        <TextareaAutosize
            ref={internalRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={onPaste}
            placeholder={placeholder}
            minRows={5}
            className={`w-full max-w-full resize-none bg-transparent outline-none overflow-x-hidden break-words ${className || ''}`}
        />
    );
});

SmartEditor.displayName = 'SmartEditor';
