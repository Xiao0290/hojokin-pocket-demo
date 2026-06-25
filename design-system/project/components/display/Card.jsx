import React from 'react'

/**
 * Card — base white surface with hairline border.
 * variant: default | highlight (brand tint + blue border).
 * tappable adds press feedback. Optional title/subtitle header.
 */
export function Card({
  children,
  title,
  subtitle,
  variant = 'default',
  tappable = false,
  onClick,
  style,
}) {
  const [pressed, setPressed] = React.useState(false)
  const isHl = variant === 'highlight'
  return (
    <div
      onClick={onClick}
      onMouseDown={() => tappable && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        background: isHl ? 'var(--surface-highlight)' : '#fff',
        border: isHl ? '1.5px solid var(--blue-500)' : '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        padding: 'var(--sp-4)',
        cursor: tappable ? 'pointer' : 'default',
        transition: 'background var(--dur-fast) var(--ease)',
        ...(pressed ? { background: isHl ? '#e7eefe' : 'var(--surface-subtle)' } : null),
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 'var(--fs-title)',
            fontWeight: 'var(--fw-bold)',
            color: 'var(--ink)',
            marginBottom: subtitle ? 4 : 0,
          }}
        >
          {title}
        </div>
      )}
      {subtitle && (
        <div
          style={{
            fontSize: 'var(--fs-label)',
            color: isHl ? 'var(--blue-600)' : 'var(--gray-500)',
            fontWeight: isHl ? 'var(--fw-medium)' : 'var(--fw-regular)',
          }}
        >
          {subtitle}
        </div>
      )}
      {children}
    </div>
  )
}
