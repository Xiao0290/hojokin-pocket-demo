import React from 'react'

/**
 * Spinner — brand-blue ring loading indicator.
 * Used on the diagnose screen and inside loading buttons.
 */
export function Spinner({ size = 56, stroke = 5, style }) {
  return (
    <span
      role="status"
      aria-label="読み込み中"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `${stroke}px solid var(--line)`,
        borderTopColor: 'var(--blue-500)',
        borderRadius: '50%',
        animation: 'hp-spinner .85s linear infinite',
        ...style,
      }}
    >
      <style>{'@keyframes hp-spinner{to{transform:rotate(360deg)}}'}</style>
    </span>
  )
}
