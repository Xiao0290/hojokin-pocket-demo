import React from 'react'

/**
 * Switch - accessible binary setting control for notification preferences.
 * Use for saved settings; use Checkbox for checklist completion.
 */
export function Switch({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  id,
  name,
  style,
  ...rest
}) {
  const switchId = id || name
  const descriptionId = description && switchId ? `${switchId}-hint` : undefined
  const toggle = () => {
    if (!disabled && onChange) onChange(!checked)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--sp-4)',
        minHeight: 'var(--touch-min)',
        padding: 'var(--sp-4) 0',
        borderBottom: '1px solid var(--line-soft)',
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      {(label || description) && (
        <div style={{ minWidth: 0 }}>
          {label && (
            <label
              htmlFor={switchId}
              style={{
                display: 'block',
                fontSize: 'var(--fs-body)',
                fontWeight: 'var(--fw-medium)',
                color: 'var(--ink)',
                lineHeight: 1.45,
              }}
            >
              {label}
            </label>
          )}
          {description && (
            <span
              id={descriptionId}
              style={{
                display: 'block',
                marginTop: 2,
                fontSize: 'var(--fs-caption)',
                color: 'var(--gray-500)',
                lineHeight: 1.45,
              }}
            >
              {description}
            </span>
          )}
        </div>
      )}
      <button
        id={switchId}
        name={name}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={descriptionId}
        aria-label={!label ? name || '設定を切り替える' : undefined}
        disabled={disabled}
        onClick={toggle}
        style={{
          position: 'relative',
          flex: '0 0 auto',
          width: 52,
          height: 32,
          border: checked ? '1px solid var(--blue-500)' : '1px solid var(--line)',
          borderRadius: 16,
          background: checked ? 'var(--blue-500)' : 'var(--gray-100)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background var(--dur) var(--ease), border var(--dur) var(--ease), transform var(--dur-fast) var(--ease)',
        }}
        onMouseDown={(event) => !disabled && (event.currentTarget.style.transform = 'scale(0.985)')}
        onMouseUp={(event) => (event.currentTarget.style.transform = 'scale(1)')}
        onMouseLeave={(event) => (event.currentTarget.style.transform = 'scale(1)')}
        {...rest}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 23 : 3,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: 'var(--shadow-sm)',
            transition: 'left var(--dur) var(--ease)',
          }}
        />
      </button>
    </div>
  )
}
