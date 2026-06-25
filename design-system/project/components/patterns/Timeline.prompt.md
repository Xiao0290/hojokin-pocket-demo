Vertical application-status timeline with done / active / todo states.

```jsx
<Timeline items={[
  { title: '補助金を診断', sub: '8件マッチ', state: 'done' },
  { title: '申請を提出', sub: '提出の準備ができました', state: 'active' },
  { title: '採択結果を待つ', state: 'todo' },
]} />
```

- `done` = filled blue tick + blue connector; `active` = blue ring; `todo` = grey ring + muted title
