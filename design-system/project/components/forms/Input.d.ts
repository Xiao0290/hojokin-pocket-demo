import React from 'react'

export interface InputProps {
  /** Optional label rendered above the field. */
  label?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  type?: string
  /** Error message; turns the border red and shows the text below. */
  error?: string
  disabled?: boolean
  style?: React.CSSProperties
}

/**
 * Tall single-line text field. The primary input on the diagnose home
 * screen (company URL). Border animates to brand blue on focus.
 */
export function Input(props: InputProps): JSX.Element
