import React from 'react'

/**
 * Badge — small status / category pill.
 * Tones: solid, outline, success, warning, danger, neutral, brand-tint.
 */
export function Badge({ children, tone = 'neutral', style }) {
  const tones = {
    solid: { background: 'var(--blue-500)', color: '#fff', border: 'none' },
    outline: { background: 'transparent', color: 'var(--blue-600)', border: '1px solid var(--blue-500)' },
    'brand-tint': { background: 'var(--surface-highlight)', color: 'var(--blue-600)', border: 'none' },
    success: { background: 'var(--success-bg)', color: 'var(--success)', border: 'none' },
    warning: { background: 'var(--warning-bg)', color: 'var(--warning)', border: 'none' },
    danger: { background: 'var(--danger-bg)', color: 'var(--danger)', border: 'none' },
    neutral: { background: 'var(--surface-subtle)', color: 'var(--gray-700)', border: 'none' },
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font)',
        fontSize: 'var(--fs-caption)',
        fontWeight: 'var(--fw-bold)',
        lineHeight: 1.4,
        padding: '3px 9px',
        borderRadius: 'var(--r-sm)',
        ...(tones[tone] || tones.neutral),
        ...style,
      }}
    >
      {children}
    </span>
  )
}
