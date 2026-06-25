import React from 'react'

/**
 * Rounded iOS device shell wrapping a screen.
 * @startingPoint section="Navigation" subtitle="iOS device shell with status bar" viewport="430x520"
 */
export interface PhoneFrameProps {
  children: React.ReactNode
  /** Render the 9:41 / 5G status bar. @default true */
  statusBar?: boolean
  /** @default 390 */
  width?: number
  /** @default 844 */
  height?: number
  style?: React.CSSProperties
}

/**
 * Rounded device shell (30px radius, float shadow) wrapping a single
 * screen, with the iOS status bar built in. Stack NavBar + scroll area
 * + TabBar inside it.
 */
export function PhoneFrame(props: PhoneFrameProps): JSX.Element
