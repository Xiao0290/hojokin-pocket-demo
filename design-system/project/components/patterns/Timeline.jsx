import React from 'react'

/**
 * Timeline — vertical application-status timeline. Pass items as
 * [{ title, sub, state }] where state is 'done' | 'active' | 'todo'.
 */
export function Timeline({ items = [] }) {
  return (
    <div>
      {items.map((item, i) => {
        const last = i === items.length - 1
        const lineDone = item.state === 'done'
        const dotStyle =
          item.state === 'done'
            ? { background: 'var(--blue-500)' }
            : item.state === 'active'
            ? { background: '#fff', border: '3px solid var(--blue-500)' }
            : { background: '#fff', border: '2px solid var(--gray-300)' }
        const titleColor =
          item.state === 'active'
            ? 'var(--blue-500)'
            : item.state === 'todo'
            ? 'var(--gray-400)'
            : 'var(--ink)'
        return (
          <div key={i} style={{ display: 'flex', gap: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 24px' }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  flex: '0 0 22px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...dotStyle,
                }}
              >
                {item.state === 'done' && (
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {!last && (
                <span
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 18,
                    background: lineDone ? 'var(--blue-500)' : 'var(--line)',
                  }}
                />
              )}
            </div>
            <div style={{ paddingBottom: 'var(--sp-5)' }}>
              <div style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 'var(--fw-bold)', color: titleColor, lineHeight: 'var(--lh-tight)' }}>
                {item.title}
              </div>
              {item.sub && (
                <div style={{ fontSize: 'var(--fs-label)', color: 'var(--gray-500)', marginTop: 3 }}>{item.sub}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
