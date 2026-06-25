import React from 'react'

export interface StatItem {
  /** Caption label (e.g. 補助上限). */
  k: string
  /** Bold value (e.g. ¥30,000,000). */
  v: React.ReactNode
}

export interface StatCardProps {
  items: StatItem[]
  style?: React.CSSProperties
}

/**
 * Horizontal stat strip: 2–4 labelled values divided by hairlines.
 * Used for subsidy headline figures (limit / rate / deadline).
 */
export function StatCard(props: StatCardProps): JSX.Element
