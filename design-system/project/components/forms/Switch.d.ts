import React from 'react'

export interface SwitchProps {
  checked?: boolean
  onChange?: (next: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  id?: string
  name?: string
  style?: React.CSSProperties
}

/**
 * Accessible binary setting control with role="switch".
 * Use for saved notification or preference settings.
 */
export function Switch(props: SwitchProps): JSX.Element
