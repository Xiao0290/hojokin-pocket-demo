Rounded iOS device shell with a built-in status bar; wrap a full screen in it.

```jsx
<PhoneFrame>
  <NavBar brand />
  <div style={{ flex: 1, overflowY: 'auto' }}>…screen…</div>
  <TabBar active="diag" onChange={setTab} />
</PhoneFrame>
```

- The frame is a flex column — give your scroll area `flex:1; overflow-y:auto`
- Set `statusBar={false}` to embed inside another chrome
