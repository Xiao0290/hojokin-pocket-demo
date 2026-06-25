import React from 'react'

/**
 * ChatBubble — a single message bubble. from='me' (brand blue, right)
 * or 'them' (grey, left). Use a centered system note via variant='system'.
 */
export function ChatBubble({ children, from = 'them', variant }) {
  if (variant === 'system') {
    return (
      <div style={{ textAlign: 'center', fontSize: 'var(--fs-label)', color: 'var(--gray-500)', margin: '0 0 14px' }}>
        {children}
      </div>
    )
  }
  const isMe = from === 'me'
  return (
    <div style={{ display: 'flex', marginBottom: 10 }}>
      <div
        style={{
          maxWidth: '78%',
          padding: '13px 16px',
          borderRadius: 18,
          fontSize: 'var(--fs-body)',
          lineHeight: 'var(--lh-snug)',
          marginLeft: isMe ? 'auto' : 0,
          background: isMe ? 'var(--blue-500)' : 'var(--surface-subtle)',
          color: isMe ? '#fff' : 'var(--ink)',
          borderBottomRightRadius: isMe ? 5 : 18,
          borderBottomLeftRadius: isMe ? 18 : 5,
        }}
      >
        {children}
      </div>
    </div>
  )
}
