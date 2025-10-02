import React from 'react';
import Search from '../components/Search';
import TasksView from '../components/TasksView';

export default function Home() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, height: '100vh' }}>
      <aside style={{
        padding: '16px',
        borderRight: '1px solid #ccc',
        backgroundColor: '#f5f5f5'
      }}>
        <button style={{
          width: '100%',
          padding: '8px',
          marginBottom: '8px',
          backgroundColor: '#007acc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>Today</button>
        <button style={{
          width: '100%',
          padding: '8px',
          marginBottom: '8px',
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>New Note</button>
        <button style={{
          width: '100%',
          padding: '8px',
          marginBottom: '16px',
          backgroundColor: '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>Reindex</button>
        <hr style={{ margin: '16px 0' }} />
        <Search />
      </aside>
      <main>
        <TasksView />
      </main>
    </div>
  );
}