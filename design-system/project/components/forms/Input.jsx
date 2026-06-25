import React from 'react'

/**
 * Input — single-line text field with optional label.
 * Tall (58px) iOS-style field; focus moves border to brand blue.
 */
export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  disabled = false,
  style,
  ...rest
}) {
  const [focused, setFocused] = React.useState(false)
  const borderColor = error
    ? 'var(--danger)'
    : focused
    ? 'var(--blue-500)'
    : 'var(--line)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      {label && (
        <span style={{ fontSize: 'var(--fs-label)', color: 'var(--gray-500)', fontWeight: 'var(--fw-medium)' }}>
          {label}
        </span>
      )}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          minHeight: 'var(--touch-min)',
          height: 58,
          padding: '0 var(--sp-5)',
          border: `1.5px solid ${borderColor}`,
          borderRadius: 'var(--r-md)',
          fontFamily: 'var(--font)',
          fontSize: 'var(--fs-title)',
          color: disabled ? 'var(--gray-400)' : 'var(--ink)',
          background: disabled ? 'var(--surface-subtle)' : '#fff',
          outline: 'none',
          transition: 'border-color var(--dur) var(--ease)',
          ...style,
        }}
        {...rest}
      />
      {error && (
        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--danger)' }}>{error}</span>
      )}
    </div>
  )
}
