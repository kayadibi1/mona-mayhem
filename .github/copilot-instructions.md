# Mona Mayhem — Copilot Workspace Instructions

You are generating UI for **Mona Mayhem**, a retro-neon **cyberpunk arcade**
battle arena where two GitHub contribution graphs fight. Every component you
create MUST follow the design system and conventions below. Treat these as hard
rules, not suggestions.

## 🎮 Lore & voice

- Setting: a 1980s arcade cabinet running on a cyberpunk terminal. Think CRT
  glow, scanlines, neon signage.
- UI copy is in an **arcade-announcer voice**, ALL CAPS: `FIGHT!`, `K.O.`,
  `GAME OVER`, `INSERT COIN TO CONTINUE`, `PLAYER 1` / `PLAYER 2`, `ROUND`.

## 🎨 Design tokens (use these EXACT values)

| Token             | Value     | Use                                  |
| ----------------- | --------- | ------------------------------------ |
| `--neon-magenta`  | `#FF00FF` | **primary buttons & accents**        |
| `--neon-cyan`     | `#00FFFF` | secondary accents, links             |
| `--neon-lime`     | `#39FF14` | win / success                        |
| `--neon-red`      | `#FF1744` | loss / danger / `GAME OVER`          |
| `--bg-void`       | `#0D0221` | page background                      |
| `--bg-panel`      | `#160A33` | panels / cards                       |
| `--text`          | `#E6E6FA` | body text                            |

- **Font:** `"Press Start 2P"` (load from Google Fonts), `ui-monospace` fallback.
  Headings are UPPERCASE.
- **Neon glow:** headings get `text-shadow: 0 0 8px <accent>`. Panels get a `2px`
  solid neon border plus a matching `box-shadow` glow.
- **CRT feel:** add a scanline overlay (`repeating-linear-gradient`) on full
  screens via a `::after` pseudo-element.

## 📐 Layout rules

- **ALWAYS use CSS grid** for component and page layout (not flexbox for
  structure). Center with `place-items: center`.
- **Primary buttons** use `background: var(--neon-magenta)` with dark text,
  uppercase label, `2px` border, glow on hover, and a **44px minimum** height.
- Secondary buttons are transparent with a `--neon-cyan` border.

## 🔊 Code conventions

- At every point a retro sound effect would fire, add a comment:
  `// 🔊 sfx: <name>` (e.g. `// 🔊 sfx: coin-insert`, `// 🔊 sfx: ko-explosion`).
- Arcade-flavored, semantic class names: `.crt-screen`, `.arcade-panel`,
  `.neon-btn`, `.kicker`.
- Keep game logic in `src/game/` (pure, framework-free); components in
  `src/components/`; pages in `src/pages/`.

## ♿ Accessibility

- Respect `@media (prefers-reduced-motion: reduce)` — disable the glow pulse and
  blink animations.
- Maintain readable contrast against `--bg-void` / `--bg-panel`.
