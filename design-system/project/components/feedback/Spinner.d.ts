import React from 'react'

export interface SpinnerProps {
  /** Diameter in px. @default 56 */
  size?: number
  /** Ring thickness in px. @default 5 */
  stroke?: number
  style?: React.CSSProperties
}

/** Brand-blue ring spinner for indeterminate loading. */
export function Spinner(props: SpinnerProps): JSX.Element
