import { Mark, mergeAttributes, Extension } from '@tiptap/core';
import { Link } from '@tiptap/extension-link';

export const CustomHighlight = Mark.create({
  name: 'customHighlight',
  parseHTML() { return [{ tag: 'mark[data-type="highlight"]' }]; },
  renderHTML({ HTMLAttributes }) {
    return [
      'mark',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'highlight',
        // Se añade tiptap-mark-hl para inyectar la X por CSS
        class: 'relative bg-[#ccff00] text-black rounded px-1 font-bold transition-colors inline-block tiptap-mark-hl',
      }),
      0, // <-- 0 es hijo único y feliz, cero RangeErrors.
    ];
  },
});

export const TranslationMark = Mark.create({
  name: 'translationMark',
  addAttributes() {
    return {
      translationId: { default: null, parseHTML: el => el.getAttribute('data-translation-id'), renderHTML: attrs => attrs.translationId ? { 'data-translation-id': attrs.translationId } : {} },
      translationText: { default: null, parseHTML: el => el.getAttribute('data-translation-text'), renderHTML: attrs => attrs.translationText ? { 'data-translation-text': attrs.translationText } : {} }
    };
  },
  parseHTML() { return [{ tag: 'mark[data-type="translation"]' }]; },
  renderHTML({ HTMLAttributes }) {
    return [
      'mark',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'translation',
        // Se añade tiptap-mark-tr
        class: 'relative bg-[#60A5FA] text-black rounded px-1 font-bold cursor-help transition-colors inline-block tiptap-mark-tr',
      }),
      0,
    ];
  },
});

export const CustomLink = Link.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      openOnClick: true, // El clic normal navegará al link como pediste
      linkOnPaste: true,
      autolink: true,
      protocols: ['http', 'https', 'mailto', 'tel'],
      HTMLAttributes: {
        // Se añade tiptap-mark-link
        class: 'relative text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded cursor-pointer inline-block transition-all decoration-blue-500/30 underline-offset-2 tiptap-mark-link',
      },
      validate: undefined,
    }
  },
});

// Añade esto al final del archivo existente
export const SmartTabs = Extension.create({
  name: 'smartTabs',
  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        // Inserta 4 espacios inquebrantables, esto garantiza que el HTML respete la tabulación siempre
        editor.chain().focus().insertContent('&nbsp;&nbsp;&nbsp;&nbsp;').run();
        return true;
      },
    }
  },
});