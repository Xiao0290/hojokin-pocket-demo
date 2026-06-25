import React from 'react'

export interface AnimatedNumberProps {
  /** Target value to count up to. */
  value: number
  /** Output formatting. @default "plain" */
  format?: 'plain' | 'comma' | 'yen' | 'percent'
  /** Decimal places (e.g. 1 for a 4.9 rating). @default 0 */
  decimals?: number
  /** Animation length in ms. @default 1000 */
  duration?: number
  /** Starting value. @default 0 */
  from?: number
  /** Text prepended before the number. */
  prefix?: string
  /** Text appended after the number (e.g. 件, 日, pt). */
  suffix?: string
  /** "count" = smooth count-up; "slot" = slot-machine digit reels. @default "count" */
  variant?: 'count' | 'slot'
  /** Slot variant only: full 0-9 spins before settling. @default 2 */
  cycles?: number
  style?: React.CSSProperties
}

/**
 * Inline number that counts up to its value on mount and re-animates when
 * the value changes. The house style for every figure in 補助金ポケット —
 * counts, yen amounts, percentages and ratings all tick into place.
 * Honors prefers-reduced-motion (renders the final value).
 */
export function AnimatedNumber(props: AnimatedNumberProps): JSX.Element
