---
name: hojokin-pocket-design
description: Use this skill to generate well-branded interfaces and assets for 補助金ポケット (Hojokin Pocket), the AI subsidy diagnosis & application app for Japanese SMBs — either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and a React UI-kit of components for prototyping.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation

- **Brand:** one confident blue (`#1a56f0`) on generous white, large Japanese type, hairline dividers, iOS-native, calm and trustworthy. No gradients, no emoji, no imagery.
- **Tokens:** `styles.css` is the single entry point (link it). It imports `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`, `tokens/fonts.css`. Use the CSS custom properties (`--blue-500`, `--ink`, `--fs-title`, `--sp-4`, `--r-lg`, …) — never hard-code values.
- **Type:** system-first Japanese sans with Noto Sans JP webfont fallback. Headings/numerals 800 heavy; body 400–500. Numbers are the headline.
- **Components:** React, bundled to `window.DesignSystem_a96fc8`. Forms (Button, Input, Checkbox), display (Badge, Card, StatCard), data (AnimatedNumber), feedback (Spinner, ProgressBar, EmptyState), navigation (NavBar, TabBar, PhoneFrame), patterns (SubsidyRow, Timeline, ChatBubble). Each has a `.prompt.md` with usage.
- **Numbers always animate.** Wrap every meaningful figure (counts, ¥ amounts, %, ratings, days-left) in `AnimatedNumber` so it counts up into place. Streaming text (e.g. the AI business plan) reveals character-by-character. IDs, dates and ratios stay static.
- **UI kit:** `ui_kits/hojokin-pocket/index.html` is the full interactive 12-screen flow — the reference for how screens are assembled.

## Using the components in an HTML artifact

```html
<link rel="stylesheet" href="styles.css">
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>
<script src="_ds_bundle.js"></script>
<script type="text/babel">
  const { Button, Card, PhoneFrame, NavBar, TabBar } = window.DesignSystem_a96fc8
  // …mount your screen
</script>
```

## Copy/tone rules

- Japanese, です・ます polite-plain. Short declarative sentences.
- Action labels are verbs: 「補助金を診断する」「専門家に依頼する」.
- Lead with numbers (counts, ¥ limits, % adoption, 残N日). Currency `¥` + thousands separators; percentages bare.
- Keep Latin tokens cased correctly: `jGrants`, `gBizID`, `AI`, `URL`.
- Never use emoji. Status/category is carried by weight, color, and the SVG check glyph.
- Compliance framing matters: **AI drafts, the licensed 専門家 writes & submits, the platform matches.** Don't imply the app itself files or guarantees outcomes.
