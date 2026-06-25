import React from 'react'

function StatusBar() {
  return (
    <div
      style={{
        height: 30,
        flex: '0 0 30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 22px',
        fontSize: 13,
        fontWeight: 600,
        color: '#000',
        letterSpacing: '.2px',
      }}
    >
      <span>9:41</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 }}>
        <span>5G</span>
        <span
          style={{
            width: 22,
            height: 11,
            border: '1px solid #000',
            borderRadius: 3,
            position: 'relative',
            padding: 1,
          }}
        >
          <span style={{ display: 'block', height: '100%', width: '80%', background: '#000', borderRadius: 1 }} />
        </span>
      </span>
    </div>
  )
}

/**
 * PhoneFrame — rounded device shell that wraps a screen. Includes the
 * status bar. Children are the screen content (NavBar, scroll area, TabBar).
 */
export function PhoneFrame({ children, statusBar = true, width = 390, height = 844, style }) {
  return (
    <div
      style={{
        width,
        height,
        background: '#fff',
        borderRadius: 30,
        boxShadow: '0 24px 60px rgba(20,30,60,.28), 0 2px 0 rgba(255,255,255,.4) inset',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid rgba(0,0,0,.06)',
        ...style,
      }}
    >
      {statusBar && <StatusBar />}
      {children}
    </div>
  )
}
