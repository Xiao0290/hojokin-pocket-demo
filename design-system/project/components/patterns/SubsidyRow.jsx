import React from 'react'

/**
 * SubsidyRow — a tappable list row for a subsidy result. Name + frame
 * label + a meta line of stats, with a trailing chevron and hairline.
 * Pass meta as [{ label, value }]; value renders bold.
 */
export function SubsidyRow({ name, frame, meta = [], onClick }) {
  const [pressed, setPressed] = React.useState(false)
  return (
    <div
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        position: 'relative',
        padding: 'var(--sp-5) 0',
        borderBottom: '1px solid var(--line-soft)',
        cursor: 'pointer',
        opacity: pressed ? 0.6 : 1,
        transition: 'opacity var(--dur-fast) var(--ease)',
      }}
    >
      <div
        style={{
          fontSize: 'var(--fs-title)',
          fontWeight: 'var(--fw-bold)',
          color: 'var(--ink)',
          marginBottom: 4,
          paddingRight: 22,
        }}
      >
        {name}
      </div>
      {frame && (
        <div style={{ fontSize: 'var(--fs-label)', color: 'var(--gray-500)', marginBottom: 'var(--sp-2)' }}>
          {frame}
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--sp-4)', fontSize: 13.5, color: 'var(--gray-700)' }}>
        {meta.map((m, i) => (
          <span key={i}>
            {m.label} <b style={{ color: 'var(--ink)', fontWeight: 'var(--fw-bold)' }}>{m.value}</b>
          </span>
        ))}
      </div>
      <span style={{ position: 'absolute', right: 0, top: 'var(--sp-5)', color: 'var(--gray-300)', fontSize: 20 }}>
        ›
      </span>
    </div>
  )
}
