import type { Bullet } from '@/types'

interface CommittedBulletProps {
  bullet: Bullet
}

function CommittedBullet({ bullet }: CommittedBulletProps) {
  // Render text with spans highlighted (basic version)
  const renderTextWithSpans = () => {
    if (bullet.spans.length === 0) {
      return <span>{bullet.text}</span>
    }

    // Sort spans by start position
    const sortedSpans = [...bullet.spans].sort((a, b) => a.start - b.start)

    const parts: JSX.Element[] = []
    let lastEnd = 0

    sortedSpans.forEach((span, idx) => {
      // Add text before span
      if (span.start > lastEnd) {
        parts.push(<span key={`text-${idx}`}>{bullet.text.slice(lastEnd, span.start)}</span>)
      }

      // Add span with styling
      const spanText = bullet.text.slice(span.start, span.end)
      if (span.type === 'wikilink') {
        parts.push(
          <span
            key={`span-${idx}`}
            className="wikilink"
            onClick={() => handleWikilinkClick(span.payload?.target || '')}
            style={{ cursor: 'pointer' }}
          >
            {spanText}
          </span>
        )
      } else if (span.type === 'tag') {
        parts.push(
          <span key={`span-${idx}`} className="tag">
            {spanText}
          </span>
        )
      } else if (span.type === 'url') {
        parts.push(
          <a
            key={`span-${idx}`}
            href={span.payload?.target || ''}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#0969da' }}
          >
            {spanText}
          </a>
        )
      } else {
        parts.push(<span key={`span-${idx}`}>{spanText}</span>)
      }

      lastEnd = span.end
    })

    // Add remaining text
    if (lastEnd < bullet.text.length) {
      parts.push(<span key="text-end">{bullet.text.slice(lastEnd)}</span>)
    }

    return <>{parts}</>
  }

  const handleWikilinkClick = (target: string) => {
    console.log('[CommittedBullet] Wikilink clicked:', target)
    // TODO: Navigate to note or create if doesn't exist
    alert(`Navigate to: ${target}\n\n(Navigation not yet implemented)`)
  }

  return (
    <div
      className="committed-bullet"
      style={{
        marginLeft: `${bullet.depth * 1.5}rem`,
        padding: '0.5rem',
        marginBottom: '0.25rem',
        borderRadius: '4px',
        position: 'relative',
        userSelect: 'text',
      }}
    >
      {/* Bullet point */}
      <div
        style={{
          position: 'absolute',
          left: '-1rem',
          top: '0.5rem',
          color: '#666',
        }}
      >
        •
      </div>

      {/* Text with spans */}
      <div style={{ fontSize: '1rem', lineHeight: '1.6' }}>{renderTextWithSpans()}</div>

      {/* Debug info (remove later) */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            fontSize: '0.65rem',
            color: '#999',
            marginTop: '0.25rem',
          }}
        >
          ID: {bullet.id.slice(0, 8)} | Seq: {bullet.orderSeq} | Depth: {bullet.depth}
        </div>
      )}
    </div>
  )
}

export default CommittedBullet
