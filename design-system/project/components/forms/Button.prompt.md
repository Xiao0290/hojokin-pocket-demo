One filled call-to-action button; use `primary` for the single main action per screen, `secondary`/`ghost` for supporting choices.

```jsx
<Button variant="primary" onClick={diagnose}>補助金を診断する</Button>
<Button variant="ghost">自分でこのまま申請する</Button>
```

- `variant`: `primary` (filled blue) · `secondary` (blue tint) · `ghost` (white + hairline)
- `size`: `sm` 40 · `md` 52 · `lg` 56 — all respect the 44px minimum tap target
- `loading` swaps the label for a spinner; `fullWidth` (default) fills the footer
