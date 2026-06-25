# Switch

Use `Switch` for binary saved settings such as push, email, and deadline reminders.
Use `Checkbox` for task completion or document checklists.

## Usage

```jsx
<Switch
  name="deadline"
  label="締切リマインド"
  description="候補制度の締切前に通知します"
  checked={settings.deadline}
  onChange={(value) => saveSettings({ ...settings, deadline: value })}
/>
```

## Rules

- Keep labels short.
- Do not put `オン` / `オフ` text inside the control.
- Always bind `checked` to saved state.
- Let the switch expose `role="switch"` and `aria-checked`; do not wrap it in another interactive element.
