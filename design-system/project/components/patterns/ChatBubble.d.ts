import React from 'react'

export interface ChatBubbleProps {
  children: React.ReactNode
  /** Sender side. @default "them" */
  from?: 'me' | 'them'
  /** "system" renders a centered grey note instead of a bubble. */
  variant?: 'system'
}

/**
 * Single chat message bubble for the expert messaging screen. 'me' is
 * brand blue aligned right, 'them' is grey aligned left.
 */
export function ChatBubble(props: ChatBubbleProps): JSX.Element
