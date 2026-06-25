import React from 'react'

export interface ProgressBarProps {
  /** Completion 0–100. */
  value: number
  style?: React.CSSProperties
}

/** Thin determinate progress track with brand-blue fill (e.g. diagnosis progress). */
export function ProgressBar(props: ProgressBarProps): JSX.Element
