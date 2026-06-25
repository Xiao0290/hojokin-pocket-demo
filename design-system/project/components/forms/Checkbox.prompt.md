A full-width checklist row: 24px square checkbox + label, with a hairline divider below. Checked fills brand blue with a white tick.

```jsx
<Checkbox label="事業計画書を作成する" aiTag checked={done} onChange={setDone} />
```

- `aiTag` appends the small blue "AI下書き" outline tag for AI-assisted steps
- Designed to stack directly — each row owns its bottom border
