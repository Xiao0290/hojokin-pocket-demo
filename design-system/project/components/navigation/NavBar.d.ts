import React from 'react'

export interface NavBarProps {
  /** Center title (ignored when brand=true). */
  title?: string
  /** Left action: `true` for a bare back chevron, or a label string next to it. */
  left?: boolean | string
  /** Right action label. */
  right?: string
  onLeft?: () => void
  onRight?: () => void
  /** Show the 補助金ポケット wordmark instead of a title. @default false */
  brand?: boolean
  /** Drop the bottom hairline. @default false */
  noBorder?: boolean
}

/**
 * Top navigation bar (44px) with centered title and optional
 * left/right tap actions. iOS conventions: blue actions, chevron back.
 */
export function NavBar(props: NavBarProps): JSX.Element
