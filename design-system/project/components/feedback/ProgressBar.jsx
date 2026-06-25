import React from 'react'

/**
 * ProgressBar — thin determinate track, brand-blue fill.
 * value is 0–100.
 */
export function ProgressBar({ value = 0, style }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        height: 5,
        background: 'var(--line)',
        borderRadius: 4,
        overflow: 'hidden',
        ...style,
      }}
    >
      <span
        style={{
          display: 'block',
          height: '100%',
          width: `${pct}%`,
          background: 'var(--blue-500)',
          borderRadius: 4,
          transition: 'width var(--dur) var(--ease)',
        }}
      />
    </div>
  )
}
