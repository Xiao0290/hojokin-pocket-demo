import React from 'react'

/**
 * StatCard — horizontal row of labelled stats divided by hairlines.
 * Used for 補助上限 / 補助率 / 締切 on the subsidy detail screen.
 * Pass items as [{ k: label, v: value }].
 */
export function StatCard({ items = [], style }) {
  return (
    <div
      style={{
        display: 'flex',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            padding: 'var(--sp-3) var(--sp-4)',
            borderRight: i < items.length - 1 ? '1px solid var(--line-soft)' : 'none',
          }}
        >
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--gray-500)', marginBottom: 6 }}>
            {it.k}
          </div>
          <div style={{ fontSize: 18, fontWeight: 'var(--fw-heavy)', color: 'var(--ink)' }}>
            {it.v}
          </div>
        </div>
      ))}
    </div>
  )
}
