import React from 'react'

/**
 * EmptyState — centered placeholder for empty tabs/lists.
 * Primary line + optional muted hint.
 */
export function EmptyState({ title, hint, style }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--sp-2)',
        color: 'var(--gray-400)',
        fontSize: 'var(--fs-body)',
        textAlign: 'center',
        padding: 'var(--sp-10)',
        ...style,
      }}
    >
      <div>{title}</div>
      {hint && <div style={{ fontSize: 'var(--fs-label)' }}>{hint}</div>}
    </div>
  )
}
