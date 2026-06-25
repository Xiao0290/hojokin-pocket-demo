import React from 'react'

export interface CheckboxProps {
  checked?: boolean
  onChange?: (next: boolean) => void
  /** Row label shown to the right of the box. */
  label?: string
  /** Show the small "AI下書き" outline tag. */
  aiTag?: boolean
  disabled?: boolean
}

/**
 * Checklist row with a 24px square checkbox. Used for application
 * steps and submission document lists; checked fills brand blue.
 */
export function Checkbox(props: CheckboxProps): JSX.Element
