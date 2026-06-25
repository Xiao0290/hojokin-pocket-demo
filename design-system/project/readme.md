# 補助金ポケット — Design System

A design system for **補助金ポケット (Hojokin Pocket)** — an AI-powered *subsidy
diagnosis & application* mobile app for Japanese small and mid-sized businesses.
A founder enters their company URL, AI matches them against thousands of national
and local grant programs, drafts a business plan, connects them to a licensed
専門家 (gyōseishoshi / administrative scrivener), and walks the application all the
way to jGrants submission.

The visual language is **calm, trustworthy, iOS-native**: a single confident blue
on generous white, large legible Japanese type, hairline dividers, and gentle
motion. Nothing flashy — this is a product about money and government paperwork,
so it reads as precise and reassuring.

> **Positioning** (from the research brief): externally a "資金調達 (financing)
> app"; internally a 行政書士 marketplace + adoption-rate data platform. The
> three-role compliance model shapes the copy throughout — **AI drafts, the
> licensed expert writes & submits, the platform matches.**

---

## Sources

This system was derived from the attached codebase (read-only):

- **`補助金/hojokin-pocket/`** — Vite + React 18 clickable demo of the full
  12-screen flow. Faithfully reproduces the product video `イメージ.mov`.
  - `src/screens/*.jsx` — the 12 screens (home, diagnose, detail, business plan,
    method, expert, confirm, chat, status, submit, complete)
  - `src/components/ui.jsx` — StatusBar, NavBar, TabBar, Check icon
  - legacy app demo data content — now removed from active app runtime
  - `src/styles.css` — the original class-based stylesheet
  - `design-system/` — a pre-existing token/component foundation
    (`tokens.css`, `components.css`, `cards/*.html`) that this system formalizes
  - `docs/` — `リサーチブリーフ.md` (research brief), `MVP_技術仕様.md`,
    `補助金ポケット_Phase1_Codex開発要件定義.md`, `architecture.png/svg`
  - `イメージ.mov` — the source product walkthrough video

No Figma file or hosted brand kit was provided. There are no raster logo or
illustration assets in the codebase — the brand mark is a **text wordmark** and
all icons are **inline SVG** (see ICONOGRAPHY).

---

## CONTENT FUNDAMENTALS

**Language.** Japanese throughout. Polite but plain — desu/masu (です・ます) form,
never casual, never stiff-formal keigo. Short declarative sentences.

**Voice — quietly capable, reassuring.** The app does the heavy lifting and says
so plainly: 「会社のURLを入力すると、申請できる補助金をAIが診断します。」
Risk-reducing promises are stated flatly, not hyped:
「採択された場合のみのお支払いです。不採択なら費用はかかりません。」

**Person.** Addresses the user implicitly (no aggressive "あなた"). Action labels
are verbs in dictionary/polite-imperative form: 「補助金を診断する」「申請書をAIで作成する」
「専門家に依頼する」「jGrantsに提出する」. The platform refers to itself by feature
("AI", "専門家"), not "we/私たち".

**Numbers are the headline.** Counts, limits, adoption rates and deadlines carry
the message and get the largest, heaviest type: **8件**, **¥48,300,000**, **68% → 89%**,
**+21pt**, **残62日**. Currency is always `¥` + thousands-separated
(`¥30,000,000`). Percentages are bare (`68%`). Dates are compact (`8/29`, `随時`).
**Every meaningful figure animates** — it counts up from 0 to its value on entry
(see the `AnimatedNumber` component and the Motion notes). IDs, dates and ratios
(`受付番号`, `8/29`, `1/2`) are static.

**Casing & punctuation.** Japanese needs no casing. Latin tokens keep their own
case: `jGrants`, `gBizID`, `AI`, `URL`. The interpunct `・` separates inline meta
(「8件マッチ ・ 上限合計 ¥48,300,000 ・ たった今」). Em-spaces/full-width spaces are
used sparingly between stat pairs.

**Tone tags.** A handful of small framing labels do a lot of work:
「AIのおすすめ」 (recommendation), 「AI下書き」 (this step can be AI-drafted),
「審査中」「提出の準備ができました」 (status). These are short, factual, never salesy.

**No emoji.** None anywhere in the product. Status and category are carried by
type weight, color, and the SVG check/timeline marks — not by pictographs.

**Vibe:** competent fintech-meets-govtech. Think a Japanese neobank or tax app —
trustworthy, low-friction, numbers-forward, never playful.

---

## VISUAL FOUNDATIONS

**Color.** One brand hue — **blue `#1a56f0` (`--blue-500`)** — does almost all the
work: primary buttons, links, active tabs, selected borders, timeline progress,
the success circle, the brand accent on the final character of the wordmark.
A 7-step ramp (50→700) supplies tints (`--blue-50 #eef3ff` for highlighted card
backgrounds) and the pressed state (`--blue-600 #1546c8`). Neutrals are a near-true
gray ladder from `--ink #1a1a1a` to hairlines `--line #e6e6ea` / `--line-soft #efeff2`,
on white surfaces with an `#f7f8fa` subtle wash. Semantic colors
(success `#15a673`, warning `#e0900f`, danger `#e5484d`) appear rarely, always as a
saturated foreground over a pale tinted background. **No gradients anywhere** —
flat fills only.

**Type.** System-first Japanese sans: `-apple-system / Hiragino Sans` on Apple,
**Noto Sans JP** loaded as the cross-platform webfont fallback. An 8-step scale:
display 40 / h1 26 / h2 22 / title 19 / body-lg 17 / body 15 / label 13 / caption 12.
Weights 400 / 500 / 700 / 800 — headings and numerals go **800 heavy** with a
slight `-1px` tracking; body stays 400–500. Hierarchy is built from **size + weight**,
not color or decoration.

**Spacing & layout.** 4px base grid (`--sp-1`=4 … `--sp-10`=40). Screen padding is
18px. The canvas is a single fixed phone frame (390×844) centered on a `#d9dce3`
backdrop. Content is **top-aligned with breathing room**, primary action pinned to
a white footer at the bottom. Generous vertical rhythm; lists separated by full-width
hairlines rather than boxed cards.

**Backgrounds.** Plain white surfaces. No imagery, no patterns, no textures, no
full-bleed photography, no gradients. The only "decoration" is the device shadow and
the pale blue tint on selected/active cards.

**Corner radii.** Soft but not pill-y: inputs/buttons 12 (`--r-md`), cards 14
(`--r-lg`), small chips/badges 8 (`--r-sm`), the phone shell 30, avatars & status
dots fully round. Chat bubbles are 18 with one notched corner (5) toward the sender.

**Cards.** White, 14px radius, 1px `--line` border, **mostly shadowless** — elevation
comes from the border, not a drop shadow. The selected/active variant swaps to a
1.5px blue border + `--blue-50` fill. The only heavy shadow in the system is the
floating phone frame (`--shadow-float`).

**Borders & dividers.** 1px hairlines everywhere; 1.5px when an input/card is in a
selected or focused state. List rows and checklist items own a single bottom
`--line-soft` divider so they stack seamlessly.

**Shadows.** Three levels — `--shadow-sm` (barely there), `--shadow-card` (resting
card, used sparingly), `--shadow-float` (the device). No colored or inner shadows.

**Motion.** Quick and physical. Standard `--dur 200ms` with
`--ease cubic-bezier(.2,.7,.3,1)`. Screens **fade + rise 4px** on enter (`.22s`).
Buttons **scale to .985** on press. **Numbers count up** from 0 to their value on
entry (~1s, easeOutCubic) via `AnimatedNumber` — the signature data motion, used
for every count, yen amount, percentage and rating. The same component also offers
a **slot-machine variant** (`variant="slot"`) whose digit reels roll and settle
left→right like an odometer — used for the biggest hero figures (the diagnosis
result count/total, the 採択率 method cards). Specific moments get bespoke
animation: the diagnose spinner (`.85s` linear), the AI business-plan **typewriter
caret** (blinking `step-end`) with a live streaming character counter, a pulsing
"live" dot while AI writes, and the completion check that **pops in** with a
`cubic-bezier(.2,1.4,.5,1)` overshoot. No infinite decorative loops.

**Hover / press states.** This is a touch product, so **press** is the primary
feedback: buttons darken to `--blue-600` and scale down; tappable cards/rows shift to
`#fafbff` or drop to 0.6 opacity. There are no hover-only affordances.

**Transparency & blur.** Essentially none — the system is opaque and flat. The only
translucency is a subtle inset white highlight on the device shell.

**Imagery vibe.** N/A — the product ships no photography or illustration. If imagery
is ever added, keep it cool, clean, and minimal to match.

---

## ICONOGRAPHY

- **Inline SVG line icons**, hand-drawn in the codebase — there is no icon font, no
  sprite sheet, and no PNG icon set. Icons use `stroke="currentColor"`,
  `stroke-width="2"`, round caps/joins, on a 24×24 viewBox, rendered ~20px.
- The **tab bar** ships four custom line icons: 診断 (magnifier), 申請 (document),
  メッセージ (speech bubble), マイページ (person). They inherit color from the tab
  (gray `--gray-500`, blue `--blue-500` when active). These live in
  `components/navigation/TabBar.jsx`.
- The **check mark** (`M5 12.5l4.5 4.5L19 7`, stroke 2.6, round) is the system's
  signature glyph: checklist boxes, completed timeline dots, the jGrants document
  list, and the success circle all use it. It's exported via `Checkbox`, `Timeline`,
  and the kit's `Submit`/`Complete` screens.
- **Chevrons** are plain unicode characters, not SVG: `‹` for back (in `NavBar`),
  `›` for list-row disclosure (in `SubsidyRow`), both in `--gray-300`/`--blue-500`.
- **No emoji, no decorative unicode** beyond the interpunct `・` used as a text
  separator.
- **Substitution guidance:** if a consumer needs icons this system doesn't ship
  (settings gears, bells, etc.), match the existing language — **1.5–2px stroke,
  round caps, 24px grid, outline (not filled), single-color** — e.g. Lucide or
  Phosphor (regular weight) blend in cleanly. Avoid filled/duotone icon sets.

---

## Index — what's in this system

**Foundations (root)**
- `styles.css` — the single entry point consumers link (imports only)
- `tokens/colors.css` · `tokens/typography.css` · `tokens/spacing.css` · `tokens/fonts.css`
- `guidelines/*.html` — foundation specimen cards (Colors ×3, Type ×2, Spacing ×2)

**Components** (`components/<group>/` — React, namespace `window.DesignSystem_a96fc8`)
- `forms/` — **Button**, **Input**, **Checkbox**
- `display/` — **Badge**, **Card**, **StatCard**
- `data/` — **AnimatedNumber** (count-up figures — use for every number)
- `feedback/` — **Spinner**, **ProgressBar**, **EmptyState**
- `navigation/` — **NavBar**, **TabBar**, **PhoneFrame**
- `patterns/` — **SubsidyRow**, **Timeline**, **ChatBubble**

Each component directory has `<Name>.jsx`, `<Name>.d.ts` (props + adherence),
`<Name>.prompt.md` (usage), and one `*.card.html` showcase.

**UI kit** (`ui_kits/hojokin-pocket/`)
- `index.html` — the full **interactive 12-screen mobile flow** (diagnose → results
  → detail → AI business plan → method → expert → confirm → chat → status → submit →
  complete), composed from the components above
- `screens-*.jsx` — the screens, factored by tab/section
- `data.js` — demo content (subsidies, experts, business-plan text)
- `kit.css` — screen-level chrome on top of the design tokens

**Meta**
- `SKILL.md` — Agent-Skill manifest for using this system in Claude Code
- `readme.md` — this file
