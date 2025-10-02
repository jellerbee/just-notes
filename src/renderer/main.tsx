console.log('🚀 React main.tsx script is loading...');

import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import NoteEditor from './components/NoteEditor';

console.log('📦 React imported successfully');

declare global { interface Window { api?: any } }
const { ipcRenderer } = (window as any).require?.('electron') ?? { ipcRenderer: null };

function App() {
  console.log('React App component rendering!');

  const [content, setContent] = useState('# Daily Note\n\n- [ ] Sample task\n- Regular bullet point\n- [ ] (Doing) Task in progress\n- [x] Completed task');
  const [filePath] = useState('demo-note.md');
  const [saveStatus, setSaveStatus] = useState('');

  const handleSave = useCallback(async (newContent: string) => {
    setContent(newContent);
    setSaveStatus('Saving...');

    try {
      if (ipcRenderer) {
        await ipcRenderer.invoke('fs.write', '/tmp/demo-note.md', newContent);
        setSaveStatus('✅ Saved');
      } else {
        setSaveStatus('⚠️ No file system access');
      }
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('❌ Save failed');
    }

    setTimeout(() => setSaveStatus(''), 2000);
  }, []);

  return (
    <div style={{
      fontFamily: 'system-ui, sans-serif',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <header style={{
        backgroundColor: '#fff',
        padding: '16px',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ margin: 0, color: '#333', fontSize: '18px' }}>
          📝 {filePath}
        </h1>
        <div style={{ fontSize: '14px', color: '#666' }}>
          {saveStatus}
        </div>
      </header>

      <main style={{ padding: '20px' }}>
        <NoteEditor
          initial={content}
          onChange={handleSave}
        />
      </main>

      <footer style={{
        backgroundColor: '#fff',
        padding: '12px 16px',
        borderTop: '1px solid #ddd',
        fontSize: '12px',
        color: '#666'
      }}>
        <p><strong>✅ Notes app working without database!</strong></p>
        <p>Try: Cmd/Ctrl+Enter to cycle tasks • Tab/Shift+Tab to indent/outdent</p>
      </footer>
    </div>
  );
}

console.log('📦 About to render React app...');

const rootElement = document.getElementById('root');
if (rootElement) {
  console.log('📦 Root element found, rendering...');
  createRoot(rootElement).render(<App />);
  console.log('📦 React app rendered successfully');
} else {
  console.error('❌ Root element not found!');
}