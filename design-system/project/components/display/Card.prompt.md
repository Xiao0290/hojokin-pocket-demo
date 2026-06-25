The base surface: white, 14px radius, hairline border. Optional title/subtitle header, `highlight` variant for selected/active state.

```jsx
<Card tappable title="株式会社サンプル商会" subtitle="8件マッチ ・ 上限合計 ¥48,300,000" onClick={open} />
<Card variant="highlight" title="事業再構築補助金" subtitle="審査中 ・ 本日提出" />
```

- `highlight` = brand-tint background + blue border, for the current/selected item
- `tappable` adds press feedback (background darkens)
