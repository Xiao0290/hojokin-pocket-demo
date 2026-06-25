import React from 'react'

/**
 * Base white surface for cards and content blocks.
 * @startingPoint section="Display" subtitle="Surface card with title / subtitle" viewport="360x180"
 */
export interface CardProps {
  children?: React.ReactNode
  /** Optional bold title line. */
  title?: string
  /** Optional secondary line under the title. */
  subtitle?: string
  /** "highlight" = brand tint background + blue border. @default "default" */
  variant?: 'default' | 'highlight'
  /** Adds press feedback + pointer cursor. @default false */
  tappable?: boolean
  onClick?: (e: React.MouseEvent) => void
  style?: React.CSSProperties
}

/**
 * Base white surface (14px radius, hairline border) for recent-diagnosis
 * cards, "applying" cards and generic content blocks.
 */
export function Card(props: CardProps): JSX.Element
