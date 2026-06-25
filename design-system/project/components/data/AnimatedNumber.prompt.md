An inline number that counts up to its value on mount (and re-animates on change). Use it for **every** figure in the product so numbers tick into place.

```jsx
<AnimatedNumber value={8} suffix="件" />
<AnimatedNumber value={48300000} format="yen" />
<AnimatedNumber value={68} format="percent" />
<AnimatedNumber value={4.9} decimals={1} />
<AnimatedNumber value={21} prefix="+" suffix="pt" />
<AnimatedNumber value={48300000} format="yen" variant="slot" />
```

- `format`: `plain` · `comma` (thousands) · `yen` (¥ + commas) · `percent` (appends %)
- `decimals` for ratings; `prefix`/`suffix` for units (件 / 日 / pt)
- `variant="slot"` rolls slot-machine digit reels (left→right, odometer feel); `cycles` controls how many 0-9 spins first
- Uses tabular figures so width doesn't jitter; respects reduced-motion
