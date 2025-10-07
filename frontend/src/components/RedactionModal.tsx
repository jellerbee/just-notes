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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold mb-4">Redact Bullet</h2>

        <p className="text-gray-600 mb-4">
          Are you sure you want to redact this bullet? This cannot be undone.
        </p>

        <div className="bg-gray-100 p-3 rounded mb-4 text-sm">
          <p className="text-gray-700 italic truncate">"{bulletText}"</p>
        </div>

        <div className="mb-6">
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
            Reason (optional)
          </label>
          <input
            id="reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Contains sensitive information"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700"
          >
            Redact
          </button>
        </div>
      </div>
    </div>
  )
}
