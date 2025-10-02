import React, { useState } from 'react';

export default function Search() {
  const [q, setQ] = useState('');
  // TODO: wire to IPC call that queries blocks_fts and returns snippets
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search…"
        style={{
          width: '100%',
          padding: '8px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          marginBottom: '8px'
        }}
      />
      <button style={{
        padding: '8px 16px',
        backgroundColor: '#007acc',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }}>Go</button>
      <div>{/* results */}</div>
    </div>
  );
}