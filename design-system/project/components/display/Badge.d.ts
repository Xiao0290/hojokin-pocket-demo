import React from 'react'

export interface BadgeProps {
  children: React.ReactNode
  /** Color tone. @default "neutral" */
  tone?: 'solid' | 'outline' | 'brand-tint' | 'success' | 'warning' | 'danger' | 'neutral'
  style?: React.CSSProperties
}

/**
 * Small pill for status, recommendation and category labels
 * ("AIのおすすめ", adoption-rate chips, semantic states).
 */
export function Badge(props: BadgeProps): JSX.Element
