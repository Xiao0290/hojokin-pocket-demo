import React from 'react'

/**
 * Button — 補助金ポケット primary action control.
 * Variants: primary (filled blue), secondary (tinted), ghost (outline).
 * Sizes: sm (40), md (52), lg (56). Full-width by default.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  loading = false,
  disabled = false,
  onClick,
  style,
  ...rest
}) {
  const heights = { sm: 40, md: 52, lg: 56 }
  const fontSizes = { sm: 'var(--fs-body)', md: 'var(--fs-body-lg)', lg: 'var(--fs-body-lg)' }

  const palettes = {
    primary: { background: 'var(--blue-500)', color: '#fff', border: 'none' },
    secondary: { background: 'var(--surface-highlight)', color: 'var(--blue-600)', border: 'none' },
    ghost: { background: '#fff', color: 'var(--ink)', border: '1px solid var(--line)' },
  }
  const isDisabled = disabled || loading
  const pal = palettes[variant] || palettes.primary

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--sp-2)',
    width: fullWidth ? '100%' : 'auto',
    minHeight: 'var(--touch-min)',
    height: heights[size],
    padding: '0 var(--sp-5)',
    borderRadius: 'var(--r-md)',
    fontFamily: 'var(--font)',
    fontSize: fontSizes[size],
    fontWeight: variant === 'ghost' ? 'var(--fw-medium)' : 'var(--fw-bold)',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: 'transform var(--dur-fast) var(--ease), background var(--dur) var(--ease)',
    position: 'relative',
    ...pal,
    ...(isDisabled
      ? variant === 'ghost'
        ? { background: '#fff', color: 'var(--gray-400)', borderColor: 'var(--line-soft)' }
        : { background: 'var(--gray-300)', color: '#fff', border: 'none' }
      : null),
    ...style,
  }

  return (
    <button
      type="button"
      style={base}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onClick={isDisabled ? undefined : onClick}
      onMouseDown={(e) => !isDisabled && (e.currentTarget.style.transform = 'scale(0.985)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: '2.5px solid rgba(255,255,255,.45)',
            borderTopColor: '#fff',
            animation: 'hp-spin .8s linear infinite',
          }}
        />
      )}
      <span style={{ visibility: loading ? 'hidden' : 'visible', display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
        {children}
      </span>
      <style>{'@keyframes hp-spin{to{transform:rotate(360deg)}}'}</style>
    </button>
  )
}
