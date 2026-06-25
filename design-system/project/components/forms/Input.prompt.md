A tall (58px) single-line text field with an optional label; border turns brand blue on focus, red when `error` is set.

```jsx
<Input label="会社のURL" placeholder="https://会社のURL" value={url} onChange={e => setUrl(e.target.value)} />
```

- Pass `error` to show a red border plus a caption message
- `disabled` greys the fill to `surface-subtle`
