import { useState } from 'react'

interface RedactionModalProps {
  isOpen: boolean
  bulletText: string
  onConfirm: (reason: string) => void
  onCancel: () => void
}

export function RedactionModal({ isOpen, bulletText, onConfirm, onCancel }: RedactionModalProps) {
  const [reason, setReason] = useState('')

  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm(reason)
    setReason('') // Reset for next time
  }

  const handleCancel = () => {
    setReason('')
    onCancel()
  }

  return (
    <div style={{
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
    onClick={handleCancel}
    >
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      }}
      onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
          Redact Bullet
        </h2>

        <p style={{ color: '#666', marginBottom: '16px' }}>
          Are you sure you want to redact this bullet? The content will be struck through.
        </p>

        <div style={{
          background: '#f5f5f5',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '14px',
        }}>
          <p style={{ color: '#555', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            "{bulletText}"
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label htmlFor="reason" style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#333', marginBottom: '8px' }}>
            Reason (optional)
          </label>
          <input
            id="reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Contains sensitive information"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
            }}
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '8px 16px',
              color: '#333',
              background: '#f0f0f0',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '8px 16px',
              color: 'white',
              background: '#dc2626',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Redact
          </button>
        </div>
      </div>
    </div>
  )
}
