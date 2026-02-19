import React, { useRef, useLayoutEffect, useState, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

interface SmartEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string; // Allow overriding/merging styles
    autoFocus?: boolean;
}

export const SmartEditor: React.FC<SmartEditorProps> = ({
    value,
    onChange,
    placeholder,
    className,
    autoFocus
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const cursorRef = useRef<number | null>(null);

    // 1. Capture cursor position before any render/update
    // logic: if the value prop changes from outside (e.g. autosave re-render),
    // we want to ensure we don't jump to end.
    // Actually, usually jump happens because value update triggers render, checks inputs, etc.

    // We'll capture cursor on key events or change events mainly.

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        cursorRef.current = e.target.selectionStart;
        onChange(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        if (textareaRef.current && cursorRef.current !== null) {
            textareaRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
            // Optional: reset cursorRef if we only want to enforce it once? 
            // No, keep it stable or maybe clear it if it was a distinct action?
            // Actually, if we type normal char, uncontrolled input handles cursor.
            // If we do controlled update, React might reset it.
            // Let's rely on this only if we think we lost focus or position.
        }
    }, [value]); // Run when value changes to ensure cursor stays put

    useEffect(() => {
        if (autoFocus && textareaRef.current) {
            // Move cursor to end on initial focus if needed, or just focus
            textareaRef.current.focus();
            // If we want to append, we can set selection to end
            textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
        }
    }, [autoFocus]);

    return (
        <TextareaAutosize
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            minRows={5}
            className={`w-full resize-none bg-transparent outline-none text-slate-700 dark:text-slate-300 placeholder-slate-400 font-mono text-sm leading-relaxed ${className || ''}`}
        />
    );
};
