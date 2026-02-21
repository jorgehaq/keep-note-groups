import React, { useRef, useLayoutEffect, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

interface SmartEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const SmartEditor = forwardRef<HTMLTextAreaElement, SmartEditorProps>(({
    value,
    onChange,
    placeholder,
    className,
    autoFocus,
    onKeyDown: externalKeyDown
}, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const cursorRef = useRef<number | null>(null);

    // Expose internalRef to parent via ref
    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement);

    // 1. Capture cursor position before any render/update
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        cursorRef.current = e.target.selectionStart;
        onChange(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Let parent handle first (e.g. checklist Enter)
        if (externalKeyDown) {
            externalKeyDown(e);
            if (e.defaultPrevented) return;
        }

        if (e.key === 'Tab') {
            e.preventDefault();

            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const end = target.selectionEnd;

            // Insert 2 spaces
            const newValue = value.substring(0, start) + "  " + value.substring(end);

            // Update state immediately for responsiveness
            onChange(newValue);

            // Set cursor expectation
            cursorRef.current = start + 2;
        }
    };

    // 2. Restore cursor position after render
    useLayoutEffect(() => {
        if (internalRef.current && cursorRef.current !== null) {
            internalRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
        }
    }, [value]); // Run when value changes to ensure cursor stays put

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
            placeholder={placeholder}
            minRows={5}
            className={`w-full max-w-full resize-none bg-transparent outline-none text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 font-mono text-sm leading-relaxed overflow-x-hidden break-words ${className || ''}`}
        />
    );
});

SmartEditor.displayName = 'SmartEditor';
