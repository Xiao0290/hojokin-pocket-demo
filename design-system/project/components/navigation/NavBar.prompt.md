Top bar (44px) with a centered title and optional blue left/right actions.

```jsx
<NavBar brand right="保存" onRight={save} />
<NavBar title="申請状況" left onLeft={back} />
```

- `brand` renders the 補助金ポケット wordmark (blue accent on ト)
- `left={true}` = bare back chevron; `left="結果"` = chevron + label
