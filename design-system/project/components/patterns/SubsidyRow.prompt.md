Tappable list row for a subsidy search result — name, frame label, inline stats, trailing chevron, bottom hairline. Stack them directly.

```jsx
<SubsidyRow
  name="事業再構築補助金"
  frame="成長枠"
  meta={[{ label: '上限', value: '¥30,000,000' }, { label: '採択率', value: '68%' }, { label: '残', value: '62日' }]}
  onClick={open}
/>
```

- Press feedback dims the row to 0.6 opacity
- `meta` values render bold ink over a grey label
