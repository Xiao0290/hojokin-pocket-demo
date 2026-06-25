import React from 'react'

export interface EmptyStateProps {
  /** Main message (e.g. メッセージはありません). */
  title: string
  /** Optional muted hint below. */
  hint?: string
  style?: React.CSSProperties
}

/** Centered placeholder for empty tabs and lists. */
export function EmptyState(props: EmptyStateProps): JSX.Element
