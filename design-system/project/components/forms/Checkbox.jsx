import React from 'react'

/**
 * Checkbox — square brand-blue check used in application checklists.
 * Renders a 24px box; checked state fills blue with a white tick.
 */
export function Checkbox({ checked = false, onChange, label, aiTag, disabled = false }) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      onClick={disabled ? undefined : () => onChange && onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-4) 0',
        borderBottom: '1px solid var(--line-soft)',
        cursor: disabled ? 'default' : 'pointer',
        minHeight: 'var(--touch-min)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          flex: '0 0 24px',
          border: checked ? '2px solid var(--blue-500)' : '2px solid var(--gray-300)',
          background: checked ? 'var(--blue-500)' : 'transparent',
          borderRadius: 7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all var(--dur-fast) var(--ease)',
        }}
      >
        {checked && (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label && (
        <span style={{ fontSize: 'var(--fs-body-lg)', color: 'var(--ink)', fontWeight: 'var(--fw-medium)' }}>
          {label}
        </span>
      )}
      {aiTag && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--blue-500)',
            border: '1px solid var(--blue-500)',
            borderRadius: 5,
            padding: '2px 6px',
            fontWeight: 'var(--fw-medium)',
            marginLeft: 'var(--sp-2)',
          }}
        >
          AI下書き
        </span>
      )}
    </div>
  )
}
