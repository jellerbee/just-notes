import React, { useEffect, useRef, useState } from 'react';
import { cycleTaskStateInTextLine } from '../lib/tiptap/tasks';

// MVP: plaintext textarea behaving like an outliner (indent/outdent + task toggles).
// Swap with Tiptap later; this keeps stubs minimal and testable.

type Props = {
  initial: string;
  onChange: (value: string) => void;
  onCmdEnter?: () => void;
};

export default function NoteEditor({ initial, onChange }: Props) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => setValue(initial), [initial]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = value.slice(0, start);
      const sel = value.slice(start, end);
      const after = value.slice(end);

      if (e.shiftKey) {
        // outdent: remove up to 2 leading spaces from each selected line
        const transformed = sel.replace(/^ {1,2}/gm, '');
        const delta = sel.length - transformed.length;
        const newVal = before + transformed + after;
        setValue(newVal); onChange(newVal);
        ta.selectionStart = start - Math.min(delta, 2);
        ta.selectionEnd = start - Math.min(delta, 2) + transformed.length;
      } else {
        // indent: add two spaces at line starts
        const transformed = sel.replace(/^/gm, '  ');
        const delta = transformed.length - sel.length;
        const newVal = before + transformed + after;
        setValue(newVal); onChange(newVal);
        ta.selectionStart = start + 2;
        ta.selectionEnd = end + delta;
      }
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      // Cycle task state for current line
      const pos = ta.selectionStart;
      const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
      const lineEnd = value.indexOf('\n', pos);
      const endPos = lineEnd === -1 ? value.length : lineEnd;
      const line = value.slice(lineStart, endPos);
      const newLine = cycleTaskStateInTextLine(line);
      const newVal = value.slice(0, lineStart) + newLine + value.slice(endPos);
      setValue(newVal); onChange(newVal);
      return;
    }
  }

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => { setValue(e.target.value); onChange(e.target.value); }}
      onKeyDown={handleKeyDown}
      spellCheck={false}
      style={{
        width: '100%',
        height: '80vh',
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
        fontSize: 14,
        padding: '16px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        resize: 'vertical'
      }}
    />
  );
}