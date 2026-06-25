export interface TabItem {
  /** One of the built-in icon ids: diag | apply | msg | mypage. */
  id: string
  label: string
}

export interface TabBarProps {
  /** Active tab id. @default "diag" */
  active?: string
  onChange?: (id: string) => void
  /** Override the default four sections. */
  tabs?: TabItem[]
}

/**
 * Bottom tab bar with the four 補助金ポケット sections
 * (診断 / 申請 / メッセージ / マイページ). Active tab turns brand blue.
 */
export function TabBar(props: TabBarProps): JSX.Element
