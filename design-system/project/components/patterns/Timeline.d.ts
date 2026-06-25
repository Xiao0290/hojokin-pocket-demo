export interface TimelineItem {
  title: string
  /** Optional secondary line. */
  sub?: string
  /** Step status. */
  state: 'done' | 'active' | 'todo'
}

export interface TimelineProps {
  items: TimelineItem[]
}

/**
 * Vertical status timeline for the application journey. Done steps show
 * a filled blue tick, the active step a blue ring, todo steps a grey ring.
 */
export function Timeline(props: TimelineProps): JSX.Element
