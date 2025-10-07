interface KeyboardHelpModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ShortcutGroup {
  title: string
  shortcuts: Array<{ keys: string; description: string }>
}

export function KeyboardHelpModal({ isOpen, onClose }: KeyboardHelpModalProps) {
  if (!isOpen) return null

  const shortcutGroups: ShortcutGroup[] = [
    {
      title: 'Global Navigation',
      shortcuts: [
        { keys: 'Cmd/Ctrl+K', description: 'Open global search' },
        { keys: 'Cmd/Ctrl+B', description: 'Toggle backlinks panel' },
        { keys: 'Cmd/Ctrl+T', description: 'Open master tasks view' },
        { keys: 'Cmd/Ctrl+H', description: 'Go to today\'s daily note' },
        { keys: 'Cmd/Ctrl+/', description: 'Show keyboard shortcuts (this dialog)' },
      ],
    },
    {
      title: 'Daily Note Navigation',
      shortcuts: [
        { keys: 'Cmd/Ctrl+↑', description: 'Go to previous day' },
        { keys: 'Cmd/Ctrl+↓', description: 'Go to next day' },
      ],
    },
    {
      title: 'Bullet Editor',
      shortcuts: [
        { keys: 'Enter', description: 'Commit current bullet (becomes read-only)' },
        { keys: 'Tab', description: 'Increase indent depth' },
        { keys: 'Shift+Tab', description: 'Decrease indent depth' },
        { keys: '[[', description: 'Trigger wikilink autocomplete' },
        { keys: '#', description: 'Trigger tag autocomplete' },
        { keys: '[ ]', description: 'Create task (auto-detected on commit)' },
        { keys: 'Right-click', description: 'Context menu (redact committed bullets)' },
      ],
    },
    {
      title: 'Search Modal (Cmd+K)',
      shortcuts: [
        { keys: '↑/↓', description: 'Navigate results' },
        { keys: 'Enter', description: 'Go to selected result' },
        { keys: 'PgUp/PgDn', description: 'Navigate pages (50 results/page)' },
        { keys: 'Cmd/Ctrl+←/→', description: 'Navigate pages (alternate)' },
        { keys: 'Esc', description: 'Close modal' },
      ],
    },
    {
      title: 'Tasks Modal (Cmd+T)',
      shortcuts: [
        { keys: '↑/↓', description: 'Navigate tasks' },
        { keys: 'Space', description: 'Cycle task state (TODO → DOING → DONE)' },
        { keys: 'Enter', description: 'Go to selected task' },
        { keys: 'PgUp/PgDn', description: 'Navigate pages (50 tasks/page)' },
        { keys: 'Cmd/Ctrl+←/→', description: 'Navigate pages (alternate)' },
        { keys: 'Esc', description: 'Close modal' },
      ],
    },
  ]

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          width: '90%',
          maxWidth: '700px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid #e0e0e0' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
            Keyboard Shortcuts
          </h2>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
          }}
        >
          {shortcutGroups.map((group, groupIndex) => (
            <div
              key={groupIndex}
              style={{
                marginBottom: groupIndex < shortcutGroups.length - 1 ? '24px' : 0,
              }}
            >
              <h3
                style={{
                  margin: '0 0 12px 0',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#007acc',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {group.title}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {group.shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#f8f9fa',
                      borderRadius: '4px',
                    }}
                  >
                    <span style={{ fontSize: '14px', color: '#333' }}>
                      {shortcut.description}
                    </span>
                    <kbd
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        background: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '3px',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              background: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
