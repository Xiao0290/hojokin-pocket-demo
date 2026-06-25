import React from 'react'

export interface SubsidyMeta {
  /** Stat label, e.g. 上限 / 採択率. */
  label: string
  /** Stat value, rendered bold. */
  value: React.ReactNode
}

/**
 * Tappable result row for the subsidy diagnosis list.
 * @startingPoint section="Patterns" subtitle="Subsidy result list row" viewport="360x140"
 */
export interface SubsidyRowProps {
  /** Subsidy name (e.g. 事業再構築補助金). */
  name: string
  /** Funding frame / category line. */
  frame?: string
  /** Inline stats shown under the name. */
  meta?: SubsidyMeta[]
  onClick?: () => void
}

/**
 * Tappable result row for the subsidy diagnosis list: name, frame label,
 * an inline stat line and a trailing chevron.
 */
export function SubsidyRow(props: SubsidyRowProps): JSX.Element
