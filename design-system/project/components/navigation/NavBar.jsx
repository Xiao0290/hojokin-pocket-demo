import React from 'react'

/**
 * NavBar — iOS-style centered title bar with optional back/left and
 * right actions. brand=true shows the 補助金ポケット wordmark with a
 * blue accent on the final character.
 */
export function NavBar({ title, left, right, onLeft, onRight, brand = false, noBorder = false }) {
  return (
    <div
      style={{
        height: 44,
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        borderBottom: noBorder ? 'none' : '1px solid var(--line-soft)',
        padding: '0 var(--sp-3)',
        background: '#fff',
      }}
    >
      {left && (
        <span
          onClick={onLeft}
          style={{
            position: 'absolute',
            left: 14,
            fontSize: 'var(--fs-body)',
            color: 'var(--blue-500)',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <span style={{ fontSize: 19, marginRight: 1, lineHeight: 1 }}>‹</span>
          {left !== true && left}
        </span>
      )}
      {brand ? (
        <span style={{ fontSize: 16, fontWeight: 'var(--fw-bold)', color: 'var(--ink)' }}>
          補助金ポケッ<span style={{ color: 'var(--blue-500)' }}>ト</span>
        </span>
      ) : (
        <span style={{ fontSize: 16, fontWeight: 'var(--fw-bold)', color: 'var(--ink)' }}>{title}</span>
      )}
      {right && (
        <span
          onClick={onRight}
          style={{
            position: 'absolute',
            right: 16,
            fontSize: 'var(--fs-body)',
            color: 'var(--blue-500)',
            fontWeight: 'var(--fw-medium)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {right}
        </span>
      )}
    </div>
  )
}
