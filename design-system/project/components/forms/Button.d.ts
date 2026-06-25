import React from 'react'

/**
 * Primary call-to-action button for 補助金ポケット.
 * @startingPoint section="Forms" subtitle="Primary / secondary / ghost button" viewport="360x320"
 */
export interface ButtonProps {
  children: React.ReactNode
  /** Visual style. @default "primary" */
  variant?: 'primary' | 'secondary' | 'ghost'
  /** Height preset. @default "md" */
  size?: 'sm' | 'md' | 'lg'
  /** Stretch to container width. @default true */
  fullWidth?: boolean
  /** Show inline spinner and block interaction. @default false */
  loading?: boolean
  disabled?: boolean
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  style?: React.CSSProperties
}

/**
 * Primary call-to-action button for 補助金ポケット. Filled blue for the main
 * action on a screen, secondary/ghost for supporting actions.
 */
export function Button(props: ButtonProps): JSX.Element
