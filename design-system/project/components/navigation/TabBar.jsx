import React from 'react'

const ICONS = {
  diag: (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  apply: (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  msg: (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path d="M4 5h16v11H9l-4 4V5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  mypage: (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
}

const DEFAULT_TABS = [
  { id: 'diag', label: '診断' },
  { id: 'apply', label: '申請' },
  { id: 'msg', label: 'メッセージ' },
  { id: 'mypage', label: 'マイページ' },
]

/**
 * TabBar — bottom navigation with the four app sections.
 * Active tab turns brand blue. Built-in line icons (diag/apply/msg/mypage).
 */
export function TabBar({ active = 'diag', onChange, tabs = DEFAULT_TABS }) {
  return (
    <div
      style={{
        height: 52,
        flex: '0 0 auto',
        display: 'flex',
        borderTop: '1px solid var(--line-soft)',
        background: '#fff',
      }}
    >
      {tabs.map((t) => {
        const isActive = active === t.id
        return (
          <div
            key={t.id}
            onClick={() => onChange && onChange(t.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              fontSize: 'var(--fs-caption)',
              color: isActive ? 'var(--blue-500)' : 'var(--gray-500)',
              fontWeight: isActive ? 'var(--fw-medium)' : 'var(--fw-regular)',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {ICONS[t.id]}
            <span>{t.label}</span>
          </div>
        )
      })}
    </div>
  )
}
